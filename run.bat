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

:: Step 4: Ensure vital folders exist
if not exist "storage\database" mkdir "storage\database" >nul 2>&1
if not exist "output\stream_clips" mkdir "output\stream_clips" >nul 2>&1
if not exist ".env" (
    if exist ".env.example" copy ".env.example" ".env" >nul 2>&1
)

:: Step 5: Background browser opener (prioritizes Chrome and Brave directly)
echo.
echo [LAUNCHER] Launching Chrome or Brave for http://127.0.0.1:3000 once ready...
start "" powershell -NoProfile -Command "$opened = $false; for ($i=0; $i -lt 45; $i++) { Start-Sleep -Seconds 1; try { $res = (Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 1).StatusCode; if ($res -eq 200) { $opened = $true; break } } catch {} }; if ($opened) { $browsers = @('C:\Program Files\Google\Chrome\Application\chrome.exe', (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'), 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe', 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe', (Join-Path $env:LOCALAPPDATA 'BraveSoftware\Brave-Browser\Application\brave.exe'), 'C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe', 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'); $target = $null; foreach ($b in $browsers) { if (Test-Path $b) { $target = $b; break } }; if ($target) { Start-Process -FilePath $target -ArgumentList '--app=http://127.0.0.1:3000 --window-size=1440,900' } else { Start-Process 'http://127.0.0.1:3000' } }"

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
