#!/usr/bin/env python3
"""
Flashforge Calibration Assistant — GUI utility.
Downloads printer.cfg and shaper CSVs via SSH,
saves them locally, opens the folder and the web app.

Build:
    Mac:   pyinstaller --onefile --windowed --name "Flashforge Assistant" flashforge_gui.py
    Win:   pyinstaller --onefile --windowed --name "Flashforge Assistant" --icon=icon.ico flashforge_gui.py

Requirements:
    pip install paramiko pyinstaller
"""

import json
import os
import platform
import subprocess
import sys
import threading
import webbrowser
import tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path

try:
    import paramiko
except Exception as _imp_err:
    paramiko = None
    _paramiko_error = str(_imp_err)

# ─── Config ───────────────────────────────────────────────────────────────────

WEB_APP_URL = "https://ldoci.github.io/Flashforge-Calibration-Assistant-web/"

CONFIG_FALLBACK_PATHS = [
    "/opt/config/printer.cfg",
    "/root/printer_data/config/printer.cfg",
    "/usr/data/config/printer.cfg",
]

SHAPER_DIR = "/tmp"

if getattr(sys, "frozen", False):
    _APP_DIR = Path(sys.executable).parent
else:
    _APP_DIR = Path(__file__).parent
SETTINGS_FILE = _APP_DIR / ".flashforge_settings.json"

# Output folder for downloaded files
OUTPUT_DIR = Path.home() / "Flashforge Calibration"

# ─── Localization ─────────────────────────────────────────────────────────────

LANG_RU = {
    "title": "Помощник Калибровки Flashforge",
    "description": (
        "Программа скачает файлы с принтера, откроет папку\n"
        "с данными и сайт в браузере. Перетащите файлы на сайт."
    ),
    "ip": "IP адрес принтера:",
    "password": "Пароль:",
    "show": "Показать",
    "remember": "Запомнить пароль",
    "shapers": "Скачать CSV шейперов (Input Shaper)",
    "btn_go": "Скачать и открыть",
    "btn_ready": "Введите IP принтера и нажмите «Скачать и открыть».",
    "missing_paramiko": "paramiko не установлен.\n\nВыполните: pip install paramiko",
    "missing_ip": "Введите IP адрес принтера.",
    "connecting": "Подключение к root@{host} ...",
    "connected": "Подключено.",
    "trying": "Пробуем {path} ...",
    "not_found": "  Не найден: {path}",
    "cfg_found": "  printer.cfg: {size} байт",
    "looking_shapers": "Ищем CSV шейперов в {dir} ...",
    "no_shapers": "  CSV шейперов не найдено.",
    "shaper_found": "  {name}: {size} байт",
    "saved_to": "Файлы сохранены в: {path}",
    "opening_folder": "Открываю папку с файлами...",
    "opening_browser": "Открываю сайт калибровки в браузере...",
    "done": "Готово! Перетащите скачанные файлы из папки на сайт.",
    "cfg_not_found": "printer.cfg не найден ни по одному пути:\n{paths}",
    "error": "Ошибка подключения",
}

LANG_EN = {
    "title": "Flashforge Calibration Assistant",
    "description": (
        "Downloads files from the printer, opens the folder\n"
        "and the website. Drag the files onto the site."
    ),
    "ip": "Printer IP Address:",
    "password": "Password:",
    "show": "Show",
    "remember": "Remember password",
    "shapers": "Download shaper CSVs (Input Shaper)",
    "btn_go": "Download & Open",
    "btn_ready": "Enter your printer IP and click 'Download & Open'.",
    "missing_paramiko": "paramiko is not installed.\n\nRun: pip install paramiko",
    "missing_ip": "Please enter the printer IP address.",
    "connecting": "Connecting to root@{host} ...",
    "connected": "Connected.",
    "trying": "Trying {path} ...",
    "not_found": "  Not found: {path}",
    "cfg_found": "  printer.cfg: {size} bytes",
    "looking_shapers": "Looking for shaper CSVs in {dir} ...",
    "no_shapers": "  No shaper CSVs found.",
    "shaper_found": "  {name}: {size} bytes",
    "saved_to": "Files saved to: {path}",
    "opening_folder": "Opening folder with downloaded files...",
    "opening_browser": "Opening calibration website in browser...",
    "done": "Done! Drag the downloaded files from the folder onto the site.",
    "cfg_not_found": "printer.cfg not found at any known path:\n{paths}",
    "error": "Connection Error",
}


