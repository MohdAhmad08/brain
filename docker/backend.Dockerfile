FROM python:3.11-slim

# Install system dependencies including FFmpeg and Tesseract OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Copy requirements and install python packages
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY backend/ ./backend/
COPY database/ ./database/
COPY storage/ ./storage/

# Expose FastAPI port
EXPOSE 8000

ENV PYTHONPATH=/workspace

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
