@echo off
echo ========================================
echo Clear All Normalized Data
echo ========================================
echo.
echo This will DELETE:
echo   - All normalized messages
echo   - All embeddings
echo.
echo This will KEEP:
echo   - All raw WhatsApp messages (SAFE!)
echo   - All chats and contacts
echo.
echo After clearing, you MUST run:
echo   RUN_NORMALIZATION.bat
echo.
echo ========================================
echo.

call venv\Scripts\activate
python CLEAR_AND_RENORMALIZE.py

echo.
pause
