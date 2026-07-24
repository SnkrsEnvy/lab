$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Green
Write-Host "GRAND CORE - MATERIAL REALISM UE 5.8 COMPATIBILITY FIX" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

$Project = Join-Path $PSScriptRoot "GrandCore.uproject"
$PythonFile = Join-Path $PSScriptRoot "Scripts\grandcore_material_realism.py"
$BackupDir = Join-Path $PSScriptRoot "ScriptsBackup_Before_MaterialRealism_UE58_Fix"

if (-not (Test-Path -LiteralPath $Project)) {
    throw "GrandCore.uproject was not found beside this repair."
}

if (-not (Test-Path -LiteralPath $PythonFile)) {
    throw "Scripts\grandcore_material_realism.py was not found."
}

Write-Host "Project:" -ForegroundColor Green
Write-Host $PSScriptRoot -ForegroundColor Green
Write-Host ""
Write-Host "Backing up grandcore_material_realism.py..." -ForegroundColor Green

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Copy-Item -LiteralPath $PythonFile `
    -Destination (Join-Path $BackupDir "grandcore_material_realism.py") `
    -Force

$content = [IO.File]::ReadAllText($PythonFile)

if (
    -not $content.Contains("MP_CUSTOM_DATA_0") -and
    -not $content.Contains("MP_CUSTOM_DATA_1")
) {
    Write-Host "The Unreal 5.8 material compatibility correction is already present." -ForegroundColor Yellow
}
else {
    Write-Host "Removing unsupported clear-coat material output pins..." -ForegroundColor Green

    # UE 5.8 Python does not expose MP_CUSTOM_DATA_0 / MP_CUSTOM_DATA_1.
    # Preserve polished marble through Base Color, Normal, Roughness, AO and Specular.
    $content = $content.Replace(
        "unreal.MaterialShadingModel.MSM_CLEAR_COAT",
        "unreal.MaterialShadingModel.MSM_DEFAULT_LIT"
    )

    $startMarker = "    clear_coat = scalar_node(material, 0.72, -250, 620)"
    $endMarker = "    compile_material(material, ""marble"")"

    $startIndex = $content.IndexOf($startMarker)
    if ($startIndex -lt 0) {
        throw "The marble clear-coat block start was not found."
    }

    $endIndex = $content.IndexOf($endMarker, $startIndex)
    if ($endIndex -lt 0) {
        throw "The marble compile marker was not found after the clear-coat block."
    }

    $replacement = @'
    # UE 5.8 Python does not expose the clear-coat Custom Data output pins.
    # The marble remains polished through its controlled roughness and specular response.

'@

    $content = (
        $content.Substring(0, $startIndex) +
        $replacement +
        $content.Substring($endIndex)
    )

    [IO.File]::WriteAllText(
        $PythonFile,
        $content,
        (New-Object Text.UTF8Encoding($false))
    )
}

$verify = [IO.File]::ReadAllText($PythonFile)

if ($verify.Contains("MP_CUSTOM_DATA_0")) {
    throw "MP_CUSTOM_DATA_0 still remains in the repaired Python file."
}

if ($verify.Contains("MP_CUSTOM_DATA_1")) {
    throw "MP_CUSTOM_DATA_1 still remains in the repaired Python file."
}

if (-not $verify.Contains("unreal.MaterialShadingModel.MSM_DEFAULT_LIT")) {
    throw "The UE 5.8-safe marble shading model could not be verified."
}

if (-not $verify.Contains('compile_material(material, "marble")')) {
    throw "The marble compile call could not be verified."
}

$BundledPython = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\ThirdParty\Python3\Win64\python.exe"

if (Test-Path -LiteralPath $BundledPython) {
    Write-Host "Validating the complete Python file with Unreal's bundled parser..." -ForegroundColor Green
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
    Write-Host "Unreal's bundled Python was not found; structural checks passed." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "MATERIAL REALISM UE 5.8 FIX APPLIED SUCCESSFULLY" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
