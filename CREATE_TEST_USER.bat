@echo off
echo ========================================
echo Creating Test User Account
echo ========================================
echo.
echo Creating admin account...
echo.

curl -X POST http://localhost:5000/api/auth/admin/signup ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@test.com\",\"password\":\"admin123\",\"name\":\"Admin User\",\"phone_number\":\"0300-1234567\"}"

echo.
echo.
echo ========================================
echo Test Account Created!
echo ========================================
echo.
echo Login credentials:
echo   Email: admin@test.com
echo   Password: admin123
echo.
echo Try logging in now!
echo.
pause
