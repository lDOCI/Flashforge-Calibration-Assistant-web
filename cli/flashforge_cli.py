#!/usr/bin/env python3
"""
Flashforge Calibration CLI — downloads printer data via SSH
and opens the web calibration assistant with the data encoded in the URL.

Usage:
    python flashforge_cli.py --host 192.168.1.100 [--user root] [--password <pwd>] [--shapers]

Requirements:
    pip install paramiko
"""

import argparse
import base64
import gzip
import json
import os
import sys
import tempfile
import webbrowser
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("ERROR: paramiko is required. Install with: pip install paramiko")
    sys.exit(1)


# Default paths on Flashforge printers
DEFAULT_CONFIG_PATH = "/opt/config/printer.cfg"
CONFIG_FALLBACK_PATHS = [
    "/opt/config/printer.cfg",
    "/root/printer_data/config/printer.cfg",
    "/usr/data/config/printer.cfg",
]
DEFAULT_SHAPER_DIR = "/tmp"
DEFAULT_USER = "root"
DEFAULT_PORT = 22

# Where the web app is hosted (change after deploying to your GitHub Pages)
WEB_APP_URL = os.environ.get(
    "FLASHFORGE_WEB_URL",
    "https://ldoci.github.io/Flashforge-Calibration-Assistant-web/",
)


def connect_ssh(host: str, port: int, user: str, password: str | None = None,
                key_file: str | None = None) -> paramiko.SSHClient:
    """Establish an SSH connection to the printer."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    kwargs: dict = {"hostname": host, "port": port, "username": user}
    if key_file:
        kwargs["key_filename"] = key_file
    elif password:
        kwargs["password"] = password

    print(f"Connecting to {user}@{host}:{port} ...")
    client.connect(**kwargs)
    print("Connected.")
    return client


def download_file(sftp: paramiko.SFTPClient, remote_path: str) -> str:
    """Download a remote file and return its contents as a string."""
    print(f"  Downloading {remote_path} ...")
    with tempfile.NamedTemporaryFile(mode="w+", suffix=".tmp", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        sftp.get(remote_path, tmp_path)
        with open(tmp_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    finally:
        os.unlink(tmp_path)


def find_shaper_csvs(sftp: paramiko.SFTPClient, remote_dir: str) -> list[str]:
    """Find shaper CSV files in the given directory."""
    results = []
    try:
        for entry in sftp.listdir(remote_dir):
            if entry.endswith(".csv") and entry.startswith("calibration_data_"):
                results.append(os.path.join(remote_dir, entry))
    except IOError:
        pass
    return sorted(results)


def encode_payload(data: dict) -> str:
    """Compress and base64url-encode the payload for URL transport."""
    json_bytes = json.dumps(data, separators=(",", ":")).encode("utf-8")
    compressed = gzip.compress(json_bytes, compresslevel=9)

    # base64url encoding (URL-safe, no padding)
    encoded = base64.urlsafe_b64encode(compressed).rstrip(b"=").decode("ascii")
    return encoded


def main():
    parser = argparse.ArgumentParser(
        description="Download printer data and open the web calibration tool."
    )
    parser.add_argument("--host", required=True, help="Printer IP address or hostname")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="SSH port")
    parser.add_argument("--user", default=DEFAULT_USER, help="SSH username")
    parser.add_argument("--password", default=None, help="SSH password")
    parser.add_argument("--key", default=None, help="Path to SSH private key")
    parser.add_argument("--config-path", default=DEFAULT_CONFIG_PATH,
                        help="Remote path to printer.cfg")
    parser.add_argument("--shapers", action="store_true",
                        help="Also download shaper CSV files")
    parser.add_argument("--shaper-dir", default=DEFAULT_SHAPER_DIR,
                        help="Remote directory for shaper CSVs")
    parser.add_argument("--url", default=None,
                        help="Override web app URL")
    parser.add_argument("--no-open", action="store_true",
                        help="Print URL instead of opening browser")

    args = parser.parse_args()
    web_url = args.url or WEB_APP_URL

    # Connect
    client = connect_ssh(args.host, args.port, args.user, args.password, args.key)
    sftp = client.open_sftp()

    payload: dict = {"version": 1, "configs": [], "shaperCsvs": []}

    try:
        # Download printer.cfg
        config_content = download_file(sftp, args.config_path)
        payload["configs"].append({
            "name": Path(args.config_path).name,
            "content": config_content,
        })
        print(f"  printer.cfg: {len(config_content)} bytes")

        # Optionally download shaper CSVs
        if args.shapers:
            csv_files = find_shaper_csvs(sftp, args.shaper_dir)
            if not csv_files:
                print("  No shaper CSV files found.")
            for csv_path in csv_files:
                csv_content = download_file(sftp, csv_path)
                payload["shaperCsvs"].append({
                    "name": Path(csv_path).name,
                    "content": csv_content,
                })
                print(f"  {Path(csv_path).name}: {len(csv_content)} bytes")

    finally:
        sftp.close()
        client.close()
        print("Disconnected.")

    # Encode payload
    encoded = encode_payload(payload)
    full_url = f"{web_url.rstrip('/')}/?data={encoded}"

    print(f"\nPayload size: {len(encoded)} chars (base64url)")

    if len(full_url) > 100_000:
        print(f"WARNING: URL is {len(full_url)} characters. "
              "Some browsers may not handle URLs this large.")

    if args.no_open:
        print(f"\nURL:\n{full_url}")
    else:
        print("Opening browser...")
        webbrowser.open(full_url)
        print("Done! The web app should load your data automatically.")


if __name__ == "__main__":
    main()
