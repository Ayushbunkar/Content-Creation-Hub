# scripts/install_prerequisites.ps1 - Automated Prerequisite Installer for AI Video Studio
[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "       AI VIDEO STUDIO - ENVIRONMENT & DEPENDENCY VALIDATOR         " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

$repoRoot = (Get-Item -Path $PSScriptRoot).Parent.FullName
Set-Location $repoRoot

function Refresh-Path {
    $sysPath = [System.Environment]::GetEnvironmentVariable('Path', [System.EnvironmentVariableTarget]::Machine)
    $usrPath = [System.Environment]::GetEnvironmentVariable('Path', [System.EnvironmentVariableTarget]::User)
    $localBin = Join-Path $repoRoot "bin\ffmpeg"
    $nodeDefault = "C:\Program Files\nodejs"
    $pyDefault = "C:\Program Files\Python311"
    $pyUser = Join-Path $env:LOCALAPPDATA "Programs\Python\Python311"
    $pyUserScripts = Join-Path $env:LOCALAPPDATA "Programs\Python\Python311\Scripts"

    $env:Path = "$localBin;$nodeDefault;$pyDefault;$pyUser;$pyUserScripts;$usrPath;$sysPath"
}

Refresh-Path

# ==========================================
# 1. NODE.JS CHECK & AUTO-INSTALL
# ==========================================
Write-Host "`n[1/3] Checking Node.js runtime..." -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "  -> Node.js not detected in PATH. Attempting automatic installation..." -ForegroundColor Magenta

    # Try winget first if available
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    $installed = $false
    if ($winget) {
        Write-Host "  -> Installing Node.js LTS via winget..." -ForegroundColor Gray
        Start-Process winget -ArgumentList "install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent" -Wait -NoNewWindow
        Refresh-Path
        if (Get-Command node -ErrorAction SilentlyContinue) { $installed = $true }
    }

    if (-not $installed) {
        Write-Host "  -> Downloading official Node.js v20 LTS MSI..." -ForegroundColor Gray
        $msiUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
        $msiFile = Join-Path $env:TEMP "node_setup.msi"
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
            Invoke-WebRequest -Uri $msiUrl -OutFile $msiFile -UseBasicParsing
            Write-Host "  -> Running silent MSI installation..." -ForegroundColor Gray
            Start-Process msiexec.exe -ArgumentList "/i `"$msiFile`" /qn /norestart" -Wait
            Remove-Item $msiFile -Force -ErrorAction SilentlyContinue
            Refresh-Path
        } catch {
            Write-Host "  -> Automatic Node.js download failed: $_" -ForegroundColor Red
        }
    }
}

Refresh-Path
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCheck) {
    $ver = & node -v
    Write-Host "  [OK] Node.js ready: $ver ($($nodeCheck.Source))" -ForegroundColor Green
} else {
    Write-Host "  [!] Node.js could not be installed automatically." -ForegroundColor Red
    Write-Host "      Please download & install Node.js (v20 or v22) from: https://nodejs.org/" -ForegroundColor Yellow
}

# ==========================================
# 2. PYTHON CHECK & AUTO-INSTALL
# ==========================================
Write-Host "`n[2/3] Checking Python 3.10+ runtime..." -ForegroundColor Yellow
$pyCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pyCmd) { $pyCmd = Get-Command py -ErrorAction SilentlyContinue }

if (-not $pyCmd) {
    Write-Host "  -> Python not detected in PATH. Attempting automatic installation..." -ForegroundColor Magenta
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    $installed = $false
    if ($winget) {
        Write-Host "  -> Installing Python 3.11 via winget..." -ForegroundColor Gray
        Start-Process winget -ArgumentList "install Python.Python.3.11 --accept-package-agreements --accept-source-agreements --silent" -Wait -NoNewWindow
        Refresh-Path
        if (Get-Command python -ErrorAction SilentlyContinue) { $installed = $true }
    }

    if (-not $installed) {
        Write-Host "  -> Downloading official Python 3.11 installer..." -ForegroundColor Gray
        $pyUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
        $pyFile = Join-Path $env:TEMP "python_setup.exe"
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
            Invoke-WebRequest -Uri $pyUrl -OutFile $pyFile -UseBasicParsing
            Write-Host "  -> Running silent Python installation..." -ForegroundColor Gray
            Start-Process $pyFile -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_pip=1" -Wait
            Remove-Item $pyFile -Force -ErrorAction SilentlyContinue
            Refresh-Path
        } catch {
            Write-Host "  -> Automatic Python download failed: $_" -ForegroundColor Red
        }
    }
}

