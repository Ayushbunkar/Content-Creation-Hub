# scripts/install.ps1 - Zero-Prerequisite 1-Command Bootstrapper for Windows
[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "       AI VIDEO STUDIO - 1-COMMAND ZERO-TOUCH BOOTSTRAPPER          " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "Setting up production studio workspace on your computer..." -ForegroundColor Gray

$targetDir = Join-Path $HOME "Content-Creation-Hub"
Write-Host "`n[1/3] Preparing workspace directory: $targetDir" -ForegroundColor Yellow

if (-not (Test-Path $targetDir)) {
    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if ($gitCmd) {
        Write-Host "  -> Cloning repository via Git..." -ForegroundColor Gray
        Set-Location $HOME
        git clone https://github.com/Ayushbunkar/Content-Creation-Hub.git
    } else {
        Write-Host "  -> Git not detected. Downloading package directly from GitHub..." -ForegroundColor Magenta
        $zipUrl = "https://github.com/Ayushbunkar/Content-Creation-Hub/archive/refs/heads/main.zip"
        $zipFile = Join-Path $env:TEMP "cch_download.zip"
        $extractDir = Join-Path $env:TEMP "cch_extract"

        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile -UseBasicParsing

        Write-Host "  -> Extracting repository files..." -ForegroundColor Gray
        Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force
        $inner = Join-Path $extractDir "Content-Creation-Hub-main"
        Move-Item -Path $inner -Destination $targetDir -Force
        Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
        Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "  -> Existing project directory found. Updating to latest version..." -ForegroundColor Green
    Set-Location $targetDir
    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if ($gitCmd -and (Test-Path ".git")) {
        git fetch origin main
        git reset --hard origin/main
    }
}

Set-Location $targetDir

Write-Host "`n[2/3] Launching autonomous prerequisite installer & dependency engine..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c setup.bat" -Wait -NoNewWindow

Write-Host "`n[3/3] AI Video Studio is now running on your machine!" -ForegroundColor Green
