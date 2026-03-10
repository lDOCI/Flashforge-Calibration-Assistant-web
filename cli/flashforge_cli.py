#!/usr/bin/env python3
"""
Flashforge Calibration CLI — downloads printer data via SSH
and saves files locally for use with the web calibration tool.

Usage:
    python flashforge_cli.py --host 192.168.1.100 [--password <pwd>] [--shapers]

Requirements:
    pip install paramiko
"""

import argparse
import os
import platform
import subprocess
import sys
import webbrowser
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("ERROR: paramiko is required. Install with: pip install paramiko")
    sys.exit(1)

CONFIG_FALLBACK_PATHS = [
    "/opt/config/printer.cfg",
    "/root/printer_data/config/printer.cfg",
    "/usr/data/config/printer.cfg",
]
SHAPER_DIR = "/tmp"
WEB_APP_URL = "https://ldoci.github.io/Flashforge-Calibration-Assistant-web/"
OUTPUT_DIR = Path.home() / "Flashforge Calibration"


def ssh_connect(host: str, port: int, password: str | None):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{host}:{port} ...")
    client.connect(
        hostname=host, port=port, username="root",
        password=password, timeout=10,
        allow_agent=False, look_for_keys=False,
        disabled_algorithms={"kex": ["kex-strict-c2s-v00@openssh.com"]},
    )
    print("Connected.")
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


def open_folder(path: Path):
    system = platform.system()
    if system == "Darwin":
        subprocess.Popen(["open", str(path)])
    elif system == "Windows":
        os.startfile(str(path))
    else:
        subprocess.Popen(["xdg-open", str(path)])


def main():
    parser = argparse.ArgumentParser(
        description="Download printer data via SSH for the web calibration tool."
    )
    parser.add_argument("--host", required=True, help="Printer IP address")
    parser.add_argument("--port", type=int, default=22)
    parser.add_argument("--password", default=None)
    parser.add_argument("--shapers", action="store_true",
                        help="Also download shaper CSV files")
    parser.add_argument("--no-open", action="store_true",
                        help="Don't open folder/browser")
    args = parser.parse_args()

    client = ssh_connect(args.host, args.port, args.password)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    try:
        # Download printer.cfg
        cfg_content = None
        for try_path in CONFIG_FALLBACK_PATHS:
            try:
                print(f"  Trying {try_path} ...")
                cfg_content = ssh_read_file(client, try_path)
                print(f"  Found! {len(cfg_content):,} bytes")
                break
            except FileNotFoundError:
                print(f"  Not found: {try_path}")

        if cfg_content is None:
            print("ERROR: printer.cfg not found")
            sys.exit(1)

        (OUTPUT_DIR / "printer.cfg").write_text(cfg_content, encoding="utf-8")

        # Shaper CSVs
        if args.shapers:
            csv_files = ssh_list_files(client, f"{SHAPER_DIR}/calibration_data_*.csv")
            if not csv_files:
                print("  No shaper CSV files found.")
            for csv_path in csv_files:
                content = ssh_read_file(client, csv_path)
                name = Path(csv_path).name
                (OUTPUT_DIR / name).write_text(content, encoding="utf-8")
                print(f"  {name}: {len(content):,} bytes")

    finally:
        client.close()
        print("Disconnected.")

    print(f"\nFiles saved to: {OUTPUT_DIR}")

    if not args.no_open:
        open_folder(OUTPUT_DIR)
        webbrowser.open(WEB_APP_URL)
        print("Done! Drag files from the folder onto the website.")


if __name__ == "__main__":
    main()
