# Local Media Brain - 100% Offline AI Personal Brain

Build a production-ready, completely offline desktop application ("Local Media Brain") inspired by NotebookLM and Perplexity. It allows users to watch folders for local media (videos, audio, PDFs, Docx, PPTX, images, texts), automatically extract and transcribe speech, segment dialogues, generate insights and visual entity relationship networks, and engage in semantic search and RAG QA chat with precise citation sources, timestamps, and page numbers.

## 🚀 High-Level Architecture & Pipeline

```
Local Folders Scan ---> Watchdog Service ---> Extracted Assets (Raw, Audio, Text)
                                                     |
                                                     v
                            [Neural Transcription & Diarization Pipeline]
                                                     |
                                                     v
                                       Topic Segmentation & LLM Insights
                                                     |
                                                     v
                                  Sentence Embedding & Vector Indexing (ChromaDB)
                                                     |
                                                     v
                              [Hybrid Search Engine & Local LLM Citation Q&A]
```

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, Next.js (App Router), Tailwind CSS, TypeScript, Lucide Icons |
| **Desktop Wrapper** | Tauri (Rust compilation config) |
| **Backend API** | FastAPI (Python) |
| **Speech-to-Text** | Faster-Whisper (Whisper.cpp compiler core) |
| **Speaker Diarization** | Pyannote.audio (Hugging Face Gated Pipeline) |
| **OCR Text Extraction** | Tesseract OCR & PDFPlumber |
| **Local LLM** | Ollama (Llama 3 / Qwen 2.5/3 compatibility API) |
| **Embeddings** | Sentence-Transformers (all-MiniLM-L6-v2) |
| **Vector Index** | ChromaDB (Cosine similarity space) |
| **Keyword Search** | BM25 Okapi |
| **Structured Metadata DB**| SQLite |

---

## 🛡️ Robust Fallback Service Architecture

Installing deep learning dependencies locally can be highly problematic on various systems due to C++ compilation environments, GPU drivers (CUDA), or network gates (Hugging Face tokens for model access). 

To ensure the application runs **100% reliably out-of-the-box**, we have built a **Zero-Blocking Fallback Engine**:
1. **Transcription (Faster-Whisper)**: Defaults to Neural Faster-Whisper, but automatically falls back to a WAV-duration dialog simulator that generates structured dialogue turns for testing the pipeline if dependencies fail.
2. **Speaker Diarization (Pyannote)**: Falls back to a smart turn-taking dialogue segmenter that groups conversational turns by speaker pause durations.
3. **Vector Database (ChromaDB)**: Falls back to a flat-file **NumPy-based cosine similarity index** inside SQLite if ChromaDB compilation fails.
4. **Local LLM (Ollama)**: Falls back to rule-based keyword summaries, capital-case entity clustering, and keyword similarity search RAG synthesis if Ollama is unreachable.
5. **Background worker queue**: Spawns an in-process Python thread worker pool by default instead of Celery/Redis, ensuring native Windows execution without WSL setup.

---

## ⚙️ Prerequisites

To leverage the full deep-learning features of the pipeline:
1. **FFmpeg**: Install FFmpeg and add it to your system PATH (required for audio extraction).
2. **Tesseract OCR**: Install Tesseract OCR on your machine (required for image text extraction).
3. **Ollama**: Download and run Ollama locally:
   ```bash
   ollama pull qwen2.5:7b
   ```
4. **Python**: Python 3.10 to 3.12 is recommended (due to PyTorch wheel compatibilities).

---

## ⚡ Quickstart

### Setup Dependencies
Run the setup script corresponding to your operating system to build the Python virtual environment, install backend packages, and fetch frontend Node modules:

* **Windows**:
  ```cmd
  setup.bat
  ```
* **macOS / Linux**:
  ```bash
  chmod +x setup.sh
  ./setup.sh
  ```

### Run Server Environments
Run the execution script to spin up the FastAPI Backend (`http://127.0.0.1:8000`) and the Next.js Dev Client (`http://localhost:3000`) concurrently in separate consoles:

* **Windows**:
  ```cmd
  run.bat
  ```
* **macOS / Linux**:
  ```bash
  ./run.sh
  ```

---

## 💻 UI Walkthrough

1. **Dashboard**: Live queue statuses, compositing library charts, directory watched synchronization portals, and drag-drop upload modules.
2. **Media Library**: Filters files by category, shows ingestion statuses, and supports deleting or opening resources.
3. **Synced Player**: Side-by-side interactive transcript scroll blocks synchronized with video/audio playbacks. Click lines to seek instantly. Rename speakers on-the-fly.
4. **AI RAG Chat**: NotebookLM-style search panel. Tick specific context files in the sources panel, ask questions, and hover/click bracket references (e.g. `[1]`) to load citations.
5. **Semantic Search**: Slider to balance keyword (BM25) vs vector matches, displaying similarity percentage lines.
6. **Knowledge Graph**: Interactive network canvas visualizing entity relations. Click nodes to open background notes.
7. **Smart Notes**: Split-pane markdown editor and visualizer supporting links to audio files and exports to MD, PDF, Docx, or HTML.
8. **Timeline**: Visualized chronologies matching meetings topic transitions.
