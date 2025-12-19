@echo off
echo ========================================
echo   Setting Up Windows Firewall Rules
echo ========================================
echo.
echo This will allow mobile devices to connect to the library system.
echo.
echo Adding firewall rules for ports 5443 (HTTPS) and 5000 (HTTP)...
echo.

REM Add firewall rule for HTTPS port 5443
netsh advfirewall firewall add rule name="Library System HTTPS" dir=in action=allow protocol=TCP localport=5443

REM Add firewall rule for HTTP port 5000 (backup)
netsh advfirewall firewall add rule name="Library System HTTP" dir=in action=allow protocol=TCP localport=5000

echo.
echo ========================================
echo   Firewall Rules Added!
echo ========================================
echo.
echo Mobile devices can now connect to:
echo   HTTPS: https://10.237.19.96:5443
echo   HTTP:  http://10.237.19.96:5000
echo.
echo Press any key to continue...
pause >nul

