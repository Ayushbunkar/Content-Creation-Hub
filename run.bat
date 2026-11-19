@echo off
title AI Video Studio
cd /d "%~dp0"

echo ====================================================================
echo             AI VIDEO STUDIO - INSTANT RUN & AUTO-HEAL
echo ====================================================================
echo.

:: Step 1: Ensure Node.js is accessible
set "PATH=%~dp0bin\ffmpeg;C:\Program Files\nodejs;%PATH%"
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
echo [OK] Node.js detected: %NODE_VER%

:: Step 2: Auto-free port 3000 if occupied
echo [AUTO-HEAL] Freeing port 3000 from any old process...
if exist "storage\active_port.txt" del /f /q "storage\active_port.txt" >nul 2>&1
powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } } catch {}" >nul 2>&1

:: Step 3: Check & Auto-Install node dependencies
if not exist "node_modules\express" (
    echo.
    echo [AUTO-HEAL] Installing studio packages... (This takes 1-2 minutes on first run)
    call npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo [RETRY] Retrying clean install...
        call npm install --legacy-peer-deps --no-audit
    )
)
echo [OK] Dependencies verified.

:: Step 3.5: Ensure Python AI packages (yt-dlp) are ready via signed python.exe
if exist ".venv-tts\Scripts\python.exe" (
    .venv-tts\Scripts\python.exe -c "import yt_dlp" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [AUTO-HEAL] Installing yt-dlp multimedia engine into Python...
        call .venv-tts\Scripts\python.exe -m pip install yt-dlp requests soundfile numpy --quiet >nul 2>&1
    )
)

:: Step 4: Ensure vital folders exist
if not exist "storage\database" mkdir "storage\database" >nul 2>&1
if not exist "output\stream_clips" mkdir "output\stream_clips" >nul 2>&1
if not exist ".env" (
    if exist ".env.example" copy ".env.example" ".env" >nul 2>&1
)

:: Step 5: Background browser opener (reads active_port.txt and prioritizes Chrome/Brave)
echo.
echo [LAUNCHER] Launching Chrome or Brave for Studio once server is live...
start "" powershell -NoProfile -Command "$opened = $false; $port = 3000; for ($i=0; $i -lt 50; $i++) { Start-Sleep -Seconds 1; $pfile = 'storage\active_port.txt'; if (Test-Path $pfile) { $t = (Get-Content $pfile -Raw).Trim(); if ($t -match '^\d+$') { $port = [int]$t } }; try { $res = (Invoke-WebRequest -Uri ('http://127.0.0.1:' + $port) -UseBasicParsing -TimeoutSec 1).StatusCode; if ($res -ge 200 -and $res -lt 500) { $opened = $true; break } } catch {} }; if ($opened) { $url = 'http://127.0.0.1:' + $port; $browsers = @('C:\Program Files\Google\Chrome\Application\chrome.exe', (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'), 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe', 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe', (Join-Path $env:LOCALAPPDATA 'BraveSoftware\Brave-Browser\Application\brave.exe'), 'C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe', 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'); $target = $null; foreach ($b in $browsers) { if (Test-Path $b) { $target = $b; break } }; if ($target) { Start-Process -FilePath $target -ArgumentList ('--app=' + $url + ' --window-size=1440,900') } else { Start-Process $url } }"

:: Step 6: Start Server in foreground with full live logs
echo ====================================================================
echo        STARTING STUDIO BACKEND (KEEP THIS WINDOW OPEN)
echo ====================================================================
echo.

if exist "node_modules\.bin\tsx.cmd" (
    call node_modules\.bin\tsx.cmd server/index.ts
) else (
    call npx tsx server/index.ts
)

echo.
echo ====================================================================
echo [NOTICE] Studio server stopped.
echo ====================================================================
pause
