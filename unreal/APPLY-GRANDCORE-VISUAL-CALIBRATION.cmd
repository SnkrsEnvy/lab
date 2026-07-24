@echo off
setlocal EnableExtensions

title GRAND CORE - VISUAL CALIBRATION PASS
color 0A

echo ============================================================
echo GRAND CORE - VISUAL CALIBRATION PASS
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "PYTHON=%~dp0Scripts\grandcore_visual_calibration.py"
set "ENGINE=C:\Program Files\Epic Games\UE_5.8"
set "EDITORCMD=%ENGINE%\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
set "EDITOR=%ENGINE%\Engine\Binaries\Win64\UnrealEditor.exe"
set "MAP=/Game/GrandCore/Maps/L_MasterShell"
set "SUCCESS=%~dp0Saved\GrandCoreVisualCalibrationSuccess.txt"
set "REPORT=%~dp0Saved\GrandCoreVisualCalibrationReport.txt"

if not exist "%PROJECT%" (
    echo ERROR: GrandCore.uproject was not found beside this tool.
    echo.
    echo Extract this package directly into:
    echo GrandCoreRepo\lab\unreal
    echo.
    pause
    exit /b 1
)

if not exist "%PYTHON%" (
    echo ERROR: Scripts\grandcore_visual_calibration.py was not found.
    echo Extract the complete ZIP, including its Scripts folder.
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

echo Project:
echo %PROJECT%
echo.
echo Applying the non-destructive visual calibration pass...
echo.
echo This stage:
echo - preserves all existing shell geometry
echo - disables invalid Skylight real-time capture
echo - refreshes and reapplies the five master materials
echo - calibrates interior exposure and Lumen settings
echo - balances cove, perimeter, and broad fill lighting
echo - updates the four hero cameras
echo - saves L_MasterShell
echo.
echo This can take several minutes while materials and shaders refresh.
echo.

call "%EDITORCMD%" "%PROJECT%" -run=pythonscript -script="%PYTHON%" -unattended -nop4 -nosplash -NoSound -stdout -FullStdOutLogOutput

set "RESULT=%ERRORLEVEL%"
echo.
echo ============================================================

if exist "%SUCCESS%" (
    echo GRAND CORE VISUAL CALIBRATION SUCCEEDED
    echo ============================================================
    echo.
    type "%SUCCESS%"
    echo.
    echo Opening L_MasterShell in Unreal Editor...
    echo The first Lit-mode view may continue compiling shaders.
    echo.
    start "" "%EDITOR%" "%PROJECT%" "%MAP%" -log
    echo.
    echo Unreal launch command sent.
    echo After the editor opens:
    echo 1. Choose Lit mode.
    echo 2. Search GC_Hero_Center in the Outliner.
    echo 3. Right-click it and choose Pilot.
    echo 4. Wait for shader compilation to finish.
    echo.
    pause
    exit /b 0
)

echo GRAND CORE VISUAL CALIBRATION FAILED
echo ============================================================
echo.
echo Unreal returned exit code %RESULT%.
echo.
echo The detailed calibration report is:
echo %REPORT%
echo.
if exist "%REPORT%" start "" notepad.exe "%REPORT%"
echo Leave this window open and send ChatGPT the report or a screenshot.
echo.
pause
exit /b 1
