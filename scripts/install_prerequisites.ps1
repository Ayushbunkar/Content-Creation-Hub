# scripts/install_prerequisites.ps1 - Automated Prerequisite Installer & Self-Healing Validator
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
    $pyDefault12 = "C:\Program Files\Python312"
    $pyUser = Join-Path $env:LOCALAPPDATA "Programs\Python\Python311"
    $pyUserScripts = Join-Path $env:LOCALAPPDATA "Programs\Python\Python311\Scripts"
    $pyUser12 = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312"
    $pyUser12Scripts = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\Scripts"

    $env:Path = "$localBin;$nodeDefault;$pyDefault;$pyDefault12;$pyUser;$pyUserScripts;$pyUser12;$pyUser12Scripts;$usrPath;$sysPath"
}

function Add-To-User-Path($newDir) {
    if (-not (Test-Path $newDir)) { return }
    try {
        $curr = [System.Environment]::GetEnvironmentVariable('Path', [System.EnvironmentVariableTarget]::User)
        $parts = $curr -split ';' | Where-Object { $_ -ne '' }
        if ($parts -notcontains $newDir) {
            $updated = "$newDir;" + $curr
            [System.Environment]::SetEnvironmentVariable('Path', $updated, [System.EnvironmentVariableTarget]::User)
        }
    } catch {}
}

Refresh-Path

# ==========================================
# 1. NODE.JS CHECK & AUTO-INSTALL
# ==========================================
Write-Host "`n[1/4] Checking Node.js runtime..." -ForegroundColor Yellow
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue

