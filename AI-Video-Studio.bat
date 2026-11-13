@echo off
setlocal enabledelayedexpansion
title AI Video Studio - Desktop
cd /d "%~dp0"

echo =================================================================
echo                 AI VIDEO STUDIO - DESKTOP APP
echo =================================================================
echo.

if not exist "storage" mkdir "storage"

:: 1. Check if server is already responding on http://127.0.0.1:3000
curl.exe -s -o nul http://127.0.0.1:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Studio backend is already active on http://127.0.0.1:3000
    goto LaunchApp
)

echo [STARTING] Starting background studio server...
if exist "node_modules\.bin\tsx.cmd" (
    start "AI-Video-Studio-Server" /min cmd /c "node_modules\.bin\tsx.cmd server/index.ts > storage\server.log 2>&1"
) else (
    start "AI-Video-Studio-Server" /min cmd /c "npx tsx server/index.ts > storage\server.log 2>&1"
)

:: 2. Wait up to 45 seconds with live health check
echo [WAITING] Initializing server engines (Whisper, Kokoro, FFmpeg, Remotion)...
for /l %%i in (1,1,45) do (
    timeout /t 1 /nobreak >nul
    curl.exe -s -o nul http://127.0.0.1:3000 >nul 2>&1
    if !errorlevel! equ 0 (
        echo.
        echo [OK] Studio server is ready on http://127.0.0.1:3000! (in %%i seconds)
        goto LaunchApp
    )
    <nul set /p=.
)

echo.
echo =================================================================
echo [ERROR] Server did not become ready within 45 seconds.
echo =================================================================
if exist "storage\server.log" (
    echo Recent server log:
    echo -------------------------------------------------------------
    powershell -NoProfile -Command "Get-Content -Path 'storage\server.log' -Tail 15"
    echo -------------------------------------------------------------
)
echo.
echo Please run: npx tsx server/index.ts directly to inspect errors.
pause
exit /b 1

:LaunchApp
echo.
echo [LAUNCHING] Opening AI Video Studio Desktop window...

:: Launch Edge in standalone app window mode with direct 127.0.0.1 IP
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="http://127.0.0.1:3000" --window-size=1440,900
    goto Done
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="http://127.0.0.1:3000" --window-size=1440,900
    goto Done
)
:: Check Chrome
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="http://127.0.0.1:3000" --window-size=1440,900
    goto Done
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --app="http://127.0.0.1:3000" --window-size=1440,900
    goto Done
)

:: Default browser fallback
start http://127.0.0.1:3000

:Done
echo.
echo =================================================================
echo   Studio Desktop is running!
echo   Close this window when finished.
echo =================================================================
timeout /t 2 >nul
exit
