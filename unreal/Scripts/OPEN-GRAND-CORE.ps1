$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Project = Join-Path $ProjectRoot 'GrandCore.uproject'
$candidates = @(
  'C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe',
  'C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe',
  'D:\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe'
)
$Editor = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Editor) { throw 'Unreal Editor not found. Install Unreal Engine 5.8.' }
Start-Process $Editor -ArgumentList @($Project, '/Game/GrandCore/Maps/L_MasterShell', '-log')
