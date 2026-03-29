@echo off
setlocal

cd /d "%~dp0"

if not exist "..\frontend\dist\index.html" (
  echo Frontend build not found. Building frontend...
  pushd "..\frontend"
  call npm run build
  if errorlevel 1 (
    echo Frontend build failed.
    popd
    exit /b 1
  )
  popd
)

if exist ".venv\Scripts\python.exe" (
  echo Syncing backend dependencies...
  call ".venv\Scripts\python.exe" -m pip install -r requirements.txt
  if errorlevel 1 (
    echo Backend dependency install failed.
    exit /b 1
  )
)

if exist ".venv\Scripts\pyinstaller.exe" (
  set "PYINSTALLER=.venv\Scripts\pyinstaller.exe"
) else (
  set "PYINSTALLER=pyinstaller"
)

%PYINSTALLER% --noconfirm "Sagar Loom Tex Windows.spec"
if errorlevel 1 (
  echo Windows build failed.
  exit /b 1
)

echo.
echo Windows build complete.
echo Output: dist\Sagar Loom Tex.exe
