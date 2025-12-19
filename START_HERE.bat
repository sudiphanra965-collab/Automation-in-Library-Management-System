@echo off
title Library Management System - Server Launcher
color 0A

echo.
echo ========================================
echo   Library Management System
echo   Gate Security - Version 3.3
echo ========================================
echo.
echo Choose a server to start:
echo.
echo   1. HTTP Server  (Port 5000) - Manual Entry
echo   2. HTTPS Server (Port 5443) - Camera Scanning
echo   3. Both Servers
echo   4. Exit
echo.
echo ========================================
echo.

set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto http
if "%choice%"=="2" goto https
if "%choice%"=="3" goto both
if "%choice%"=="4" goto end
goto invalid

:http
echo.
echo Starting HTTP Server...
echo Access: http://10.237.19.96:5000/gate-scanner.html
echo.
cd backend
node server.js
goto end

:https
echo.
echo Starting HTTPS Server...
echo Access: https://10.237.19.96:5443/gate-scanner.html
echo Note: Accept security warning in browser
echo.
cd backend
node server-https.js
goto end

:both
echo.
echo Starting both servers...
echo.
echo HTTP:  http://10.237.19.96:5000
echo HTTPS: https://10.237.19.96:5443
echo.
start "HTTP Server" cmd /k "cd backend && node server.js"
timeout /t 2
start "HTTPS Server" cmd /k "cd backend && node server-https.js"
echo.
echo Both servers started in separate windows!
echo.
pause
goto end

:invalid
echo.
echo Invalid choice! Please enter 1, 2, 3, or 4.
echo.
pause
goto end

:end
