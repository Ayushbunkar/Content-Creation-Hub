@echo off
title Local AI Video Studio - Desktop Production App
cd /d "%~dp0"

echo =======================================================
echo         LOCAL AI VIDEO STUDIO - DESKTOP APP
echo =======================================================
echo Starting Local AI Video Studio Server on http://localhost:3000 ...
echo.

:: Start the Studio server in the background
start "VideoStudio-Backend" /min cmd /c "npx tsx server/index.ts"

:: Wait 3 seconds for server to initialize
timeout /t 3 /nobreak >nul

:: Launch browser in standalone app window mode
echo Launching Local AI Video Studio Desktop Interface...
start http://localhost:3000

echo.
echo Studio is running! Keep this window open while using the Studio.
echo Press any key to stop the Studio server...
pause >nul

:: Clean up server processes on exit
taskkill /fi "WINDOWTITLE eq VideoStudio-Backend" /f /t >nul 2>&1
echo Studio closed.
