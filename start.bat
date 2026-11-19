@echo off
title AI Video Studio - Server
cd /d "%~dp0"

echo =================================================================
echo             AI VIDEO STUDIO - LOCAL SERVER
echo =================================================================
echo Starting local production server on http://127.0.0.1:3000 ...
echo.

:: 1. Auto-Heal: Free port 3000 if occupied by dead zombie node process
powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } } catch {}" >nul 2>&1

:: 2. Auto-Heal: Ensure node_modules exists
if not exist "node_modules" (
    echo [AUTO-HEAL] Node packages missing. Installing dependencies automatically...
    call npm install --legacy-peer-deps --no-audit
)

:: 3. Auto-Heal: Ensure vital directories & .env exist
if not exist "storage\database" mkdir "storage\database"
if not exist "output\stream_clips" mkdir "output\stream_clips"
if not exist ".env" (
    if exist ".env.example" copy ".env.example" ".env" >nul 2>&1
)

:: 4. Auto-Launch browser once server responds with HTTP 200 (prioritizes Chrome and Brave)
start "" powershell -NoProfile -Command "$ready = $false; for ($i=0; $i -lt 45; $i++) { Start-Sleep -Seconds 1; try { $r = (Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 1).StatusCode; if ($r -eq 200) { $ready = $true; break } } catch {} }; if ($ready) { $browsers = @('C:\Program Files\Google\Chrome\Application\chrome.exe', (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'), 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe', 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe', (Join-Path $env:LOCALAPPDATA 'BraveSoftware\Brave-Browser\Application\brave.exe'), 'C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe', 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'); $target = $null; foreach ($b in $browsers) { if (Test-Path $b) { $target = $b; break } }; if ($target) { Start-Process -FilePath $target -ArgumentList '--app=http://127.0.0.1:3000 --window-size=1440,900' } else { Start-Process 'http://127.0.0.1:3000' } }"

:: 5. Start Server with live logs
if exist "node_modules\.bin\tsx.cmd" (
    call node_modules\.bin\tsx.cmd server/index.ts
) else (
    call npx tsx server/index.ts
)

pause
