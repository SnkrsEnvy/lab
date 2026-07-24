@echo off
setlocal EnableExtensions
title GRAND CORE - CAMERA AND WORLD BLOCK RECOVERY
color 0A

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0RECOVER-CAMERA-WORLD-BLOCK.ps1"

set "RESULT=%ERRORLEVEL%"
echo.

if not "%RESULT%"=="0" (
    echo ============================================================
    echo CAMERA AND WORLD BLOCK RECOVERY FAILED
    echo ============================================================
    echo.
    echo Leave this window open and send ChatGPT a screenshot.
    echo.
    pause
    exit /b %RESULT%
)

pause
exit /b 0
