#!/bin/bash

echo "==================================================="
echo "            Local Media Brain - Setup"
echo "==================================================="
echo

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install Node.js v18+."
    exit 1
fi
echo "[OK] Node.js detected."

# 2. Check Python
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "[ERROR] Python 3 is not found. Please install Python 3.10-3.12."
    exit 1
fi
echo "[OK] Python command selected: $PYTHON_CMD"

# 3. Setup Virtual Environment
echo "Creating Python virtual environment..."
$PYTHON_CMD -m venv .venv
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to create virtual environment."
    exit 1
fi
echo "[OK] Virtual environment created."

# 4. Install backend dependencies
echo "Installing Python backend dependencies..."
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
if [ $? -ne 0 ]; then
    echo "[WARNING] Some heavy pip dependencies failed to compile. Fallback modes will trigger in-app."
fi
echo "[OK] Backend dependencies setup complete."

# 5. Install frontend dependencies
echo "Installing Node.js frontend dependencies..."
cd frontend
npm install --legacy-peer-deps
if [ $? -ne 0 ]; then
    echo "[ERROR] Frontend dependencies installation failed."
    cd ..
    exit 1
fi
cd ..
echo "[OK] Frontend dependencies setup complete."

# 6. Setup local folders
echo "Initializing storage structures..."
mkdir -p storage database

echo
echo "==================================================="
echo "[SUCCESS] Setup complete!"
echo
echo "To run the application, run './run.sh' or start servers manually"
echo "Make sure Ollama is running on your machine."
echo "==================================================="
chmod +x run.sh 2>/dev/null || true
