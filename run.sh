#!/bin/bash

echo "==================================================="
echo "            Local Media Brain - Runner"
echo "==================================================="
echo
echo "Make sure Ollama is running (http://localhost:11434)."
echo

# Activate venv and run backend in background
echo "Starting backend server..."
source .venv/bin/activate
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Run frontend in background
echo "Starting frontend client..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo
echo "==================================================="
echo "Servers are running in background processes!"
echo "Backend API: http://127.0.0.1:8000"
echo "Frontend Dashboard: http://localhost:3000"
echo "Press Ctrl+C to terminate both servers."
echo "==================================================="
echo

# Handle cleanup on exit
cleanup() {
    echo "Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Keep script running
wait
