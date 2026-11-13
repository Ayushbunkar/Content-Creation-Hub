@echo off
setlocal enabledelayedexpansion
title AI Video Studio - Desktop
cd /d "%~dp0"

echo =================================================================
echo                 AI VIDEO STUDIO - DESKTOP APP
echo =================================================================
echo.

:: 1. Check if server is already running on port 3000
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Studio backend is already running on http://localhost:3000
    goto LaunchApp
)

echo [STARTING] Starting background backend server...
start "AI-Video-Studio-Server" /min cmd /c "npx tsx server/index.ts"

:: 2. Wait up to 10 seconds for server to respond on port 3000
echo [WAITING] Waiting for server to initialize...
for /l %%i in (1,1,10) do (
    timeout /t 1 /nobreak >nul
    netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Server is ready on port 3000!
        goto LaunchApp
    )
)

:LaunchApp
echo [LAUNCHING] Opening AI Video Studio in Desktop App window...

:: Check Edge for standalone app mode
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:3000" --window-size=1440,900
    goto Done
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:3000" --window-size=1440,900
    goto Done
)
:: Check Chrome
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="http://localhost:3000" --window-size=1440,900
    goto Done
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --app="http://localhost:3000" --window-size=1440,900
    goto Done
)

:: Default browser fallback
start http://localhost:3000

:Done
echo.
echo =================================================================
echo   Studio Desktop is running!
echo   Close the app window when finished.
echo =================================================================
timeout /t 3 >nul
exit
