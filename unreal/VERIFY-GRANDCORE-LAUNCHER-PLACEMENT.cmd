@echo off
setlocal EnableExtensions

title GRAND CORE - VERIFY SAFE LAUNCHER PLACEMENT
color 0A

echo ============================================================
echo GRAND CORE - VERIFY LAUNCHER PLACEMENT
echo ============================================================
echo.

echo Current folder:
echo %~dp0
echo.

if exist "%~dp0GrandCore.uproject" (
    echo SUCCESS: GrandCore.uproject is beside the launcher.
    echo The launcher is installed correctly.
    echo.
    pause
    exit /b 0
)

echo ERROR: GrandCore.uproject is not beside the launcher.
echo.
echo Move these launcher files into:
echo GrandCoreRepo\lab\unreal
echo.
pause
exit /b 1
