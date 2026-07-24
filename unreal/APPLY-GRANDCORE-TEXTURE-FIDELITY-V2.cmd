@echo off
setlocal EnableExtensions

title GRAND CORE - TEXTURE FIDELITY PASS V2
color 0A

echo ============================================================
echo GRAND CORE - TEXTURE FIDELITY PASS V2
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "SCRIPT=%~dp0Scripts\grandcore_texture_fidelity_v2.py"
set "ENGINE=C:\Program Files\Epic Games\UE_5.8"
set "EDITORCMD=%ENGINE%\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
set "EDITOR=%ENGINE%\Engine\Binaries\Win64\UnrealEditor.exe"
set "MAP=/Game/GrandCore/Maps/L_MasterShell"
set "SUCCESS=%~dp0Saved\GrandCoreTextureFidelitySuccess.txt"
set "REPORT=%~dp0Saved\GrandCoreTextureFidelityReport.txt"

if not exist "%PROJECT%" (
    echo ERROR: GrandCore.uproject was not found beside this tool.
    echo.
    echo Extract the ZIP contents directly into:
    echo GrandCoreRepo\lab\unreal
    echo.
    pause
    exit /b 1
)

if not exist "%SCRIPT%" (
    echo ERROR: Scripts\grandcore_texture_fidelity_v2.py was not found.
    echo Extract the complete ZIP, including the Scripts folder.
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

echo This pass preserves geometry, cameras, collision, actor count,
echo and Visual Calibration V2.
echo.
echo It creates a separate Fidelity material set, reduces texture repetition,
echo strengthens marble clarity and velvet response, softens uplight cones,
echo saves a rollback record, and opens the room through stable DX11.
echo.

call "%EDITORCMD%" "%PROJECT%" -run=pythonscript -script="%SCRIPT%" -unattended -nop4 -nosplash -NoSound -d3d11 -sm5 -stdout -FullStdOutLogOutput -ExecCmds="r.Shadow.Virtual.Enable 0,r.RayTracing.Enable 0"

set "RESULT=%ERRORLEVEL%"
echo.
echo ============================================================

if exist "%SUCCESS%" (
    echo GRAND CORE TEXTURE FIDELITY V2 SUCCEEDED
    echo ============================================================
    echo.
    type "%SUCCESS%"
    echo.
    echo Opening L_MasterShell through the stable DX11 review path...
    start "" "%EDITOR%" "%PROJECT%" "%MAP%" -d3d11 -sm5 -log -ExecCmds="r.Shadow.Virtual.Enable 0,r.RayTracing.Enable 0"
    echo.
    echo After Unreal opens:
    echo 1. Wait until shader compilation finishes.
    echo 2. Keep Lit mode selected.
    echo 3. Pilot GC_Hero_Center.
    echo 4. Press G once for a clean review.
    echo.
    pause
    exit /b 0
)

echo GRAND CORE TEXTURE FIDELITY V2 FAILED
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