Refresh-Path
$pyCheck = Get-Command python -ErrorAction SilentlyContinue
if (-not $pyCheck) { $pyCheck = Get-Command py -ErrorAction SilentlyContinue }

if ($pyCheck) {
    $pyVer = & $pyCheck.Name --version
    Write-Host "  [OK] Python ready: $pyVer" -ForegroundColor Green
} else {
    Write-Host "  [!] Python not found. Please install Python 3.10+ from https://python.org/ (Check 'Add Python to PATH')" -ForegroundColor Red
}

# ==========================================
# 3. FFMPEG CHECK & ZERO-ADMIN PORTABLE INSTALL
# ==========================================
Write-Host "`n[3/3] Checking FFmpeg multimedia engine..." -ForegroundColor Yellow
$ffmpegCmd = Get-Command ffmpeg -ErrorAction SilentlyContinue

if (-not $ffmpegCmd) {
    $binDir = Join-Path $repoRoot "bin\ffmpeg"
    $localFfmpeg = Join-Path $binDir "ffmpeg.exe"

    if (Test-Path $localFfmpeg) {
        Write-Host "  [OK] Local portable FFmpeg found at $binDir" -ForegroundColor Green
        $ffmpegCmd = $localFfmpeg
    } else {
        Write-Host "  -> FFmpeg missing. Downloading zero-admin portable FFmpeg binary..." -ForegroundColor Magenta
        New-Item -ItemType Directory -Path $binDir -Force | Out-Null
        $ffmpegZip = Join-Path $env:TEMP "ffmpeg_portable.zip"
        $zipUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"

        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
            Invoke-WebRequest -Uri $zipUrl -OutFile $ffmpegZip -UseBasicParsing
            Write-Host "  -> Extracting FFmpeg binaries..." -ForegroundColor Gray
            $extractDir = Join-Path $env:TEMP "ffmpeg_extract"
            Expand-Archive -Path $ffmpegZip -DestinationPath $extractDir -Force
            $foundExe = Get-ChildItem -Path $extractDir -Filter "ffmpeg.exe" -Recurse | Select-Object -First 1
            $foundProbe = Get-ChildItem -Path $extractDir -Filter "ffprobe.exe" -Recurse | Select-Object -First 1
            if ($foundExe) { Copy-Item $foundExe.FullName -Destination (Join-Path $binDir "ffmpeg.exe") -Force }
            if ($foundProbe) { Copy-Item $foundProbe.FullName -Destination (Join-Path $binDir "ffprobe.exe") -Force }
            Remove-Item $ffmpegZip -Force -ErrorAction SilentlyContinue
            Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
            Refresh-Path
            Write-Host "  [OK] Portable FFmpeg installed into $binDir" -ForegroundColor Green
        } catch {
            Write-Host "  -> Portable FFmpeg download failed: $_" -ForegroundColor Yellow
            Write-Host "  -> Trying winget fallback..." -ForegroundColor Gray
            Start-Process winget -ArgumentList "install -e --id Gyan.FFmpeg --accept-package-agreements --accept-source-agreements --silent" -Wait -NoNewWindow
            Refresh-Path
        }
    }
} else {
    Write-Host "  [OK] FFmpeg detected in system PATH." -ForegroundColor Green
}

# ==========================================
# 4. INITIALIZE DIRECTORIES & .ENV
# ==========================================
Write-Host "`n[4/4] Verifying project directories and configuration..." -ForegroundColor Yellow
$dirs = @(
    "storage",
    "storage\database",
    "storage\temp",
    "storage\clips",
    "storage\renders",
    "storage\documentary_assets",
    "output",
    "output\stream_clips",
    "public\audio\bgm",
    "public\videos\library"
)

foreach ($d in $dirs) {
    $fullPath = Join-Path $repoRoot $d
    if (-not (Test-Path $fullPath)) {
        New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
    }
}

$envFile = Join-Path $repoRoot ".env"
$envExample = Join-Path $repoRoot ".env.example"
if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile -Force
        Write-Host "  [OK] Created .env configuration from template." -ForegroundColor Green
    } else {
        @"
PORT=3000
APP_BASE_URL=http://127.0.0.1:3000
"@ | Set-Content -Path $envFile -Encoding utf8
        Write-Host "  [OK] Generated default .env file." -ForegroundColor Green
    }
} else {
    Write-Host "  [OK] .env file present." -ForegroundColor Green
}

Write-Host "`n[SUCCESS] Prerequisites check complete!" -ForegroundColor Cyan
