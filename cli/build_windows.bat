@echo off
REM Build standalone Windows exe
REM Requirements: pip install paramiko pyinstaller

cd /d "%~dp0"

echo Building Flashforge Assistant for Windows...
pip install paramiko pyinstaller -q

pyinstaller --onefile --windowed ^
    --name "Flashforge Assistant" ^
    flashforge_gui.py

echo.
echo Done! Exe is at: dist\Flashforge Assistant.exe
pause