L = LANG_RU  # default Russian


# ─── Settings ─────────────────────────────────────────────────────────────────

def load_settings() -> dict:
    try:
        return json.loads(SETTINGS_FILE.read_text("utf-8"))
    except Exception:
        return {}


def save_settings(data: dict):
    try:
        SETTINGS_FILE.write_text(json.dumps(data, indent=2), "utf-8")
    except Exception:
        pass


# ─── SSH ──────────────────────────────────────────────────────────────────────

def ssh_connect(host: str, password: str):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=host, port=22, username="root",
        password=password if password else None,
        timeout=10,
        allow_agent=False,
        look_for_keys=False,
        disabled_algorithms={"kex": ["kex-strict-c2s-v00@openssh.com"]},
    )
    return client


def ssh_read_file(client, remote_path: str) -> str:
    _, stdout, _ = client.exec_command(f"cat '{remote_path}'", timeout=10)
    if stdout.channel.recv_exit_status() != 0:
        raise FileNotFoundError(remote_path)
    return stdout.read().decode("utf-8", errors="replace")


def ssh_list_files(client, pattern: str) -> list:
    _, stdout, _ = client.exec_command(f"ls -1 {pattern} 2>/dev/null", timeout=10)
    stdout.channel.recv_exit_status()
    output = stdout.read().decode("utf-8").strip()
    return sorted(output.splitlines()) if output else []


# ─── Helpers ──────────────────────────────────────────────────────────────────

def open_folder(path: Path):
    """Open a folder in the system file manager."""
    system = platform.system()
    if system == "Darwin":
        subprocess.Popen(["open", str(path)])
    elif system == "Windows":
        os.startfile(str(path))
    else:
        subprocess.Popen(["xdg-open", str(path)])


