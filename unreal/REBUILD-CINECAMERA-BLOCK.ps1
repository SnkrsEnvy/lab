$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Green
Write-Host "GRAND CORE - CINE CAMERA BLOCK REBUILD" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

$Project = Join-Path $PSScriptRoot "GrandCore.uproject"
$PythonFile = Join-Path $PSScriptRoot "Scripts\build_master_shell.py"
$BackupDir = Join-Path $PSScriptRoot "ScriptsBackup_Before_CineCamera_Block_Rebuild"

if (-not (Test-Path -LiteralPath $Project)) {
    throw "GrandCore.uproject was not found beside this repair."
}

if (-not (Test-Path -LiteralPath $PythonFile)) {
    throw "Scripts\build_master_shell.py was not found."
}

Write-Host "Project:" -ForegroundColor Green
Write-Host $PSScriptRoot -ForegroundColor Green
Write-Host ""
Write-Host "Backing up build_master_shell.py..." -ForegroundColor Green

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Copy-Item -LiteralPath $PythonFile `
    -Destination (Join-Path $BackupDir "build_master_shell.py") `
    -Force

$content = [IO.File]::ReadAllText($PythonFile)

$startMarker = "    for label, loc, target in cameras:"
$endMarker = "    # World settings."

$startIndex = $content.IndexOf($startMarker)
if ($startIndex -lt 0) {
    throw "The camera-loop start marker was not found."
}

$endIndex = $content.IndexOf($endMarker, $startIndex)
if ($endIndex -lt 0) {
    throw "The World settings marker was not found after the camera loop."
}

Write-Host "Replacing the complete camera-construction block..." -ForegroundColor Green

$newBlock = @'
    for label, loc, target in cameras:
        camera = actor_subsystem.spawn_actor_from_class(
            unreal.CineCameraActor,
            unreal.Vector(*loc),
            look_at_rotation(loc, target),
        )
        camera.set_actor_label(f"GC_{label}")
        camera_component = camera.get_cine_camera_component()
        if camera_component:
            safe_set(camera_component, "current_focal_length", 22.0)
            safe_set(camera_component, "current_aperture", 5.6)

'@

$content = $content.Substring(0, $startIndex) + $newBlock + $content.Substring($endIndex)
[IO.File]::WriteAllText(
    $PythonFile,
    $content,
    (New-Object Text.UTF8Encoding($false))
)

$verify = [IO.File]::ReadAllText($PythonFile)

if ($verify.Contains('camera.cine_camera_component')) {
    throw "Old direct camera-component access still remains."
}

if (-not $verify.Contains('camera.get_cine_camera_component()')) {
    throw "The corrected Cine Camera API call could not be verified."
}

if (-not $verify.Contains('safe_set(camera_component, "current_focal_length", 22.0)')) {
    throw "The corrected focal-length line could not be verified."
}

if (-not $verify.Contains('safe_set(camera_component, "current_aperture", 5.6)')) {
    throw "The corrected aperture line could not be verified."
}

if ($verify.Contains('safe_set(camera_component, "current_focal_length, 22.0)')) {
    throw "The malformed focal-length line still remains."
}

$BundledPython = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\ThirdParty\Python3\Win64\python.exe"

if (Test-Path -LiteralPath $BundledPython) {
    Write-Host "Checking Python syntax with Unreal's bundled Python..." -ForegroundColor Green
    & $BundledPython -m py_compile $PythonFile

    if ($LASTEXITCODE -ne 0) {
        throw "Python syntax validation failed."
    }

    $PyCache = Join-Path (Split-Path $PythonFile) "__pycache__"
    if (Test-Path -LiteralPath $PyCache) {
        Remove-Item -LiteralPath $PyCache -Recurse -Force
    }
}
else {
    Write-Host "Bundled Python executable was not found; text verification passed." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "CINE CAMERA BLOCK REBUILT SUCCESSFULLY" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next:" -ForegroundColor Green
Write-Host "1. Close this window." -ForegroundColor Green
Write-Host "2. Run BUILD-AND-OPEN-GRANDCORE-SHELL.cmd again." -ForegroundColor Green
Write-Host "3. Wait for MASTER SHELL GENERATED SUCCESSFULLY." -ForegroundColor Green
Write-Host ""
