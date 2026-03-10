@echo off
REM Build standalone Windows exe
REM Requirements: pip install paramiko pyinstaller

cd /d "%~dp0"

echo Building Flashforge Assistant for Windows...
pip install paramiko pyinstaller -q

pyinstaller --onefile --windowed ^
    --name "Flashforge Assistant" ^
    --hidden-import paramiko ^
    --hidden-import paramiko.transport ^
    --hidden-import paramiko.sftp ^
    --hidden-import paramiko.client ^
    --hidden-import nacl ^
    --hidden-import bcrypt ^
    --hidden-import cryptography ^
    flashforge_gui.py

echo.
echo Done! Exe is at: dist\Flashforge Assistant.exe
pause
