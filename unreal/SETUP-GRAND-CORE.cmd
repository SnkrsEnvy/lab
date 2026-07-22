@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Scripts\SETUP-GRAND-CORE.ps1"
if errorlevel 1 (
  echo.
  echo Setup did not complete. Read the message above.
  pause
)
