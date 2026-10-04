@echo off
title Stop FinVault Services
echo Stopping FinVault background services on port 4000 and 5173...

:: Find and kill process listening on port 4000 (Backend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Find and kill process listening on port 5173 (Frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo All FinVault services stopped.
pause
