@echo off
setlocal enabledelayedexpansion
title AI Video Studio - Desktop
cd /d "%~dp0"

set "PATH=%~dp0bin\ffmpeg;C:\Program Files\nodejs;C:\Program Files\Python311;%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;%PATH%"

echo =================================================================
echo                 AI VIDEO STUDIO - DESKTOP APP
echo =================================================================
echo.

:: Ensure all vital folders exist
if not exist "storage" mkdir "storage"
if not exist "storage\database" mkdir "storage\database"
if not exist "output" mkdir "output"
if not exist "output\stream_clips" mkdir "output\stream_clips"

:: Ensure .env exists
if not exist ".env" (
    if exist ".env.example" copy ".env.example" ".env" >nul 2>&1
)

:: 1. Check if server is already responding on http://127.0.0.1:3000
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1', 3000); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
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

:: 2. Wait up to 30 seconds with reliable socket health check
echo [WAITING] Initializing server engines (Whisper, Kokoro, FFmpeg, Remotion)...
for /l %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1', 3000); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
    if !errorlevel! equ 0 (
        echo.
        echo [OK] Studio server is ready on http://127.0.0.1:3000! (in %%i seconds)
        goto LaunchApp
    )
    <nul set /p=.
)

echo.
echo [NOTICE] Server is taking a few extra seconds to start up...
if exist "storage\server.log" (
    powershell -NoProfile -Command "Get-Content -Path 'storage\server.log' -Tail 8 -ErrorAction SilentlyContinue"
)

:LaunchApp
echo.
echo [LAUNCHING] Opening AI Video Studio in your browser...

:: Check Edge standalone mode
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="http://127.0.0.1:3000" --window-size=1440,900
    goto Done
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="http://127.0.0.1:3000" --window-size=1440,900
    goto Done
)
:: Check Chrome standalone mode
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
echo   Studio Desktop is running on http://127.0.0.1:3000!
echo =================================================================
timeout /t 2 >nul
exit
