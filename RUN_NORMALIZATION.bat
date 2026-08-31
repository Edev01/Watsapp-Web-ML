@echo off
echo ========================================
echo NORMALIZE ALL MESSAGES
echo ========================================
echo.
echo This will normalize ALL messages in a continuous loop.
echo Batch size: 300 messages per batch.
echo.
echo Press Ctrl+C anytime to pause (progress is saved).
echo Run again to continue where you left off.
echo.
pause

call venv\Scripts\activate
python normalize_all.py

echo.
echo ========================================
echo.
echo Now generating embeddings...
echo.

python main.py embed

echo.
echo ========================================
echo ALL COMPLETE!
echo ========================================
echo.
pause
