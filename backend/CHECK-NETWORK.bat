@echo off
echo ========================================
echo   Network Configuration Check
echo ========================================
echo.
echo Your computer's IP addresses:
echo.
ipconfig | findstr /i "IPv4"
echo.
echo ========================================
echo.
echo Make sure your mobile is connected to the SAME WiFi network!
echo.
echo If you see multiple IP addresses above, use the one that starts with:
echo   - 192.168.x.x (most common)
echo   - 10.x.x.x (some networks)
echo   - 172.16.x.x to 172.31.x.x (some networks)
echo.
echo Then on your mobile, go to:
echo   https://[YOUR-IP]:5443
echo.
echo Example: https://192.168.1.100:5443
echo.
echo ========================================
echo.
echo Checking if ports are listening...
echo.
netstat -an | findstr ":5443"
netstat -an | findstr ":5000"
echo.
echo If you see "LISTENING" above, the server is running correctly.
echo.
echo Press any key to exit...
pause >nul
