@echo off
title AI Smart Office Backend Server
echo ========================================================
echo   Starting AI Smart Office FastAPI Backend (Port 8000)
echo ========================================================
cd /d "%~dp0backend"

if exist "venv\Scripts\python.exe" (
    echo Using virtual environment Python...
    venv\Scripts\python.exe -m app.main
) else (
    echo Using system Python...
    python -m app.main
)

pause
