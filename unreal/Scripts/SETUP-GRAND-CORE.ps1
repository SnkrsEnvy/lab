$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Project = Join-Path $ProjectRoot 'GrandCore.uproject'
$BuildScript = Join-Path $ProjectRoot 'Scripts\build_master_shell.py'

function Find-UnrealRoot {
    $candidates = @(
        'C:\Program Files\Epic Games\UE_5.8',
        'C:\Program Files\Epic Games\UE_5.7',
        'D:\Epic Games\UE_5.8',
        'D:\Epic Games\UE_5.7'
    )
    foreach ($candidate in $candidates) {
        if (Test-Path (Join-Path $candidate 'Engine\Binaries\Win64\UnrealEditor.exe')) { return $candidate }
    }
    throw 'Unreal Engine 5.8 was not found. Install UE 5.8 in Epic Games Launcher, then run this again.'
}

$UE = Find-UnrealRoot
$UBT = Join-Path $UE 'Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe'
$BuildBat = Join-Path $UE 'Engine\Build\BatchFiles\Build.bat'
$EditorCmd = Join-Path $UE 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe'
$Editor = Join-Path $UE 'Engine\Binaries\Win64\UnrealEditor.exe'

Write-Host ''
Write-Host 'GRAND CORE — UNREAL MASTER SETUP' -ForegroundColor Yellow
Write-Host "Engine: $UE"
Write-Host "Project: $ProjectRoot"
Write-Host ''

Write-Host '[1/4] Generating Visual Studio project files...' -ForegroundColor Cyan
& $UBT -projectfiles "-project=$Project" -game -engine -progress
if ($LASTEXITCODE -ne 0) { throw 'Project-file generation failed. Install Visual Studio 2022 with Desktop development with C++ and Game development with C++.' }

Write-Host '[2/4] Compiling GrandCoreEditor...' -ForegroundColor Cyan
& $BuildBat GrandCoreEditor Win64 Development "-Project=$Project" -WaitMutex -FromMsBuild
if ($LASTEXITCODE -ne 0) { throw 'Compilation failed. Open the log above; Visual Studio C++ workloads may be missing.' }

Write-Host '[3/4] Building the exact shell, materials, lights and hero cameras...' -ForegroundColor Cyan
& $EditorCmd $Project -run=pythonscript "-script=$BuildScript" -unattended -nop4 -nosplash -NoSound -stdout -FullStdOutLogOutput
if ($LASTEXITCODE -ne 0) { throw 'The automated Unreal shell build failed. See Saved\Logs\GrandCore.log.' }

Write-Host '[4/4] Opening Unreal Editor on the master shell...' -ForegroundColor Cyan
Start-Process $Editor -ArgumentList @($Project, '/Game/GrandCore/Maps/L_MasterShell', '-log')
Write-Host ''
Write-Host 'Grand Core is opening. First shader compilation can take several minutes.' -ForegroundColor Green
Write-Host 'Press Play when the editor finishes compiling shaders.' -ForegroundColor Green
