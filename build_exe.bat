@echo off
REM Build a standalone .exe of the UPANDRUNNING Patient Services Dashboard.
REM Run this on Windows. Requires Python 3.10+ and internet access for pip.

echo Installing build dependencies...
python -m pip install --upgrade pip
python -m pip install flask openpyxl pyinstaller

echo Building executable...
pyinstaller --onefile --noconsole --name "UPANDRUNNING_Dashboard" --hidden-import openpyxl --hidden-import flask src\app.py

echo.
echo Done. Your exe is in the "dist" folder:
echo     dist\UPANDRUNNING_Dashboard.exe
echo.
echo Copy UPANDRUNNING_Dashboard.exe to any folder and double-click to run.
echo A dashboard.db file is created next to it to store data.
pause