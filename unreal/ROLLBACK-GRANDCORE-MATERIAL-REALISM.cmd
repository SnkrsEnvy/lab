@echo off
setlocal EnableExtensions

title GRAND CORE - MATERIAL REALISM ROLLBACK
color 0A

echo ============================================================
echo GRAND CORE - MATERIAL REALISM ROLLBACK
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "PYTHON=%~dp0Scripts\grandcore_material_realism_rollback.py"
set "ENGINE=C:\Program Files\Epic Games\UE_5.8"
set "EDITORCMD=%ENGINE%\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
set "REPORT=%~dp0Saved\GrandCoreMaterialRealismRollbackReport.txt"

if not exist "%PROJECT%" (
    echo ERROR: GrandCore.uproject was not found.
    pause
    exit /b 1
)

if not exist "%PYTHON%" (
    echo ERROR: Rollback Python script was not found.
    pause
    exit /b 1
)

call "%EDITORCMD%" "%PROJECT%" -run=pythonscript -script="%PYTHON%" -unattended -nop4 -nosplash -NoSound -d3d11 -sm5 -stdout -FullStdOutLogOutput -ExecCmds="r.Shadow.Virtual.Enable 0,r.RayTracing.Enable 0"

set "RESULT=%ERRORLEVEL%"
echo.

if "%RESULT%"=="0" (
    echo MATERIAL REALISM ROLLBACK COMPLETED
    echo.
    if exist "%REPORT%" type "%REPORT%"
    echo.
    pause
    exit /b 0
)

echo MATERIAL REALISM ROLLBACK FAILED
echo.
if exist "%REPORT%" start "" notepad.exe "%REPORT%"
pause
exit /b 1
