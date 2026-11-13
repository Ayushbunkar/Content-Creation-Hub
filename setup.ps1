Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "             AI VIDEO STUDIO - 1-CLICK AUTOMATIC SETUP              " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "This script will install all dependencies, configure local AI engines,"
Write-Host "and create a ready-to-run Desktop App icon on your Desktop.`n"

# 1. Check Node.js
Write-Host "[CHECK 1/3] Checking Node.js..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = node -v
    Write-Host "[OK] Node.js detected: $nodeVer" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Node.js is not installed! Download from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# 2. Check Python
Write-Host "[CHECK 2/3] Checking Python..." -ForegroundColor Yellow
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
}

if ($pythonCmd) {
    $pyVer = & $pythonCmd --version
    Write-Host "[OK] Python detected: $pyVer" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Python is not installed! Download from https://python.org" -ForegroundColor Red
    exit 1
}

# 3. Check FFmpeg
Write-Host "[CHECK 3/3] Checking FFmpeg..." -ForegroundColor Yellow
if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    Write-Host "[OK] FFmpeg detected in system PATH." -ForegroundColor Green
} else {
    Write-Host "[WARNING] FFmpeg not found! Attempting winget install..." -ForegroundColor Yellow
    winget install -e --id Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
}

# 4. Storage Folders
Write-Host "`n[STEP 1/5] Preparing project storage directories..." -ForegroundColor Yellow
$dirs = @(
    "storage/database",
    "storage/temp",
    "storage/clips",
    "storage/renders",
    "storage/documentary_assets",
    "public/audio/bgm",
    "public/videos/library"
)
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}
Write-Host "[OK] Storage directories ready." -ForegroundColor Green

# 5. NPM Install
Write-Host "`n[STEP 2/5] Installing Node.js packages (npm install)..." -ForegroundColor Yellow
npm install

# 6. Python Virtual Environment
Write-Host "`n[STEP 3/5] Setting up local Python AI environment (.venv-tts)..." -ForegroundColor Yellow
if (-not (Test-Path ".venv-tts/Scripts/python.exe")) {
    & $pythonCmd -m venv .venv-tts
}
& .venv-tts/Scripts/python.exe -m pip install --upgrade pip --quiet
& .venv-tts/Scripts/pip.exe install -r requirements.txt --quiet
Write-Host "[OK] Python AI environment configured." -ForegroundColor Green

# 7. Initialize audio
Write-Host "`n[STEP 4/5] Initializing local audio & asset library..." -ForegroundColor Yellow
if (-not (Test-Path "public/audio/bgm/ambient_documentary.wav")) {
    & .venv-tts/Scripts/python.exe scripts/generate_bgm.py
}
Write-Host "[OK] Local assets ready." -ForegroundColor Green

# 8. Desktop Shortcut
Write-Host "`n[STEP 5/5] Creating Desktop App Shortcut..." -ForegroundColor Yellow
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts/create_desktop_shortcut.ps1"

Write-Host "`n====================================================================" -ForegroundColor Cyan
Write-Host "                    SETUP COMPLETED SUCCESSFULLY!                   " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "A shortcut 'AI Video Studio' has been placed on your Desktop."
Write-Host "You can double-click it anytime to launch the Desktop App.`n"

$launch = Read-Host "Would you like to launch AI Video Studio right now? (Y/N) [Y]"
if ([string]::IsNullOrWhiteSpace($launch) -or $launch.Trim().ToUpper() -eq "Y") {
    Start-Process -FilePath "AI-Video-Studio.bat"
}
