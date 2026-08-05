param(
    [Parameter(Mandatory = $true)]
    [string]$RegistrationToken,

    [string]$RepositoryUrl = "https://github.com/SnkrsEnvy/lab",
    [string]$RunnerRoot = "C:\actions-runner-hcl-pod"
)

$ErrorActionPreference = "Stop"

if (-not [Environment]::Is64BitOperatingSystem) {
    throw "A 64-bit Windows workstation is required."
}

if (-not (Test-Path $RunnerRoot)) {
    New-Item -ItemType Directory -Path $RunnerRoot -Force | Out-Null
}

$runnerZip = Join-Path $RunnerRoot "actions-runner-win-x64.zip"
$releaseApi = "https://api.github.com/repos/actions/runner/releases/latest"
$headers = @{ "User-Agent" = "HCL-POD-IMM-001-Runner-Setup" }
$release = Invoke-RestMethod -Uri $releaseApi -Headers $headers
$asset = $release.assets | Where-Object { $_.name -match '^actions-runner-win-x64-.*\.zip$' } | Select-Object -First 1

if (-not $asset) {
    throw "Could not locate the latest Windows x64 GitHub Actions runner package."
}

Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $runnerZip -Headers $headers
Expand-Archive -Path $runnerZip -DestinationPath $RunnerRoot -Force
Remove-Item $runnerZip -Force

Push-Location $RunnerRoot
try {
    & .\config.cmd --unattended `
        --url $RepositoryUrl `
        --token $RegistrationToken `
        --name "HCL-POD-UE58" `
        --labels "ue58,hcl-pod" `
        --work "_work" `
        --replace

    if ($LASTEXITCODE -ne 0) {
        throw "GitHub Actions runner registration failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

Write-Host "Runner registered at $RunnerRoot"
Write-Host "Start it in the signed-in Windows GPU session with:"
Write-Host "  $RunnerRoot\run.cmd"
