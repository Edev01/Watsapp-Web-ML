@echo off
echo ====================================
echo  Starting Local Integration Test
echo ====================================
echo.
echo This will start both backends for testing:
echo - Python AI Backend (Port 8000)
echo - Node.js Backend (Port 5000)
echo.
echo Press Ctrl+C in each window to stop
echo ====================================
echo.

echo Starting Python AI Backend...
start "Python AI Backend" cmd /k "cd /d %~dp0 && venv\Scripts\activate && python -m uvicorn app.api:app --reload --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

echo Freeing port 5000 if already in use...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr LISTENING') do (
  echo Killing PID %%a on port 5000...
  taskkill /PID %%a /F >nul 2>&1
)

echo Starting Node.js Backend...
start "Node.js Backend" cmd /k "cd /d %~dp0Watsapp_Web_backend-main && npm start"

echo.
echo ====================================
echo Both backends are starting...
echo.
echo Python AI:  http://localhost:8000
echo Node.js:    http://localhost:5000
echo Frontend:   cd Watsapp_Web_Scrapper-main ^&^& npm run dev
echo.
echo Wait 5-10 seconds for both to start
echo Then open the frontend and login.
echo ====================================
pause
