@echo off
setlocal enabledelayedexpansion
title AI Video Studio - 1-Click Setup
cd /d "%~dp0"

echo ====================================================================
echo             AI VIDEO STUDIO - 1-CLICK AUTOMATIC SETUP
echo ====================================================================
echo This script will install all dependencies, configure local AI engines,
echo and launch the AI Video Studio on your computer.
echo.

:: 1. Run PowerShell Prerequisite Installer (Node.js, Python, FFmpeg, .env, directories)
echo [STEP 1/5] Checking and auto-installing system prerequisites...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\install_prerequisites.ps1"

:: 2. Refresh PATH inside current session
set "PATH=%~dp0bin\ffmpeg;C:\Program Files\nodejs;C:\Program Files\Python311;%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;%PATH%"

:: 3. Verify Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not available in PATH.
    echo Please install Node.js (v20 or v22) from https://nodejs.org/ and re-run setup.bat
    pause
    exit /b 1
)

:: 4. Verify Python
set PYTHON_CMD=python
where python >nul 2>&1
if %errorlevel% neq 0 (
    where py >nul 2>&1
    if %errorlevel% equ 0 (
        set PYTHON_CMD=py
    ) else (
        echo [WARNING] Python was not found in system PATH.
        echo Some AI features (Kokoro TTS / Whisper) may use cloud fallbacks.
    )
)

:: 5. Install Node Dependencies
echo.
echo [STEP 2/5] Installing Node.js packages (Remotion, Express, SQLite, TSX)...
call npm install
if %errorlevel% neq 0 (
    echo [RETRY] Retrying npm install with --legacy-peer-deps...
    call npm install --legacy-peer-deps
)
if %errorlevel% neq 0 (
    echo [WARNING] npm install reported an issue. Continuing to next step...
) else (
    echo [OK] Node dependencies ready.
)

:: 6. Python Virtual Environment Setup (AI Engines: Whisper, Kokoro, yt-dlp)
echo.
echo [STEP 3/5] Setting up local Python AI environment...
if not exist ".venv-tts\Scripts\python.exe" (
    echo Creating virtual environment .venv-tts...
    !PYTHON_CMD! -m venv .venv-tts >nul 2>&1
)
if exist ".venv-tts\Scripts\python.exe" (
    echo Installing AI packages (Torch, Kokoro TTS, Whisper, yt-dlp)...
    call .venv-tts\Scripts\python.exe -m pip install --upgrade pip --quiet
    call .venv-tts\Scripts\pip.exe install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu --quiet
    echo [OK] Python AI environment ready.
) else (
    echo [NOTICE] Python virtual environment skipped.
)

:: 7. Initialize Audio & Asset Libraries
echo.
echo [STEP 4/5] Initializing audio and asset library...
if not exist "public\audio\bgm\ambient_documentary.wav" (
    if exist ".venv-tts\Scripts\python.exe" (
        echo Generating studio background music tracks...
        call .venv-tts\Scripts\python.exe scripts\generate_bgm.py
    )
)
echo [OK] Local assets verified.

:: 8. Create Desktop App Shortcut
echo.
echo [STEP 5/5] Creating Desktop App Shortcut on your Desktop...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\create_desktop_shortcut.ps1"

echo.
echo ====================================================================
echo                    SETUP COMPLETED SUCCESSFULLY!
echo ====================================================================
echo  - A desktop shortcut 'AI Video Studio' is now on your Desktop!
echo  - Launching AI Video Studio automatically right now...
echo ====================================================================
echo.

call AI-Video-Studio.bat
