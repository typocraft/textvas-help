@echo off
setlocal
cd /d "%~dp0"

echo Starting live preview server in a new window...
start "Textvas Live Server" cmd /k "cd /d ""%~dp0"" && node serve.js"
timeout /t 1 >nul

echo Opening browser preview...
start "" http://localhost:3000

echo Opening index.html in Notepad...
start "" notepad.exe "%~dp0index.html"

echo Ready. Save with Ctrl+S and the browser should reload automatically.
echo To stop preview, close the "Textvas Live Server" window.
