@echo off
setlocal EnableExtensions

title GRAND CORE - GPU SAFE DX11
color 0A

echo ============================================================
echo GRAND CORE - GPU SAFE DX11 LAUNCH
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "ENGINE=C:\Program Files\Epic Games\UE_5.8"
set "EDITOR=%ENGINE%\Engine\Binaries\Win64\UnrealEditor.exe"
set "MAP=/Game/GrandCore/Maps/L_MasterShell"

echo Launcher folder:
echo %~dp0
echo.

if not exist "%PROJECT%" (
    echo ERROR: GrandCore.uproject was not found beside this launcher.
    echo.
    echo Correct location:
    echo GrandCoreRepo\lab\unreal
    echo.
    echo Move OPEN-GRANDCORE-GPU-SAFE-DX11.cmd into the folder that
    echo already contains GrandCore.uproject, then run it again.
    echo.
    pause
    exit /b 1
)

if not exist "%EDITOR%" (
    echo ERROR: UnrealEditor.exe was not found at:
    echo %EDITOR%
    echo.
    pause
    exit /b 1
)

echo Placement verified.
echo Project:
echo %PROJECT%
echo.
echo Launching L_MasterShell with:
echo - Direct3D 11
echo - Shader Model 5
echo - Virtual Shadow Maps off
echo - Hardware ray tracing off
echo.

start "" "%EDITOR%" "%PROJECT%" "%MAP%" -d3d11 -sm5 -log -ExecCmds="r.Shadow.Virtual.Enable 0,r.RayTracing.Enable 0"

echo Unreal launch command sent.
echo.
echo After Unreal opens:
echo 1. Wait until shader compilation is finished.
echo 2. Keep Lit mode selected.
echo 3. Search GC_Hero_Center.
echo 4. Right-click it and choose Pilot.
echo 5. Press G once for a clean view.
echo.
pause
exit /b 0
