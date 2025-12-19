@echo off
echo ========================================
echo   Starting Library System (HTTPS Only)
echo ========================================
echo.
echo Killing any existing Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo.
echo Starting HTTPS server on port 5443...
echo.
start cmd /k "node server-https.js"
echo.
echo ========================================
echo   Server Started!
echo ========================================
echo.
echo Desktop: https://localhost:5443
echo Mobile:  https://10.237.19.96:5443
echo.
echo Press any key to stop the server...
pause >nul
taskkill /F /IM node.exe
