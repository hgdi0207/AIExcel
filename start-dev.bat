@echo off
REM AI Excel Development Environment Startup Script
REM Usage: start-dev.bat

echo ========================================
echo AI Excel Development Environment
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Node.js version:
node --version
echo.

REM Navigate to frontend directory
cd /d "%~dp0frontend"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend directory not found
    pause
    exit /b 1
)

echo [INFO] Installing dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Dependencies installed
echo.
echo [INFO] Starting development server on http://localhost:3002
echo [INFO] Press Ctrl+C to stop the server
echo.

REM Start the development server
call npm run dev

pause
