@echo off
setlocal EnableExtensions

title GRAND CORE - MATERIAL REALISM UE 5.8 FIX AND RUN
color 0A

echo ============================================================
echo GRAND CORE - MATERIAL REALISM UE 5.8 FIX AND RUN
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "PATCH=%~dp0PATCH-MATERIAL-REALISM-UE58.ps1"
set "PYTHON=%~dp0Scripts\grandcore_material_realism.py"
set "ENGINE=C:\Program Files\Epic Games\UE_5.8"
set "EDITORCMD=%ENGINE%\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
set "EDITOR=%ENGINE%\Engine\Binaries\Win64\UnrealEditor.exe"
set "MAP=/Game/GrandCore/Maps/L_MasterShell"
set "SUCCESS=%~dp0Saved\GrandCoreMaterialRealismSuccess.txt"
set "REPORT=%~dp0Saved\GrandCoreMaterialRealismReport.txt"

if not exist "%PROJECT%" (
    echo ERROR: GrandCore.uproject was not found beside this tool.
    echo.
    echo Extract the complete ZIP directly into:
    echo GrandCoreRepo\lab\unreal
    echo.
    pause
    exit /b 1
)

if not exist "%PATCH%" (
    echo ERROR: PATCH-MATERIAL-REALISM-UE58.ps1 was not found.
    echo Extract the complete ZIP and keep both repair files together.
    echo.
    pause
    exit /b 1
)

if not exist "%PYTHON%" (
    echo ERROR: Scripts\grandcore_material_realism.py was not found.
    echo Keep the previously installed Material Realism package in place.
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

echo Stage 1 of 2: repairing the unsupported UE 5.8 marble pins...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PATCH%"
if errorlevel 1 (
    echo.
    echo ============================================================
    echo MATERIAL REALISM UE 5.8 REPAIR FAILED
    echo ============================================================
    echo.
    echo Leave this window open and send ChatGPT a screenshot.
    echo.
    pause
    exit /b 1
)

if exist "%SUCCESS%" del /Q "%SUCCESS%" >nul 2>&1

echo.
echo Stage 2 of 2: rerunning the validated Material Realism Pass...
echo.
echo The previous attempt stopped before room materials and lights were changed.
echo The existing pre-realism backup level will be preserved.
echo.

call "%EDITORCMD%" "%PROJECT%" -run=pythonscript -script="%PYTHON%" -unattended -nop4 -nosplash -NoSound -d3d11 -sm5 -stdout -FullStdOutLogOutput -ExecCmds="r.Shadow.Virtual.Enable 0,r.RayTracing.Enable 0"

set "RESULT=%ERRORLEVEL%"
echo.
echo ============================================================

if exist "%SUCCESS%" (
    echo GRAND CORE MATERIAL REALISM V2 SUCCEEDED
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
    echo 4. Press G once to hide editor icons.
    echo 5. Capture the screenshot.
    echo.
    pause
    exit /b 0
)

echo GRAND CORE MATERIAL REALISM V2 FAILED
echo ============================================================
echo.
echo Unreal returned exit code %RESULT%.
echo.
echo Detailed report:
echo %REPORT%
echo.
if exist "%REPORT%" start "" notepad.exe "%REPORT%"
echo Leave this window open and send the report or a screenshot.
echo.
pause
exit /b 1
