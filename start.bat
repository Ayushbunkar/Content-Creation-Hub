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

:: 4. Auto-Launch browser once server responds with HTTP 200
start "" powershell -NoProfile -Command "$ready = $false; for ($i=0; $i -lt 35; $i++) { Start-Sleep -Seconds 1; try { $r = (Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 1).StatusCode; if ($r -eq 200) { $ready = $true; break } } catch {} }; if ($ready) { Start-Process 'http://127.0.0.1:3000' }"

:: 5. Start Server with live logs
if exist "node_modules\.bin\tsx.cmd" (
    call node_modules\.bin\tsx.cmd server/index.ts
) else (
    call npx tsx server/index.ts
)

pause
