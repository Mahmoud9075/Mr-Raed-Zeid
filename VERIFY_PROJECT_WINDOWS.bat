@echo off
setlocal
cd /d %~dp0

if exist .venv\Scripts\python.exe (
  set PYTHON_EXE=%CD%\.venv\Scripts\python.exe
) else if exist ..\.venv\Scripts\python.exe (
  set PYTHON_EXE=%CD%\..\.venv\Scripts\python.exe
) else (
  set PYTHON_EXE=python
)

echo === Backend tests ===
cd /d %~dp0backend
set PYTHONPATH=.
%PYTHON_EXE% -m pytest -q
if errorlevel 1 goto :fail

echo.
echo === Frontend TypeScript ===
cd /d %~dp0frontend
call npx tsc --noEmit
if errorlevel 1 goto :fail

echo.
echo ALL LOCAL CHECKS PASSED.
pause
exit /b 0

:fail
echo.
echo CHECK FAILED. Review the error above.
pause
exit /b 1
