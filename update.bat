@echo off
setlocal

echo.
echo Updating Prototype Playground...
echo.

set DEST=%USERPROFILE%\Documents\prototype-playground

:: ── Check folder exists ───────────────────────────────────────────────────────
if not exist "%DEST%" (
  echo Playground folder not found at %DEST%
  echo Run install.bat first.
  pause
  exit /b 1
)

cd /d "%DEST%"

:: ── Pull latest changes ───────────────────────────────────────────────────────
echo Pulling latest changes...
git pull

:: ── Install any new dependencies ─────────────────────────────────────────────
echo.
echo Checking dependencies...
call npm install

:: ── Restart dev server ───────────────────────────────────────────────────────
echo.
echo Restarting Prototype Playground...

:: Kill any process using port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " 2^>nul') do (
  taskkill /f /pid %%a >nul 2>&1
)

start /b cmd /c "cd /d "%DEST%" && npm run dev > .dev.log 2>&1"

:: ── Open browser ─────────────────────────────────────────────────────────────
echo Waiting for server to start...
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo [OK] Prototype Playground is up to date and running at localhost:3000
echo.
pause
endlocal
