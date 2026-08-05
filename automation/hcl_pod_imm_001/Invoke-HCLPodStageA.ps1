param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("preflight", "interactive-stage-a", "package-return")]
    [string]$Mode,

    [Parameter(Mandatory = $true)]
    [string]$EngineRoot,

    [Parameter(Mandatory = $true)]
    [string]$TransferKitRoot,

    [Parameter(Mandatory = $true)]
    [string]$EvidenceRoot,

    [Parameter(Mandatory = $true)]
    [string]$RepositoryRoot
)

$ErrorActionPreference = "Stop"
$ExpectedGlbSha256 = "4e3ff72c99805b7a80bbd2b57b999dfed7c8f30f926874d51c1ba7ebf60c8402"
$ProjectFile = Join-Path $RepositoryRoot "unreal\GrandCore.uproject"
$UnrealEditor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor.exe"
$UnrealEditorCmd = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$RunReceipt = Join-Path $EvidenceRoot "automation\GITHUB_STAGE_A_RECEIPT.txt"
$LogDir = Join-Path $EvidenceRoot "automation\logs"

function Ensure-Directory([string]$Path) {
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Find-FrozenGlb {
    $matches = Get-ChildItem -Path $TransferKitRoot -Filter "HCL_POD_3D_002_review_model_v001.glb" -File -Recurse -ErrorAction SilentlyContinue
    if (-not $matches) {
        throw "Frozen source GLB was not found under $TransferKitRoot"
    }
    if ($matches.Count -gt 1) {
        throw "More than one frozen source GLB was found. Resolve ambiguity before execution."
    }
    return $matches[0].FullName
}

function Write-Receipt([string[]]$Lines) {
    Ensure-Directory (Split-Path $RunReceipt -Parent)
    $Lines | Set-Content -Path $RunReceipt -Encoding UTF8
}

function Invoke-Preflight {
    Ensure-Directory $EvidenceRoot
    Ensure-Directory $LogDir

    if (-not (Test-Path $UnrealEditor)) {
        throw "UnrealEditor.exe was not found at $UnrealEditor"
    }
    if (-not (Test-Path $UnrealEditorCmd)) {
        throw "UnrealEditor-Cmd.exe was not found at $UnrealEditorCmd"
    }
    if (-not (Test-Path $ProjectFile)) {
        throw "GrandCore.uproject was not found at $ProjectFile"
    }
    if (-not (Test-Path $TransferKitRoot)) {
        throw "Transfer kit root was not found at $TransferKitRoot"
    }

    $glb = Find-FrozenGlb
    $actualHash = (Get-FileHash -Path $glb -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $ExpectedGlbSha256) {
        throw "Frozen GLB hash mismatch. Expected $ExpectedGlbSha256 but found $actualHash"
    }

    $projectJson = Get-Content -Path $ProjectFile -Raw | ConvertFrom-Json
    if ($projectJson.EngineAssociation -ne "5.8") {
        throw "GrandCore.uproject EngineAssociation is not 5.8."
    }

    $receiptLines = @(
        "HCL-POD-IMM-001 GITHUB PREFLIGHT: PASS",
        "UTC: $([DateTime]::UtcNow.ToString('o'))",
        "Repository: $RepositoryRoot",
        "Project: $ProjectFile",
        "Engine root: $EngineRoot",
        "UnrealEditor: $UnrealEditor",
        "Transfer kit: $TransferKitRoot",
        "Frozen GLB: $glb",
        "Frozen GLB SHA-256: $actualHash",
        "Evidence root: $EvidenceRoot",
        "Authority: HCL-POD-3D-002 spatial truth; HCL-POD-3D-003-R1 visual target",
        "Pipeline: Unreal 5.8 first -> bounded Blender -> Unreal 5.8 final proof"
    )
    Write-Receipt $receiptLines
    Write-Host ($receiptLines -join [Environment]::NewLine)
}

function Invoke-InteractiveStageA {
    Invoke-Preflight

    $sessionLog = Join-Path $LogDir "UNREAL_INTERACTIVE_SESSION.txt"
    @(
        "HCL-POD-IMM-001 INTERACTIVE STAGE A SESSION",
        "Started UTC: $([DateTime]::UtcNow.ToString('o'))",
        "Required map: HCL_POD_IMM_001_ReviewMap",
        "Required content path: /Game/HCL_POD/IMM_001/",
        "Do not modify the frozen GLB.",
        "Follow the A0 quick start and evidence checklist.",
        "Close Unreal only after save, fresh reopen, inspection, screenshots, and walkthrough evidence are complete."
    ) | Set-Content -Path $sessionLog -Encoding UTF8

    Write-Host "Launching Unreal Engine 5.8 in the signed-in interactive GPU session..."
    $process = Start-Process -FilePath $UnrealEditor -ArgumentList @(
        $ProjectFile,
        "-log",
        "-NoSplash"
    ) -PassThru

    Write-Host "Unreal process ID: $($process.Id)"
    Write-Host "Complete the controlled operator session. The workflow will wait until Unreal closes."
    Wait-Process -Id $process.Id

    @(
        "Unreal closed UTC: $([DateTime]::UtcNow.ToString('o'))",
        "Process exit code: $($process.ExitCode)"
    ) | Add-Content -Path $sessionLog -Encoding UTF8

    Invoke-PackageReturn
}

function Invoke-PackageReturn {
    Ensure-Directory $EvidenceRoot
    Ensure-Directory $LogDir

    $files = Get-ChildItem -Path $EvidenceRoot -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '\\SHA256SUMS\.txt$' }

    $ledger = Join-Path $EvidenceRoot "SHA256SUMS.txt"
    $lines = foreach ($file in $files) {
        $hash = (Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        $relative = [IO.Path]::GetRelativePath($EvidenceRoot, $file.FullName)
        "$hash  $relative"
    }
    $lines | Sort-Object | Set-Content -Path $ledger -Encoding UTF8

    $zipPath = Join-Path (Split-Path $EvidenceRoot -Parent) "HCL_POD_IMM_001_STAGE_A_RETURN.zip"
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }
    Compress-Archive -Path (Join-Path $EvidenceRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal

    $zipHash = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    @(
        "HCL-POD-IMM-001 STAGE A RETURN PACKAGED",
        "UTC: $([DateTime]::UtcNow.ToString('o'))",
        "Evidence root: $EvidenceRoot",
        "Archive: $zipPath",
        "Archive SHA-256: $zipHash",
        "Claim boundary: packaging does not establish visual or runtime approval"
    ) | Set-Content -Path (Join-Path $EvidenceRoot "automation\PACKAGE_RETURN_RECEIPT.txt") -Encoding UTF8

    Write-Host "Stage A return packaged: $zipPath"
    Write-Host "SHA-256: $zipHash"
}

switch ($Mode) {
    "preflight" { Invoke-Preflight }
    "interactive-stage-a" { Invoke-InteractiveStageA }
    "package-return" { Invoke-PackageReturn }
}
