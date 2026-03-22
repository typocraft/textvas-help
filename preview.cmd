@echo off
setlocal
cd /d "%~dp0"

echo Starting live preview server in a new window...
start "Textvas Live Server" cmd /k "cd /d ""%~dp0"" && node serve.js"
timeout /t 1 >nul

echo Opening preview in your browser...
start "" http://localhost:3000

echo Ready. To stop preview, close the "Textvas Live Server" window.
