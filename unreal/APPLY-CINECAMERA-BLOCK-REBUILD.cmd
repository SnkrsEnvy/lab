@echo off
setlocal EnableExtensions
title GRAND CORE - CINE CAMERA BLOCK REBUILD
color 0A

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0REBUILD-CINECAMERA-BLOCK.ps1"

set "RESULT=%ERRORLEVEL%"
echo.

if not "%RESULT%"=="0" (
    echo ============================================================
    echo CINE CAMERA BLOCK REBUILD FAILED
    echo ============================================================
    echo.
    echo Leave this window open and send ChatGPT a screenshot.
    echo.
    pause
    exit /b %RESULT%
)

pause
exit /b 0
