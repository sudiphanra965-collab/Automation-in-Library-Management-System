@echo off
setlocal EnableDelayedExpansion

rem Detect primary IPv4 address for instructions
set IP_ADDRESS=
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /i "IPv4 Address" ^| findstr /v "127.0.0.1"') do (
  set CURRENT_IP=%%A
  set CURRENT_IP=!CURRENT_IP: =!
  set IP_ADDRESS=!CURRENT_IP!
)
rem Fallback message if IP not detected
if "%IP_ADDRESS%"=="" set IP_ADDRESS=YOUR_WIFI_IP
title Library Management System - HTTPS Server (Camera Access)
color 0A

echo.
echo ========================================
echo   Library Management System
echo   HTTPS Server - Camera Access Enabled
echo ========================================
echo.
echo Starting HTTPS Server for Camera Access...
echo.
echo Access from Desktop:
echo   https://localhost:5443
echo.
echo Access from Mobile (same WiFi):
echo   https://%IP_ADDRESS%:5443
echo.
echo Note: You'll see a security warning in browser.
echo       Click "Advanced" then "Proceed" - it's safe!
echo.
echo Press Ctrl+C to stop the server.
echo.
echo ========================================
echo.

cd backend
node server-https.js

pause
