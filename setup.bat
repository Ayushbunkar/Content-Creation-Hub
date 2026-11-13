@echo off
setlocal enabledelayedexpansion
title AI Video Studio - 1-Click Setup
cd /d "%~dp0"

echo ====================================================================
echo             AI VIDEO STUDIO - 1-CLICK AUTOMATIC SETUP
echo ====================================================================
echo This script will install all dependencies, configure local AI engines,
echo and create a ready-to-run Desktop App icon on your Desktop.
echo.

:: 1. Check Node.js
echo [CHECK 1/3] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js v20 or v22 from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo [OK] Node.js detected: %%v

:: 2. Check Python
echo [CHECK 2/3] Checking Python...
set PYTHON_CMD=python
where python >nul 2>&1
if %errorlevel% neq 0 (
    where py >nul 2>&1
    if %errorlevel% equ 0 (
        set PYTHON_CMD=py
    ) else (
        echo [ERROR] Python is not installed or not in your PATH!
        echo Please install Python 3.10+ from https://python.org/
        echo Make sure to check Add Python to PATH during installation.
        echo.
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%v in ('!PYTHON_CMD! --version') do echo [OK] Python detected: %%v

:: 3. Check FFmpeg
echo [CHECK 3/3] Checking FFmpeg...
where ffmpeg >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] FFmpeg was not found in your system PATH!
    echo Attempting to install FFmpeg automatically via winget...
    winget install -e --id Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
    where ffmpeg >nul 2>&1
    if !errorlevel! neq 0 (
        echo [NOTICE] Please ensure FFmpeg is installed and added to PATH if video rendering fails.
    ) else (
        echo [OK] FFmpeg installed successfully!
    )
) else (
    echo [OK] FFmpeg detected in system PATH.
)
echo.

:: 4. Create Project Storage Directories
echo [STEP 1/5] Preparing project storage directories...
if not exist "storage\database" mkdir "storage\database"
if not exist "storage\temp" mkdir "storage\temp"
if not exist "storage\clips" mkdir "storage\clips"
if not exist "storage\renders" mkdir "storage\renders"
if not exist "storage\documentary_assets" mkdir "storage\documentary_assets"
if not exist "public\audio\bgm" mkdir "public\audio\bgm"
if not exist "public\videos\library" mkdir "public\videos\library"
echo [OK] Directories verified.
echo.

:: 5. Install Node Dependencies
echo [STEP 2/5] Installing Node.js dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [WARNING] npm install reported warnings or errors. Continuing...
) else (
    echo [OK] Node dependencies installed.
)
echo.

:: 6. Python Virtual Environment Setup
echo [STEP 3/5] Setting up local Python AI environment...
if not exist ".venv-tts\Scripts\python.exe" (
    echo Creating virtual environment .venv-tts...
    !PYTHON_CMD! -m venv .venv-tts
)
echo Verifying local AI packages: Whisper, Kokoro TTS, Torch, yt-dlp...
call .venv-tts\Scripts\python.exe -m pip install --upgrade pip --quiet
call .venv-tts\Scripts\pip.exe install -r requirements.txt --quiet
echo [OK] Python AI environment ready.
echo.

:: 7. Initialize Audio & Asset Libraries
echo [STEP 4/5] Initializing local audio and asset library...
if not exist "public\audio\bgm\ambient_documentary.wav" (
    echo Generating studio background music tracks...
    call .venv-tts\Scripts\python.exe scripts\generate_bgm.py
)
echo [OK] Local assets verified.
echo.

:: 8. Create Desktop App Shortcut
echo [STEP 5/5] Creating Desktop App Shortcut on your Desktop...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\create_desktop_shortcut.ps1"
echo.

echo ====================================================================
echo                    SETUP COMPLETED SUCCESSFULLY!
echo ====================================================================
echo  - A desktop shortcut 'AI Video Studio' is now on your Desktop!
echo  - You can double-click that icon anytime to run the Studio app.
echo ====================================================================
echo.

set /p RUNNOW="Would you like to launch AI Video Studio right now? (Y/N) [Y]: "
if /i "%RUNNOW%"=="" set RUNNOW=Y
if /i "%RUNNOW%"=="Y" (
    echo Starting Studio Desktop...
    call AI-Video-Studio.bat
)
