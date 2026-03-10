#!/usr/bin/env python3
"""
Flashforge Calibration Assistant — GUI utility.
Downloads printer.cfg and shaper CSVs via SSH,
then opens the web app with data encoded in the URL.

Build standalone exe:
    pip install pyinstaller paramiko
    pyinstaller --onefile --windowed flashforge_gui.py
"""

import base64
import gzip
import json
import os
import sys
import tempfile
import threading
import webbrowser
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from pathlib import Path

try:
    import paramiko
except ImportError:
    paramiko = None  # handled at runtime


# ─── Config ───────────────────────────────────────────────────────────────────

WEB_APP_URL = os.environ.get(
    "FLASHFORGE_WEB_URL",
    "https://ldoci.github.io/Flashforge-Calibration-Assistant-web/",
)

CONFIG_FALLBACK_PATHS = [
    "/opt/config/printer.cfg",
    "/root/printer_data/config/printer.cfg",
    "/usr/data/config/printer.cfg",
]

PRINTER_PRESETS = {
    "Flashforge AD5M / AD5M Pro": {
        "user": "root",
        "config_path": "/opt/config/printer.cfg",
        "shaper_dir": "/tmp",
    },
    "Flashforge 5X": {
        "user": "root",
        "config_path": "/opt/config/printer.cfg",
        "shaper_dir": "/tmp",
    },
    "Custom": {
        "user": "root",
        "config_path": "/opt/config/printer.cfg",
        "shaper_dir": "/tmp",
    },
}


# ─── SSH / Payload logic ─────────────────────────────────────────────────────

