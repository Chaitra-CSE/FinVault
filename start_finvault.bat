@echo off
title FinVault - Document Vault & Workflow System
cd /d "%~dp0"

echo ========================================================
echo               Starting FinVault Services
echo ========================================================
echo.

:: 1. Check if backend build exists, build if missing
if not exist "backend\dist\index.js" (
    echo [INFO] Building backend TypeScript...
    cd backend
    call npm run build
    cd ..
)

:: 2. Start Backend API in a separate window
echo [INFO] Starting FinVault Backend API on port 4000...
start "FinVault Backend (Port 4000)" cmd /k "cd /d ""%~dp0backend"" && node dist/index.js"

:: 3. Start Frontend Dev Server in a separate window
echo [INFO] Starting FinVault Frontend on port 5173...
start "FinVault Frontend (Port 5173)" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

:: 4. Wait for services to initialize
echo.
echo [INFO] Waiting for servers to initialize...
timeout /t 5 /nobreak >nul

:: 5. Open browser
echo [INFO] Opening FinVault in your browser...
start http://localhost:5173

echo.
echo ========================================================
echo             FinVault is now running!
echo ========================================================
echo   Frontend URL : http://localhost:5173
echo   Backend API  : http://localhost:4000
echo.
echo   Login Credentials:
echo     Admin:    admin@finvault.local    / password123
echo     Uploader: uploader@finvault.local / password123
echo     Approver: approver@finvault.local / password123
echo     Auditor:  auditor@finvault.local  / password123
echo     Viewer:   viewer@finvault.local   / password123
echo ========================================================
echo.
echo Keep the backend and frontend terminal windows open while using FinVault.
echo You may close this launcher window at any time.
echo.
pause
