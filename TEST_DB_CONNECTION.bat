@echo off
echo ========================================
echo DATABASE CONNECTION TEST
echo ========================================
echo.
echo This will test if your database connection
echo is stable for long-running operations.
echo.
echo The test takes about 60 seconds.
echo.
pause

call venv\Scripts\activate

echo.
echo Running tests...
echo.

python db_inspect_test_scripts\test_db_connection.py

echo.
pause
