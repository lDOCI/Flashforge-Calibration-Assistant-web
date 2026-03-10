#!/bin/bash
# Build standalone Mac app
# Requirements: pip install paramiko pyinstaller

set -e
cd "$(dirname "$0")"

echo "Building Flashforge Assistant for macOS..."

# Install deps (skip if pip is broken — ensure paramiko+pyinstaller are installed)
pip install paramiko pyinstaller -q 2>/dev/null || echo "pip install skipped, using existing packages"

pyinstaller --onefile --windowed --name "Flashforge Assistant" \
    --hidden-import paramiko \
    --hidden-import paramiko.transport \
    --hidden-import paramiko.sftp \
    --hidden-import paramiko.client \
    --hidden-import nacl \
    --hidden-import bcrypt \
    --hidden-import cryptography \
    flashforge_gui.py

echo ""
echo "Done! App is at: dist/Flashforge Assistant.app"
echo "You can move it to /Applications or distribute the .app bundle."