if (-not $nodeCheck) {
    Write-Host "  -> Node.js not detected in PATH. Attempting automatic installation..." -ForegroundColor Magenta

    $installed = $false
    Write-Host "  -> Downloading official Node.js v20 LTS MSI installer..." -ForegroundColor Gray
    $msiUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
    $msiFile = Join-Path $env:TEMP "node_setup.msi"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
        Invoke-WebRequest -Uri $msiUrl -OutFile $msiFile -UseBasicParsing
        Write-Host "  -> Running silent MSI installation..." -ForegroundColor Gray
        $proc = Start-Process msiexec.exe -ArgumentList "/i `"$msiFile`" /qn /norestart" -PassThru
        $proc.WaitForExit(90000) | Out-Null
        Remove-Item $msiFile -Force -ErrorAction SilentlyContinue
        Refresh-Path
        Add-To-User-Path "C:\Program Files\nodejs"
    } catch {
        Write-Host "  -> Automatic Node.js download failed: $_" -ForegroundColor Red
    }
}

Refresh-Path
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCheck) {
    $ver = & node -v
    Write-Host "  [OK] Node.js ready: $ver ($($nodeCheck.Source))" -ForegroundColor Green
} else {
    Write-Host "  [!] Node.js could not be installed automatically." -ForegroundColor Red
    Write-Host "      Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
}

# ==========================================
# 2. PYTHON CHECK & AUTO-INSTALL (BYPASS DUMMY ALIASES)
# ==========================================
Write-Host "`n[2/4] Checking Python 3.10+ runtime..." -ForegroundColor Yellow

function Test-RealPython($cmdPath) {
    if (-not $cmdPath) { return $false }
    try {
        $resolved = $cmdPath
        if (-not (Test-Path $cmdPath)) {
            $cmd = Get-Command $cmdPath -ErrorAction SilentlyContinue
            if ($cmd) { $resolved = $cmd.Source }
        }
        # Explicitly skip Microsoft Store dummy execution aliases
        if ($resolved -like "*\Microsoft\WindowsApps\*" -or $resolved -like "*\WindowsApps\*") {
            return $false
        }
        if (-not (Test-Path $resolved)) { return $false }

        $p = Start-Process -FilePath $resolved -ArgumentList "-c `"import sys`"" -PassThru -WindowStyle Hidden -ErrorAction Stop
        $exited = $p.WaitForExit(3000)
        if (-not $exited) {
            try { $p.Kill() } catch {}
            return $false
        }
        return ($p.ExitCode -eq 0)
    } catch {
        return $false
    }
}

function Find-RealPython {
    $candidates = @(
        "C:\Program Files\Python311\python.exe",
        "C:\Program Files\Python312\python.exe",
        "C:\Program Files\Python310\python.exe",
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python311\python.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python310\python.exe"),
        "py",
        "python"
    )
    foreach ($c in $candidates) {
        if (Test-RealPython $c) { return $c }
    }
    return $null
}

$activePy = Find-RealPython

if (-not $activePy) {
    Write-Host "  -> Real Python not detected. Downloading official Python 3.11 installer..." -ForegroundColor Magenta

    $pyUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
    $pyFile = Join-Path $env:TEMP "python_setup.exe"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
        Invoke-WebRequest -Uri $pyUrl -OutFile $pyFile -UseBasicParsing
        Write-Host "  -> Running silent Python installation (takes ~25 seconds)..." -ForegroundColor Gray
        $proc = Start-Process $pyFile -ArgumentList "/quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 Shortcuts=0" -PassThru
        $completed = $proc.WaitForExit(90000)
        if (-not $completed) {
            try { $proc.Kill() } catch {}
            Write-Host "  [NOTICE] Python installer timed out. Cloud AI fallback will be used." -ForegroundColor Yellow
        }
        Remove-Item $pyFile -Force -ErrorAction SilentlyContinue
        Refresh-Path
        $activePy = Find-RealPython
        if ($activePy) {
            $pyDir = Split-Path $activePy -Parent
            Add-To-User-Path $pyDir
            Add-To-User-Path (Join-Path $pyDir "Scripts")
        }
    } catch {
        Write-Host "  [NOTICE] Python auto-install notice: $_" -ForegroundColor Yellow
    }
}

Refresh-Path
$activePy = Find-RealPython
if ($activePy) {
    $pyVer = & $activePy --version 2>&1
    Write-Host "  [OK] Python ready: $pyVer ($activePy)" -ForegroundColor Green
} else {
    Write-Host "  [NOTICE] Python runtime skipped. Studio will use high-speed cloud voiceover & transcription fallbacks." -ForegroundColor Cyan
}

# ==========================================
# 3. FFMPEG CHECK & ZERO-ADMIN PORTABLE INSTALL
# ==========================================
Write-Host "`n[3/4] Checking FFmpeg multimedia engine..." -ForegroundColor Yellow
$binDir = Join-Path $repoRoot "bin\ffmpeg"
$localFfmpeg = Join-Path $binDir "ffmpeg.exe"

$ffmpegOk = $false
try {
    $p = Start-Process -FilePath "ffmpeg" -ArgumentList "-version" -PassThru -WindowStyle Hidden -ErrorAction Stop
    $done = $p.WaitForExit(3000)
    if ($done -and $p.ExitCode -eq 0) { $ffmpegOk = $true }
} catch {}

if (-not $ffmpegOk -and (Test-Path $localFfmpeg)) {
    try {
        $p = Start-Process -FilePath $localFfmpeg -ArgumentList "-version" -PassThru -WindowStyle Hidden -ErrorAction Stop
        $done = $p.WaitForExit(3000)
        if ($done -and $p.ExitCode -eq 0) { $ffmpegOk = $true }
    } catch {}
}

if (-not $ffmpegOk) {
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
        Add-To-User-Path $binDir
        Write-Host "  [OK] Portable FFmpeg installed into $binDir" -ForegroundColor Green
        $ffmpegOk = $true
    } catch {
        Write-Host "  -> Portable FFmpeg download failed: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [OK] FFmpeg engine is ready." -ForegroundColor Green
}

# ==========================================
# 4. INITIALIZE DIRECTORIES, .ENV & SELF-HEAL PORT 3000
# ==========================================
Write-Host "`n[4/4] Verifying project directories, configuration & ports..." -ForegroundColor Yellow
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
    Write-Host "  [OK] .env configuration verified." -ForegroundColor Green
}

# Auto-free port 3000 if occupied by an unresponsive zombie process
try {
    $portConn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($portConn) {
        $ownerPid = $portConn.OwningProcess
        try {
            $testRes = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        } catch {
            Write-Host "  [AUTO-HEAL] Freeing port 3000 from stale process (PID $ownerPid)..." -ForegroundColor Yellow
            Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
        }
    }
} catch {}

Write-Host "`n[SUCCESS] Prerequisites check and auto-provisioning complete!" -ForegroundColor Cyan
