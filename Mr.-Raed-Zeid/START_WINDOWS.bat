@echo off
setlocal
cd /d %~dp0
if not exist .env copy .env.example .env >nul
echo Starting Mr. Raed Full-Stack Platform...
echo First local admin password is in .env - CHANGE IT before public deployment.
docker compose up --build -d
if errorlevel 1 (
  echo.
  echo Docker failed. Make sure Docker Desktop is installed and running.
  pause
  exit /b 1
)
echo.
echo Site: http://localhost
echo Admin login uses the ADMIN_EMAIL and ADMIN_PASSWORD from .env
pause
