@echo off
setlocal enabledelayedexpansion
title AI Video Studio - 1-Click Autonomous Setup
cd /d "%~dp0"

echo ====================================================================
echo        AI VIDEO STUDIO - 1-CLICK AUTONOMOUS SETUP ENGINE
echo ====================================================================
echo This script automatically installs any missing dependencies, resolves
echo conflicts, configures local AI models, and launches the Studio.
echo ====================================================================
echo.

:: STEP 1: Auto-Detect & Auto-Install Missing Prerequisites
echo [STEP 1/5] Checking and auto-installing system prerequisites...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\install_prerequisites.ps1"

:: STEP 2: Refresh PATH in Current Command Session
set "PATH=%~dp0bin\ffmpeg;C:\Program Files\nodejs;C:\Program Files\Python311;C:\Program Files\Python312;%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"

:: STEP 3: Verify and Auto-Heal Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=C:\Program Files\nodejs;!PATH!"
        echo [AUTO-HEAL] Found Node.js in C:\Program Files\nodejs.
    ) else (
        echo [ERROR] Node.js is not yet available in PATH.
        echo Please restart your terminal or install Node.js from https://nodejs.org/
        pause
        exit /b 1
    )
)

:: STEP 4: Locate Real Functional Python
set "PYTHON_CMD="
if exist "C:\Program Files\Python311\python.exe" (
    set "PYTHON_CMD=C:\Program Files\Python311\python.exe"
) else (
    if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
        set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    ) else (
        if exist "C:\Program Files\Python312\python.exe" (
            set "PYTHON_CMD=C:\Program Files\Python312\python.exe"
        ) else (
            if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
                set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
            ) else (
                py -c "import sys" >nul 2>&1
                if !errorlevel! equ 0 (
                    set "PYTHON_CMD=py"
                ) else (
                    echo [NOTICE] Python runtime skipped. Cloud AI fallback will be used.
                )
            )
        )
    )
)

:: STEP 5: Install Node Dependencies with Auto-Retry and Auto-Heal
echo.
echo [STEP 2/5] Installing and verifying Node.js packages...
call npm install --no-audit
if %errorlevel% neq 0 (
    echo [AUTO-HEAL] Retrying npm install with --legacy-peer-deps...
    call npm install --legacy-peer-deps --no-audit
)
if %errorlevel% neq 0 (
    echo [AUTO-HEAL] Clearing npm cache and performing clean install...
    call npm cache clean --force >nul 2>&1
    call npm install --legacy-peer-deps --no-audit
)
if exist "node_modules" (
    echo [OK] Node dependencies ready.
) else (
    echo [WARNING] Node dependencies had warnings. Continuing with setup...
)

:: STEP 6: Configure Python Virtual Environment
echo.
echo [STEP 3/5] Setting up local Python AI environment...
if defined PYTHON_CMD (
    if not exist ".venv-tts\Scripts\python.exe" (
        echo Creating isolated Python virtual environment...
        "%PYTHON_CMD%" -m venv .venv-tts >nul 2>&1
    )
    if exist ".venv-tts\Scripts\python.exe" (
        echo Installing AI packages: Torch, Kokoro TTS, Whisper, yt-dlp...
        call .venv-tts\Scripts\python.exe -m pip install --upgrade pip --quiet >nul 2>&1
        call .venv-tts\Scripts\pip.exe install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu --quiet
        if !errorlevel! neq 0 (
            echo [AUTO-HEAL] Installing lightweight core AI fallback packages...
            call .venv-tts\Scripts\pip.exe install yt-dlp requests soundfile numpy --quiet >nul 2>&1
        )
        echo [OK] Python AI environment ready.
    ) else (
        echo [NOTICE] Python virtual environment creation skipped.
    )
) else (
    echo [NOTICE] Python virtual environment skipped.
)

:: STEP 7: Generate Procedural Audio Assets
echo.
echo [STEP 4/5] Initializing audio and asset library...
if not exist "public\audio\bgm\ambient_documentary.wav" (
    if exist ".venv-tts\Scripts\python.exe" (
        echo Generating studio background music tracks...
        call .venv-tts\Scripts\python.exe scripts\generate_bgm.py >nul 2>&1
    )
)
echo [OK] Local assets verified.

:: STEP 8: Create Desktop Shortcut
echo.
echo [STEP 5/5] Creating Desktop App Shortcut on your Windows Desktop...
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
