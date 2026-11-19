@echo off
title AI Video Studio - Server
cd /d "%~dp0"

echo =================================================================
echo             AI VIDEO STUDIO - LOCAL SERVER
echo =================================================================
echo Starting local production server on http://127.0.0.1:3000 ...
echo.

:: Auto-kill zombie process holding port 3000 if any
powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } } catch {}" >nul 2>&1

:: Open browser after 2 seconds
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:3000'"

:: Run server with full live logs
if exist "node_modules\.bin\tsx.cmd" (
    call node_modules\.bin\tsx.cmd server/index.ts
) else (
    call npx tsx server/index.ts
)

pause