# ─── GUI ──────────────────────────────────────────────────────────────────────

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(L["title"])
        self.resizable(False, False)
        self.configure(bg="#1e1e2e")
        self._build_ui()
        self._load_saved_settings()
        self._center_window()

    def _build_ui(self):
        style = ttk.Style()
        style.theme_use("clam")
        bg, fg = "#1e1e2e", "#cdd6f4"
        field_bg, accent, btn_bg = "#313244", "#89b4fa", "#45475a"

        style.configure(".", background=bg, foreground=fg, fieldbackground=field_bg)
        style.configure("TLabel", background=bg, foreground=fg, font=("Segoe UI", 10))
        style.configure("TEntry", fieldbackground=field_bg, foreground=fg)
        style.configure("TCheckbutton", background=bg, foreground=fg)
        style.configure("Header.TLabel", font=("Segoe UI", 14, "bold"), foreground=accent)
        style.configure("Accent.TButton", background=accent, foreground="#1e1e2e",
                        font=("Segoe UI", 10, "bold"), padding=(12, 6))
        style.map("Accent.TButton",
                  background=[("active", "#b4d0fb"), ("disabled", "#585b70")])

        pad = {"padx": 12, "pady": 4}
        main = ttk.Frame(self, padding=16)
        main.pack(fill="both", expand=True)

        # Header row with title + lang switch
        header_frame = ttk.Frame(main)
        header_frame.grid(row=0, column=0, columnspan=2, pady=(0, 4), sticky="ew")
        header_frame.columnconfigure(0, weight=1)

        ttk.Label(header_frame, text=L["title"],
                  style="Header.TLabel").grid(row=0, column=0)

        style.configure("Lang.TButton", font=("Segoe UI", 9), padding=(4, 2))
        self.lang_btn = ttk.Button(header_frame, text="EN", style="Lang.TButton",
                                   command=self._toggle_lang, width=3)
        self.lang_btn.grid(row=0, column=1, sticky="e")

        # Description
        style.configure("Desc.TLabel", background=bg, foreground="#a6adc8",
                        font=("Segoe UI", 9))
        self.desc_label = ttk.Label(main, text=L["description"], style="Desc.TLabel")
        self.desc_label.grid(row=1, column=0, columnspan=2, pady=(0, 10))

        # IP
        self.ip_label = ttk.Label(main, text=L["ip"])
        self.ip_label.grid(row=2, column=0, sticky="w", **pad)
        self.host_var = tk.StringVar()
        ttk.Entry(main, textvariable=self.host_var, width=35).grid(
            row=2, column=1, sticky="ew", **pad)

        # Password
        self.pass_label = ttk.Label(main, text=L["password"])
        self.pass_label.grid(row=3, column=0, sticky="w", **pad)
        self.pass_var = tk.StringVar()
        pass_frame = ttk.Frame(main)
        pass_frame.grid(row=3, column=1, sticky="ew", **pad)
        self.pass_entry = ttk.Entry(pass_frame, textvariable=self.pass_var, show="*", width=28)
        self.pass_entry.pack(side="left", fill="x", expand=True)
        self.show_pass = tk.BooleanVar(value=False)
        self.show_btn = ttk.Checkbutton(pass_frame, text=L["show"], variable=self.show_pass,
                                        command=self._toggle_pass)
        self.show_btn.pack(side="left", padx=(4, 0))

        # Remember
        self.remember_var = tk.BooleanVar(value=False)
        self.remember_btn = ttk.Checkbutton(main, text=L["remember"],
                                            variable=self.remember_var)
        self.remember_btn.grid(row=4, column=1, sticky="w", padx=12, pady=(2, 4))

        # Shapers
        self.shapers_var = tk.BooleanVar(value=True)
        self.shapers_btn = ttk.Checkbutton(main, text=L["shapers"],
                                           variable=self.shapers_var)
        self.shapers_btn.grid(row=5, column=0, columnspan=2, sticky="w", padx=12, pady=(4, 4))

        # Button
        self.btn_go = ttk.Button(main, text=L["btn_go"],
                                 style="Accent.TButton", command=self._on_go)
        self.btn_go.grid(row=6, column=0, columnspan=2, pady=(12, 4))

        # Log
        self.log_text = tk.Text(main, height=8, width=52, bg="#181825", fg="#a6adc8",
                                font=("Consolas", 9), relief="flat", state="disabled",
                                wrap="word")
        self.log_text.grid(row=7, column=0, columnspan=2, pady=(8, 0), sticky="ew")
        self._log(L["btn_ready"])

    def _center_window(self):
        self.update_idletasks()
        w, h = self.winfo_width(), self.winfo_height()
        x = (self.winfo_screenwidth() - w) // 2
        y = (self.winfo_screenheight() - h) // 2
        self.geometry(f"+{x}+{y}")

    def _toggle_lang(self):
        global L
        if L is LANG_RU:
            L = LANG_EN
            self.lang_btn.configure(text="RU")
        else:
            L = LANG_RU
            self.lang_btn.configure(text="EN")
        self.title(L["title"])
        self.desc_label.configure(text=L["description"])
        self.ip_label.configure(text=L["ip"])
        self.pass_label.configure(text=L["password"])
        self.show_btn.configure(text=L["show"])
        self.remember_btn.configure(text=L["remember"])
        self.shapers_btn.configure(text=L["shapers"])
        self.btn_go.configure(text=L["btn_go"])

    def _toggle_pass(self):
        self.pass_entry.configure(show="" if self.show_pass.get() else "*")

    def _log(self, msg: str):
        self.log_text.configure(state="normal")
        self.log_text.insert("end", msg + "\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def _load_saved_settings(self):
        s = load_settings()
        if s.get("host"):
            self.host_var.set(s["host"])
        if s.get("password"):
            self.pass_var.set(s["password"])
            self.remember_var.set(True)
        if "shapers" in s:
            self.shapers_var.set(s["shapers"])

    def _save_current_settings(self):
        s = {"host": self.host_var.get().strip(), "shapers": self.shapers_var.get()}
        if self.remember_var.get():
            s["password"] = self.pass_var.get()
        save_settings(s)

    def _on_go(self):
        if paramiko is None:
            messagebox.showerror(L["error"],
                                 f"{L['missing_paramiko']}\n\n{_paramiko_error}")
            return

        host = self.host_var.get().strip()
        if not host:
            messagebox.showwarning(L["error"], L["missing_ip"])
            return

        password = self.pass_var.get()
        include_shapers = self.shapers_var.get()
        self._save_current_settings()

        self.btn_go.configure(state="disabled")
        self._log(f"\n{L['connecting'].format(host=host)}")

        def worker():
            try:
                client = ssh_connect(host, password)
                self.after(0, lambda: self._log(L["connected"]))

                # Prepare output folder
                OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

                # Download printer.cfg
                cfg_content = None
                for try_path in CONFIG_FALLBACK_PATHS:
                    try:
                        self.after(0, lambda p=try_path: self._log(
                            L["trying"].format(path=p)))
                        cfg_content = ssh_read_file(client, try_path)
                        break
                    except (FileNotFoundError, Exception):
                        self.after(0, lambda p=try_path: self._log(
                            L["not_found"].format(path=p)))

                if cfg_content is None:
                    paths = "\n".join(f"  - {p}" for p in CONFIG_FALLBACK_PATHS)
                    raise FileNotFoundError(L["cfg_not_found"].format(paths=paths))

                cfg_file = OUTPUT_DIR / "printer.cfg"
                cfg_file.write_text(cfg_content, encoding="utf-8")
                size = len(cfg_content)
                self.after(0, lambda s=size: self._log(
                    L["cfg_found"].format(size=f"{s:,}")))

                # Shaper CSVs
                if include_shapers:
                    self.after(0, lambda: self._log(
                        L["looking_shapers"].format(dir=SHAPER_DIR)))
                    csv_files = ssh_list_files(
                        client, f"{SHAPER_DIR}/calibration_data_*.csv")
                    if not csv_files:
                        self.after(0, lambda: self._log(L["no_shapers"]))
                    for csv_path in csv_files:
                        csv_content = ssh_read_file(client, csv_path)
                        name = Path(csv_path).name
                        (OUTPUT_DIR / name).write_text(csv_content, encoding="utf-8")
                        self.after(0, lambda n=name, s=len(csv_content):
                                   self._log(L["shaper_found"].format(
                                       name=n, size=f"{s:,}")))

                client.close()

                out = str(OUTPUT_DIR)
                self.after(0, lambda o=out: self._log(L["saved_to"].format(path=o)))

                # Open folder
                self.after(0, lambda: self._log(L["opening_folder"]))
                open_folder(OUTPUT_DIR)

                # Open browser
                self.after(0, lambda: self._log(L["opening_browser"]))
                webbrowser.open(WEB_APP_URL)

                self.after(0, lambda: self._log(L["done"]))

            except Exception as e:
                err_msg = str(e)
                self.after(0, lambda m=err_msg: self._log(f"ERROR: {m}"))
                self.after(0, lambda m=err_msg: messagebox.showerror(L["error"], m))
            finally:
                self.after(0, lambda: self.btn_go.configure(state="normal"))

        threading.Thread(target=worker, daemon=True).start()


if __name__ == "__main__":
    app = App()
    app.mainloop()
