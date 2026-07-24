$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Green
Write-Host "GRAND CORE - CAMERA AND WORLD BLOCK RECOVERY" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

$Project = Join-Path $PSScriptRoot "GrandCore.uproject"
$PythonFile = Join-Path $PSScriptRoot "Scripts\build_master_shell.py"
$BackupDir = Join-Path $PSScriptRoot "ScriptsBackup_Before_CameraWorld_Recovery"

if (-not (Test-Path -LiteralPath $Project)) {
    throw "GrandCore.uproject was not found beside this recovery tool."
}

if (-not (Test-Path -LiteralPath $PythonFile)) {
    throw "Scripts\build_master_shell.py was not found."
}

Write-Host "Project:" -ForegroundColor Green
Write-Host $PSScriptRoot -ForegroundColor Green
Write-Host ""
Write-Host "Backing up the current Python shell builder..." -ForegroundColor Green

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Copy-Item -LiteralPath $PythonFile `
    -Destination (Join-Path $BackupDir "build_master_shell.py") `
    -Force

$content = [IO.File]::ReadAllText($PythonFile)

$cameraStart = "    for label, loc, target in cameras:"
$mainStart = "def main():"

$cameraIndex = $content.IndexOf($cameraStart)
if ($cameraIndex -lt 0) {
    throw "The camera-loop start line was not found."
}

$mainIndex = $content.IndexOf($mainStart, $cameraIndex)
if ($mainIndex -lt 0) {
    throw "The def main() marker was not found after the camera loop."
}

Write-Host "Replacing the complete camera and world-settings region..." -ForegroundColor Green

$cleanRegion = @'
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

    # World settings.
    world = unreal.EditorLevelLibrary.get_editor_world()
    world_settings = world.get_world_settings()
    safe_set(world_settings, "force_no_precomputed_lighting", True)
    game_mode = unreal.load_class(None, "/Script/GrandCore.GrandCoreGameMode")
    if game_mode:
        safe_set(world_settings, "default_game_mode", game_mode)


'@

$content = $content.Substring(0, $cameraIndex) + $cleanRegion + $content.Substring($mainIndex)

# Preserve the already-required Unreal 5.8 texture-filter correction.
$content = $content.Replace(
    "unreal.TextureFilter.TF_ANISOTROPIC",
    "unreal.TextureFilter.TF_DEFAULT"
)

[IO.File]::WriteAllText(
    $PythonFile,
    $content,
    (New-Object Text.UTF8Encoding($false))
)

$verify = [IO.File]::ReadAllText($PythonFile)

$required = @(
    'camera.get_cine_camera_component()',
    'safe_set(camera_component, "current_focal_length", 22.0)',
    'safe_set(camera_component, "current_aperture", 5.6)',
    'world = unreal.EditorLevelLibrary.get_editor_world()',
    'def main():',
    'unreal.TextureFilter.TF_DEFAULT'
)

foreach ($item in $required) {
    if (-not $verify.Contains($item)) {
        throw "Verification failed. Missing expected text: $item"
    }
}

$forbidden = @(
    'camera.cine_camera_component',
    'safe_set(camera_component, "current_focal_length, 22.0)',
    'unreal.TextureFilter.TF_ANISOTROPIC'
)

foreach ($item in $forbidden) {
    if ($verify.Contains($item)) {
        throw "Verification failed. Damaged or obsolete text remains: $item"
    }
}

$BundledPython = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\ThirdParty\Python3\Win64\python.exe"

if (Test-Path -LiteralPath $BundledPython) {
    Write-Host "Validating the entire file with Unreal's bundled Python..." -ForegroundColor Green
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
    Write-Host "Unreal bundled Python was not found; structural verification passed." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "CAMERA AND WORLD BLOCK RECOVERED SUCCESSFULLY" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next:" -ForegroundColor Green
Write-Host "1. Close this window." -ForegroundColor Green
Write-Host "2. Run BUILD-AND-OPEN-GRANDCORE-SHELL.cmd." -ForegroundColor Green
Write-Host "3. Wait for MASTER SHELL GENERATED SUCCESSFULLY." -ForegroundColor Green
Write-Host ""
