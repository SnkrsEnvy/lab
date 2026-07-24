@echo off
setlocal EnableExtensions

title GRAND CORE - DX12 VSM OFF
color 0A

echo ============================================================
echo GRAND CORE - DX12 LAUNCH, VIRTUAL SHADOW MAPS OFF
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "ENGINE=C:\Program Files\Epic Games\UE_5.8"
set "EDITOR=%ENGINE%\Engine\Binaries\Win64\UnrealEditor.exe"
set "MAP=/Game/GrandCore/Maps/L_MasterShell"

if not exist "%PROJECT%" (
    echo ERROR: GrandCore.uproject was not found beside this launcher.
    echo Place this file inside GrandCoreRepo\lab\unreal.
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

echo Launching DX12 with Virtual Shadow Maps and ray tracing disabled.
echo Use the DX11 launcher first for the stable demo.
echo.

start "" "%EDITOR%" "%PROJECT%" "%MAP%" -d3d12 -log -ExecCmds="r.Shadow.Virtual.Enable 0,r.RayTracing.Enable 0"

echo Unreal launch command sent.
echo.
pause
exit /b 0
