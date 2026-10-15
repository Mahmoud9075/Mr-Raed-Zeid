@echo off
setlocal
cd /d %~dp0
if not exist .env (
  echo Missing .env. Copy .env.example to .env and set unique production secrets first.
  pause
  exit /b 1
)
echo Starting Mr. Raed Full-Stack Platform...
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
