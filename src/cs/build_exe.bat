@echo off
REM Build a standalone .exe of the UPANDRUNNING Patient Services Dashboard (C# version).
REM Requires the .NET 8 SDK: https://dotnet.microsoft.com/download
REM Run this on Windows. Produces a single self-contained exe (no install needed).

echo Restoring and publishing (this can take a few minutes the first time)...
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o publish

if errorlevel 1 (
  echo.
  echo Build FAILED. Make sure the .NET 8 SDK is installed.
  pause
  exit /b 1
)

echo.
echo Done. Your exe is here:
echo     publish\UPANDRUNNING_Dashboard.exe
echo.
echo Copy UPANDRUNNING_Dashboard.exe to any folder and double-click to run.
echo A dashboard.db file is created next to it to store data.
pause