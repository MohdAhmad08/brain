@echo off
echo ===================================================
echo             Local Media Brain - Setup
echo ===================================================
echo.

:: 1. Check Node.js
echo Checking Node.js installation...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js v18+.
    exit /b 1
)
echo [OK] Node.js detected.

:: 2. Check Python
echo Checking Python installation...
py -3 --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=py -3
) else (
    python --version >nul 2>&1
    if %errorlevel% equ 0 (
        set PYTHON_CMD=python
    ) else (
        echo [ERROR] Python 3 is not found. Please install Python 3.10-3.12 and add it to PATH.
        exit /b 1
    )
)
echo [OK] Python command selected: %PYTHON_CMD%

:: 3. Setup Virtual Environment
echo Creating Python virtual environment...
%PYTHON_CMD% -m venv .venv
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create virtual environment.
    exit /b 1
)
echo [OK] Virtual environment created.

:: 4. Install backend dependencies
echo Installing Python backend dependencies...
call .venv\Scripts\activate
pip install --upgrade pip
pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [WARNING] Some heavy pip dependencies failed to compile. Fallback modes will trigger in-app.
)
echo [OK] Backend dependencies setup complete.

:: 5. Install frontend dependencies
echo Installing Node.js frontend dependencies...
cd frontend
call npm.cmd install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo [ERROR] Frontend dependencies installation failed.
    cd ..
    exit /b 1
)
cd ..
echo [OK] Frontend dependencies setup complete.

:: 6. Setup local folders
echo Initializing storage structures...
if not exist "storage" mkdir storage
if not exist "database" mkdir database

echo.
echo ===================================================
echo [SUCCESS] Setup complete!
echo.
echo To run the application, launch "run.bat"
echo Make sure Ollama is running on your machine.
echo ===================================================
pause
