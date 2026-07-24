@echo off
setlocal EnableExtensions

title GRAND CORE - VISUAL CALIBRATION V2
color 0A

echo ============================================================
echo GRAND CORE - VISUAL CALIBRATION V2
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "PYTHON=%~dp0Scripts\grandcore_visual_calibration_v2.py"
set "ENGINE=C:\Program Files\Epic Games\UE_5.8"
set "EDITORCMD=%ENGINE%\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
set "EDITOR=%ENGINE%\Engine\Binaries\Win64\UnrealEditor.exe"
set "MAP=/Game/GrandCore/Maps/L_MasterShell"
set "SUCCESS=%~dp0Saved\GrandCoreVisualCalibrationV2Success.txt"
set "REPORT=%~dp0Saved\GrandCoreVisualCalibrationV2Report.txt"

if not exist "%PROJECT%" (
    echo ERROR: GrandCore.uproject was not found beside this tool.
    echo Extract this package directly into GrandCoreRepo\lab\unreal.
    echo.
    pause
    exit /b 1
)

if not exist "%PYTHON%" (
    echo ERROR: Scripts\grandcore_visual_calibration_v2.py was not found.
    echo Extract the entire ZIP, including its Scripts folder.
    echo.
    pause
    exit /b 1
)

if not exist "%EDITORCMD%" (
    echo ERROR: UnrealEditor-Cmd.exe was not found at:
    echo %EDITORCMD%
    echo.
    pause
    exit /b 1
)

if exist "%SUCCESS%" del /Q "%SUCCESS%" >nul 2>&1

echo This pass preserves geometry, materials, and all 97 actors.
echo.
echo It lowers only:
echo - exposure compensation
echo - Skylight intensity
echo - three calibration fill lights
echo - cove-light intensity
echo - perimeter-uplight intensity
echo - bloom and indirect-light amplification
echo.
echo Running the calibration itself in safe DX11 mode...
echo.

call "%EDITORCMD%" "%PROJECT%" -run=pythonscript -script="%PYTHON%" -unattended -nop4 -nosplash -NoSound -d3d11 -sm5 -stdout -FullStdOutLogOutput -ExecCmds="r.Shadow.Virtual.Enable 0,r.RayTracing.Enable 0"

set "RESULT=%ERRORLEVEL%"
echo.
echo ============================================================

if exist "%SUCCESS%" (
    echo GRAND CORE VISUAL CALIBRATION V2 SUCCEEDED
    echo ============================================================
    echo.
    type "%SUCCESS%"
    echo.
    echo Opening L_MasterShell through the stable DX11 path...
    echo.
    start "" "%EDITOR%" "%PROJECT%" "%MAP%" -d3d11 -sm5 -log -ExecCmds="r.Shadow.Virtual.Enable 0,r.RayTracing.Enable 0"
    echo.
    echo After Unreal opens:
    echo 1. Wait for shader compilation to finish.
    echo 2. Select Lit mode.
    echo 3. Search GC_Hero_Center.
    echo 4. Right-click it and choose Pilot.
    echo.
    pause
    exit /b 0
)

echo GRAND CORE VISUAL CALIBRATION V2 FAILED
echo ============================================================
echo.
echo Unreal returned exit code %RESULT%.
echo.
echo Report:
echo %REPORT%
echo.
if exist "%REPORT%" start "" notepad.exe "%REPORT%"
echo Leave this window open and send the report or a screenshot.
echo.
pause
exit /b 1
