@echo off
setlocal

echo.
echo Setting up Prototype Playground...
echo.

:: ── Check Node.js ─────────────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Opening nodejs.org...
  start https://nodejs.org
  echo.
  echo Install Node.js, then double-click install.bat again to continue.
  pause
  exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER%

:: ── Check Git ─────────────────────────────────────────────────────────────────
where git >nul 2>&1
if errorlevel 1 (
  echo Git is required. Opening download page...
  start https://git-scm.com/download/win
  echo.
  echo Install Git, then double-click install.bat again to continue.
  pause
  exit /b 1
)

for /f "tokens=3" %%i in ('git --version') do set GIT_VER=%%i
echo [OK] Git %GIT_VER%

:: ── Clone or update ───────────────────────────────────────────────────────────
set DEST=%USERPROFILE%\Documents\prototype-playground

if exist "%DEST%" (
  echo.
  echo Folder already exists -- pulling latest changes...
  git -C "%DEST%" pull
) else (
  echo.
  echo Downloading Prototype Playground...
  git clone https://github.com/jose-huge/prototype-playground.git "%DEST%"
)

:: ── Install dependencies ──────────────────────────────────────────────────────
echo.
echo Installing dependencies (this takes about 30-60 seconds)...
cd /d "%DEST%"
call npm install

:: ── Start dev server ──────────────────────────────────────────────────────────
echo.
echo Starting Prototype Playground...
start /b cmd /c "cd /d "%DEST%" && npm run dev > .dev.log 2>&1"

:: ── Open browser ─────────────────────────────────────────────────────────────
echo Waiting for server to start...
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo [OK] Prototype Playground is running at localhost:3000
echo.
pause
endlocal
