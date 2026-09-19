#!/bin/bash

# AI Excel Development Environment Startup Script
# Usage: ./start-dev.sh

echo "========================================"
echo "AI Excel Development Environment"
echo "========================================"
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "[INFO] Node.js version:"
node --version
echo

# Navigate to frontend directory
cd "$(dirname "$0")/frontend" || {
    echo "[ERROR] Frontend directory not found"
    exit 1
}

echo "[INFO] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install dependencies"
    exit 1
fi

echo
echo "[SUCCESS] Dependencies installed"
echo
echo "[INFO] Starting development server on http://localhost:3002"
echo "[INFO] Press Ctrl+C to stop the server"
echo

# Start the development server
npm run dev
