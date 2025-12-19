@echo off
echo ========================================
echo   Starting Library System (Both Servers)
echo ========================================
echo.
echo Killing any existing Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo.
echo Starting HTTP server on port 5000...
start cmd /k "title HTTP Server (Port 5000) && node server.js"
timeout /t 2 /nobreak >nul
echo.
echo Starting HTTPS server on port 5443...
start cmd /k "title HTTPS Server (Port 5443) && node server-https.js"
timeout /t 2 /nobreak >nul
echo.
echo ========================================
echo   Both Servers Started!
echo ========================================
echo.
echo Desktop (HTTPS):  https://localhost:5443
echo Mobile (HTTP):    http://10.237.19.96:5000
echo.
echo Admin Panel:
echo   Desktop: https://localhost:5443/admin.html
echo   Mobile:  http://10.237.19.96:5000/admin.html
echo.
echo Press any key to stop both servers...
pause >nul
taskkill /F /IM node.exe
