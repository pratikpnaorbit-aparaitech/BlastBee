@echo off
title Aparaitech Software - Student Email Blast
color 0B

echo ====================================================
echo   APARAITECH SOFTWARE - STUDENT EMAIL BLAST
echo ====================================================
echo.

:: Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is NOT installed on this computer!
    echo Please download and install Node.js LTS from:
    echo https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Check if node_modules exists, install if missing
if not exist "node_modules" (
    echo [1/3] First-time setup detected. Installing packages...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] npm install failed. Please check your internet connection.
        pause
        exit /b 1
    )
    echo [SUCCESS] Dependencies installed!
    echo.
)

echo [2/3] Initializing local database and email engine...
echo [3/3] Opening browser at http://localhost:3000 ...
echo.

:: Open default browser after 1.5 seconds
start "" http://localhost:3000

:: Start the application server
node server.js

pause
