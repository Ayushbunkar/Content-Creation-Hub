@echo off
setlocal enabledelayedexpansion
title AI Video Studio - Desktop
cd /d "%~dp0"

set "PATH=%~dp0bin\ffmpeg;C:\Program Files\nodejs;C:\Program Files\Python311;C:\Program Files\Python312;%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"

echo =================================================================
echo                 AI VIDEO STUDIO - DESKTOP APP
echo =================================================================
echo.

:: Ensure all vital folders exist
if not exist "storage" mkdir "storage"
if not exist "storage\database" mkdir "storage\database"
if not exist "storage\temp" mkdir "storage\temp"
if not exist "output" mkdir "output"
if not exist "output\stream_clips" mkdir "output\stream_clips"

:: Ensure .env exists
if not exist ".env" (
    if exist ".env.example" copy ".env.example" ".env" >nul 2>&1
)

:: 1. Self-Healing Health Check: Is Studio already running and responding HTTP?
powershell -NoProfile -Command "try { $r = (Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 2).StatusCode; if ($r -ge 200 -and $r -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Studio backend is already active and healthy on http://127.0.0.1:3000
    goto LaunchApp
)

:: 2. Auto-kill any zombie unresponsive process occupying port 3000
powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } } catch {}" >nul 2>&1

:: 3. Verify node_modules exist before attempting to start server
if not exist "node_modules" (
    echo [SETUP] Node modules missing. Auto-installing packages now...
    call npm install --legacy-peer-deps --no-audit
)

:: 4. Start background server in a dedicated process
echo [STARTING] Starting AI Video Studio server on port 3000...
if exist "node_modules\.bin\tsx.cmd" (
    start "AI-Video-Studio-Server" cmd /k "node_modules\.bin\tsx.cmd server/index.ts"
) else (
    start "AI-Video-Studio-Server" cmd /k "npx -y tsx server/index.ts"
)

:: 5. Wait up to 35 seconds with real HTTP GET health check
echo [WAITING] Initializing server engines (Whisper, Kokoro, FFmpeg, Remotion)...
set SERVER_READY=0
for /l %%i in (1,1,35) do (
    timeout /t 1 /nobreak >nul
    powershell -NoProfile -Command "try { $r = (Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 2).StatusCode; if ($r -ge 200 -and $r -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
    if !errorlevel! equ 0 (
        set SERVER_READY=1
        echo.
        echo [OK] Studio server is ready and responding on http://127.0.0.1:3000! (in %%i seconds)
        goto LaunchApp
    )
    <nul set /p=.
)

if !SERVER_READY! equ 0 (
    echo.
    echo =================================================================
    echo [ERROR] Server took too long to respond on port 3000.
    echo Please check the "AI-Video-Studio-Server" terminal window.
    echo =================================================================
    pause
    exit /b 1
)

:LaunchApp
echo.
echo [LAUNCHING] Opening AI Video Studio in your browser...

:: 1. Priority: Google Chrome (App Window Mode)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="http://127.0.0.1:3000" --window-size=1440,900
    goto Done
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --app="http://127.0.0.1:3000" --window-size=1440,900
    goto Done
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="http://127.0.0.1:3000" --window-size=1440,900
    goto Done
)

:: 2. Priority: Brave Browser (App Window Mode)
if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    start "" "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" --app="http://127.0.0.1:3000" --window-size=1440,900
    goto Done
)
if exist "%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    start "" "%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe" --app="http://127.0.0.1:3000" --window-size=1440,900
    goto Done
)
if exist "%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    start "" "%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe" --app="http://127.0.0.1:3000" --window-size=1440,900
    goto Done
)

:: 3. Fallback: Edge
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="http://127.0.0.1:3000" --window-size=1440,900
    goto Done
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="http://127.0.0.1:3000" --window-size=1440,900
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
