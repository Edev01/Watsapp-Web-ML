@echo off
REM ============================================================
REM Daily WhatsApp Property Bot Update Script
REM 
REM This script:
REM 1. Removes duplicate properties from multiple chats
REM 2. Normalizes new messages
REM 3. Generates embeddings for search
REM
REM Usage: Just double-click this file or run from command line
REM ============================================================

echo ============================================================
echo WhatsApp Property Bot - Daily Update
echo ============================================================
echo.

REM Activate virtual environment
echo [1/4] Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    echo Make sure venv folder exists in the current directory
    pause
    exit /b 1
)
echo     ✓ Virtual environment activated
echo.

REM Remove duplicates
echo [2/4] Removing duplicate properties...
python main.py dedup --auto
if errorlevel 1 (
    echo ERROR: Deduplication failed
    pause
    exit /b 1
)
echo     ✓ Duplicates removed
echo.

REM Normalize new messages
echo [3/4] Normalizing new messages (this may take a few minutes)...
python main.py normalize --batch 200
if errorlevel 1 (
    echo ERROR: Normalization failed
    pause
    exit /b 1
)
echo     ✓ Normalization complete
echo.

REM Generate embeddings
echo [4/4] Generating embeddings for search...
python main.py embed
if errorlevel 1 (
    echo ERROR: Embedding generation failed
    pause
    exit /b 1
)
echo     ✓ Embeddings generated
echo.

echo ============================================================
echo ✓ UPDATE COMPLETE!
echo ============================================================
echo.
echo Your property database is now up-to-date and ready to search.
echo.
echo Test search with:
echo   python main.py search "apartment in Clifton" --limit 5
echo.
echo Or launch web UI:
echo   python main.py ui --port 8000
echo.

pause
