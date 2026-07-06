@echo off
echo ===================================================
echo             Local Media Brain - Runner
echo ===================================================
echo.
echo Make sure Ollama is running (http://localhost:11434).
echo.
echo Starting backend server...
start "Local Media Brain - Backend" cmd /c "call .venv\Scripts\activate && uvicorn backend.app.main:app --host 127.0.0.1 --port 8000"

echo Starting frontend client...
start "Local Media Brain - Frontend" cmd /c "cd frontend && npm.cmd run dev"

echo.
echo ===================================================
echo Servers are launching in separate windows!
echo Backend API available at: http://127.0.0.1:8000
echo Frontend dashboard available at: http://localhost:3000
echo ===================================================
echo.
pause

