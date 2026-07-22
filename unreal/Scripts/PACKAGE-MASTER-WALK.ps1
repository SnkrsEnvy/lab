$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Project = Join-Path $ProjectRoot 'GrandCore.uproject'
$Output = Join-Path $ProjectRoot 'Builds\Windows'
$UE = 'C:\Program Files\Epic Games\UE_5.8'
if (-not (Test-Path $UE)) { throw 'Edit Scripts\PACKAGE-MASTER-WALK.ps1 if Unreal is installed elsewhere.' }
$RunUAT = Join-Path $UE 'Engine\Build\BatchFiles\RunUAT.bat'
& $RunUAT BuildCookRun -project="$Project" -noP4 -platform=Win64 -clientconfig=Shipping -build -cook -allmaps -stage -pak -iostore -archive -archivedirectory="$Output" -prereqs
if ($LASTEXITCODE -ne 0) { throw 'Packaging failed. See Saved\Logs.' }
Write-Host "Packaged build: $Output" -ForegroundColor Green
