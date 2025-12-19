@echo off
echo ========================================
echo Starting HTTPS Server for Camera Access
echo ========================================
echo.

REM Check if certificate exists
if not exist "localhost.pfx" (
    echo Certificate not found! Generating now...
    echo.
    powershell -ExecutionPolicy Bypass -File generate-cert.ps1
    echo.
    echo Certificate generated!
    echo.
)

echo Starting HTTPS server on port 5443...
echo.
echo Access URLs:
echo   Computer: https://localhost:5443
echo   Mobile:   https://10.237.19.96:5443
echo.
echo Camera scanning will work!
echo Note: Accept security warning in browser
echo.

node server-https.js