def download_file_ssh(sftp, remote_path: str) -> str:
    """Download a remote file via SFTP and return contents."""
    with tempfile.NamedTemporaryFile(mode="w+", suffix=".tmp", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        sftp.get(remote_path, tmp_path)
        with open(tmp_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    finally:
        os.unlink(tmp_path)


def find_shaper_csvs(sftp, remote_dir: str) -> list:
    """Find shaper CSV files in a directory."""
    results = []
    try:
        for entry in sftp.listdir(remote_dir):
            if entry.endswith(".csv") and entry.startswith("calibration_data_"):
                results.append(os.path.join(remote_dir, entry))
    except IOError:
        pass
    return sorted(results)


def encode_payload(data: dict) -> str:
    """Compress and base64url-encode for URL transport."""
    raw = json.dumps(data, separators=(",", ":")).encode("utf-8")
    compressed = gzip.compress(raw, compresslevel=9)
    return base64.urlsafe_b64encode(compressed).rstrip(b"=").decode("ascii")


# ─── GUI ──────────────────────────────────────────────────────────────────────

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Flashforge Calibration Assistant")
        self.resizable(False, False)
        self.configure(bg="#1e1e2e")
        self._build_ui()
        self._center_window()

    # ── UI ────────────────────────────────────────────────────────────────

    def _build_ui(self):
        style = ttk.Style()
        style.theme_use("clam")
        # Dark theme colors
        bg = "#1e1e2e"
        fg = "#cdd6f4"
        field_bg = "#313244"
        accent = "#89b4fa"
        btn_bg = "#45475a"

        style.configure(".", background=bg, foreground=fg, fieldbackground=field_bg)
        style.configure("TLabel", background=bg, foreground=fg, font=("Segoe UI", 10))
        style.configure("TEntry", fieldbackground=field_bg, foreground=fg)
        style.configure("TCheckbutton", background=bg, foreground=fg)
        style.configure("Header.TLabel", font=("Segoe UI", 14, "bold"), foreground=accent)
        style.configure("Accent.TButton", background=accent, foreground="#1e1e2e",
                        font=("Segoe UI", 10, "bold"), padding=(12, 6))
        style.map("Accent.TButton",
                  background=[("active", "#b4d0fb"), ("disabled", "#585b70")])
        style.configure("Secondary.TButton", background=btn_bg, foreground=fg,
                        font=("Segoe UI", 9), padding=(8, 4))

        pad = {"padx": 12, "pady": 4}
        main = ttk.Frame(self, padding=16)
        main.pack(fill="both", expand=True)

        # Header
        ttk.Label(main, text="Flashforge Calibration Assistant",
                  style="Header.TLabel").grid(row=0, column=0, columnspan=3, pady=(0, 12))

        # Printer preset
        ttk.Label(main, text="Printer:").grid(row=1, column=0, sticky="w", **pad)
        self.preset_var = tk.StringVar(value=list(PRINTER_PRESETS.keys())[0])
        preset_cb = ttk.Combobox(main, textvariable=self.preset_var,
                                 values=list(PRINTER_PRESETS.keys()),
                                 state="readonly", width=32)
        preset_cb.grid(row=1, column=1, columnspan=2, sticky="ew", **pad)
        preset_cb.bind("<<ComboboxSelected>>", self._on_preset_change)

        # Host
        ttk.Label(main, text="IP Address:").grid(row=2, column=0, sticky="w", **pad)
        self.host_var = tk.StringVar()
        ttk.Entry(main, textvariable=self.host_var, width=35).grid(
            row=2, column=1, columnspan=2, sticky="ew", **pad)

        # Username
        ttk.Label(main, text="Username:").grid(row=3, column=0, sticky="w", **pad)
        self.user_var = tk.StringVar(value="root")
        ttk.Entry(main, textvariable=self.user_var, width=35).grid(
            row=3, column=1, columnspan=2, sticky="ew", **pad)

        # Password
        ttk.Label(main, text="Password:").grid(row=4, column=0, sticky="w", **pad)
        self.pass_var = tk.StringVar()
        self.pass_entry = ttk.Entry(main, textvariable=self.pass_var, show="*", width=35)
        self.pass_entry.grid(row=4, column=1, sticky="ew", **pad)
        self.show_pass = tk.BooleanVar(value=False)
        ttk.Checkbutton(main, text="Show", variable=self.show_pass,
                        command=self._toggle_pass).grid(row=4, column=2)

        # Config path
        ttk.Label(main, text="Config path:").grid(row=5, column=0, sticky="w", **pad)
        self.cfg_var = tk.StringVar(value=PRINTER_PRESETS[self.preset_var.get()]["config_path"])
        ttk.Entry(main, textvariable=self.cfg_var, width=35).grid(
            row=5, column=1, columnspan=2, sticky="ew", **pad)

        # Shapers checkbox
        self.shapers_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(main, text="Also download shaper CSVs (Input Shaper)",
                        variable=self.shapers_var).grid(
            row=6, column=0, columnspan=3, sticky="w", padx=12, pady=(8, 4))

        # ── Buttons ──
        btn_frame = ttk.Frame(main)
        btn_frame.grid(row=7, column=0, columnspan=3, pady=(12, 4))

        self.btn_go = ttk.Button(btn_frame, text="Download & Open in Browser",
                                 style="Accent.TButton", command=self._on_go)
        self.btn_go.pack(side="left", padx=4)

        ttk.Button(btn_frame, text="Load local files",
                   style="Secondary.TButton",
                   command=self._on_local).pack(side="left", padx=4)

        # ── Status log ──
        self.log_text = tk.Text(main, height=8, width=52, bg="#181825", fg="#a6adc8",
                                font=("Consolas", 9), relief="flat", state="disabled",
                                wrap="word")
        self.log_text.grid(row=8, column=0, columnspan=3, pady=(8, 0), sticky="ew")

        self._log("Ready. Enter your printer IP and click 'Download & Open'.")

    def _center_window(self):
        self.update_idletasks()
        w, h = self.winfo_width(), self.winfo_height()
        x = (self.winfo_screenwidth() - w) // 2
        y = (self.winfo_screenheight() - h) // 2
        self.geometry(f"+{x}+{y}")

    def _on_preset_change(self, _=None):
        preset = PRINTER_PRESETS[self.preset_var.get()]
        self.user_var.set(preset["user"])
        self.cfg_var.set(preset["config_path"])

    def _toggle_pass(self):
        self.pass_entry.configure(show="" if self.show_pass.get() else "*")

    def _log(self, msg: str):
        self.log_text.configure(state="normal")
        self.log_text.insert("end", msg + "\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    # ── SSH download ─────────────────────────────────────────────────────

    def _on_go(self):
        if paramiko is None:
            messagebox.showerror("Missing dependency",
                                 "paramiko is not installed.\n\n"
                                 "Run:  pip install paramiko")
            return

        host = self.host_var.get().strip()
        if not host:
            messagebox.showwarning("Missing IP", "Please enter the printer IP address.")
            return

        user = self.user_var.get().strip() or "root"
        password = self.pass_var.get()
        config_path = self.cfg_var.get().strip()
        include_shapers = self.shapers_var.get()
        preset = PRINTER_PRESETS[self.preset_var.get()]
        shaper_dir = preset.get("shaper_dir", "/tmp")

        self.btn_go.configure(state="disabled")
        self._log(f"\nConnecting to {user}@{host} ...")

        def worker():
            try:
                client = paramiko.SSHClient()
                client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                # Flashforge uses dropbear — disable strict kex for compatibility
                connect_kwargs = dict(
                    hostname=host, port=22, username=user,
                    password=password if password else None,
                    timeout=10,
                    allow_agent=False,
                    look_for_keys=False,
                )
                # paramiko ≥3.4 supports disabled_algorithms to skip strict kex
                try:
                    connect_kwargs["disabled_algorithms"] = {
                        "kex": ["strict-kex-v00@openssh.com"]
                    }
                except Exception:
                    pass
                client.connect(**connect_kwargs)
                self.after(0, lambda: self._log("Connected."))

                sftp = client.open_sftp()
                payload = {"version": 1, "configs": [], "shaperCsvs": []}

                # Download printer.cfg — try user-specified path, then fallbacks
                paths_to_try = [config_path] + [
                    p for p in CONFIG_FALLBACK_PATHS if p != config_path
                ]
                cfg_content = None
                used_path = config_path
                for try_path in paths_to_try:
                    try:
                        self.after(0, lambda p=try_path: self._log(f"Trying {p} ..."))
                        cfg_content = download_file_ssh(sftp, try_path)
                        used_path = try_path
                        break
                    except (IOError, FileNotFoundError):
                        self.after(0, lambda p=try_path: self._log(f"  Not found: {p}"))

                if cfg_content is None:
                    raise FileNotFoundError(
                        "printer.cfg not found at any known path:\n"
                        + "\n".join(f"  • {p}" for p in paths_to_try)
                    )

                payload["configs"].append({
                    "name": Path(used_path).name,
                    "content": cfg_content,
                })
                self.after(0, lambda: self._log(
                    f"  printer.cfg: {len(cfg_content):,} bytes"))

                # Shaper CSVs
                if include_shapers:
                    self.after(0, lambda: self._log(f"Looking for shaper CSVs in {shaper_dir} ..."))
                    csv_files = find_shaper_csvs(sftp, shaper_dir)
                    if not csv_files:
                        self.after(0, lambda: self._log("  No shaper CSVs found."))
                    for csv_path in csv_files:
                        csv_content = download_file_ssh(sftp, csv_path)
                        name = Path(csv_path).name
                        payload["shaperCsvs"].append({
                            "name": name,
                            "content": csv_content,
                        })
                        self.after(0, lambda n=name, s=len(csv_content):
                                   self._log(f"  {n}: {s:,} bytes"))

                sftp.close()
                client.close()

                # Encode & open
                encoded = encode_payload(payload)
                url = f"{WEB_APP_URL.rstrip('/')}/?data={encoded}"
                self.after(0, lambda: self._log(
                    f"Payload: {len(encoded):,} chars. Opening browser..."))
                webbrowser.open(url)
                self.after(0, lambda: self._log("Done! Data loaded in the web app."))

            except Exception as e:
                self.after(0, lambda: self._log(f"ERROR: {e}"))
                self.after(0, lambda: messagebox.showerror("Connection Error", str(e)))
            finally:
                self.after(0, lambda: self.btn_go.configure(state="normal"))

        threading.Thread(target=worker, daemon=True).start()

    # ── Local file loading ───────────────────────────────────────────────

    def _on_local(self):
        """Pick local .cfg / .csv files and open the web app."""
        files = filedialog.askopenfilenames(
            title="Select printer.cfg and/or shaper CSVs",
            filetypes=[
                ("Config & CSV", "*.cfg *.conf *.csv"),
                ("All files", "*.*"),
            ],
        )
        if not files:
            return

        payload = {"version": 1, "configs": [], "shaperCsvs": []}
        for fpath in files:
            name = Path(fpath).name
            with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()

            if name.endswith((".cfg", ".conf")):
                payload["configs"].append({"name": name, "content": content})
                self._log(f"Loaded config: {name}")
            elif name.endswith(".csv"):
                payload["shaperCsvs"].append({"name": name, "content": content})
                self._log(f"Loaded shaper: {name}")

        if not payload["configs"] and not payload["shaperCsvs"]:
            self._log("No valid files selected.")
            return

        encoded = encode_payload(payload)
        url = f"{WEB_APP_URL.rstrip('/')}/?data={encoded}"
        self._log(f"Payload: {len(encoded):,} chars. Opening browser...")
        webbrowser.open(url)
        self._log("Done!")


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = App()
    app.mainloop()
