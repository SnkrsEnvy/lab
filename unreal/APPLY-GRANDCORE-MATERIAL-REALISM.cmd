@echo off
setlocal EnableExtensions

title GRAND CORE - MATERIAL REALISM PASS
color 0A

echo ============================================================
echo GRAND CORE - MATERIAL REALISM PASS
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "PYTHON=%~dp0Scripts\grandcore_material_realism.py"
set "ENGINE=C:\Program Files\Epic Games\UE_5.8"
set "EDITORCMD=%ENGINE%\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
set "EDITOR=%ENGINE%\Engine\Binaries\Win64\UnrealEditor.exe"
set "MAP=/Game/GrandCore/Maps/L_MasterShell"
set "SUCCESS=%~dp0Saved\GrandCoreMaterialRealismSuccess.txt"
set "REPORT=%~dp0Saved\GrandCoreMaterialRealismReport.txt"

if not exist "%PROJECT%" (
    echo ERROR: GrandCore.uproject was not found beside this tool.
    echo Extract the complete ZIP directly into GrandCoreRepo\lab\unreal.
    echo.
    pause
    exit /b 1
)

if not exist "%PYTHON%" (
    echo ERROR: Scripts\grandcore_material_realism.py was not found.
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

echo This pass is non-destructive and reversible.
echo.
echo It will:
echo - preserve the 80 x 40 x 20 ft shell and all 97 actors
echo - preserve the stable Visual Calibration V2 exposure
echo - build separate realism materials from the existing 8K/4K maps
echo - reassign marble, camel velvet, plaster, and bronze by actor label
echo - soften the remaining floor-level hotspots
echo - save a complete rollback record
echo - create an optional backup level
echo.
echo Running through the stable DX11 / SM5 path...
echo.

call "%EDITORCMD%" "%PROJECT%" -run=pythonscript -script="%PYTHON%" -unattended -nop4 -nosplash -NoSound -d3d11 -sm5 -stdout -FullStdOutLogOutput -ExecCmds="r.Shadow.Virtual.Enable 0,r.RayTracing.Enable 0"

set "RESULT=%ERRORLEVEL%"
echo.
echo ============================================================

if exist "%SUCCESS%" (
    echo GRAND CORE MATERIAL REALISM PASS SUCCEEDED
    echo ============================================================
    echo.
    type "%SUCCESS%"
    echo.
    echo Opening L_MasterShell through the stable DX11 review path...
    echo.
    start "" "%EDITOR%" "%PROJECT%" "%MAP%" -d3d11 -sm5 -log -ExecCmds="r.Shadow.Virtual.Enable 0,r.RayTracing.Enable 0"
    echo.
    echo After Unreal opens:
    echo 1. Wait until shader compilation finishes.
    echo 2. Keep Lit mode selected.
    echo 3. Pilot GC_Hero_Center.
    echo 4. Press G once for a clean Game View.
    echo 5. Capture the screenshot.
    echo.
    pause
    exit /b 0
)

echo GRAND CORE MATERIAL REALISM PASS FAILED
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
