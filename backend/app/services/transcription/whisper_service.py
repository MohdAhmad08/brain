import os
import time
import wave
import logging
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# Try to import faster-whisper, fallback if unavailable
HAS_WHISPER = False
try:
    from faster_whisper import WhisperModel
    HAS_WHISPER = True
except ImportError:
    logger.warning("faster-whisper package not found. Using lightweight wave-based fallback transcriber.")

class WhisperService:
    def __init__(self, model_size: str = "base"):
        self.model_size = model_size
        self.model = None
        self._init_model()

    def _init_model(self):
        """Initialize the Whisper model with GPU detection or fallback to CPU."""
        if not HAS_WHISPER:
            logger.info("Whisper model is disabled (using fallback).")
            return

        try:
            # Auto-detect CUDA availability for GPU acceleration
            # Device choices: "cuda", "cpu"
            # Compute type: "float16" on GPU, "int8" or "float32" on CPU
            device = "cuda" if os.environ.get("USE_GPU") == "true" else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            
            logger.info(f"Initializing faster-whisper model '{self.model_size}' on {device}...")
            self.model = WhisperModel(self.model_size, device=device, compute_type=compute_type)
            logger.info("faster-whisper model initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize faster-whisper model: {e}. Falling back to CPU-only 'float32' mode.")
            try:
                self.model = WhisperModel(self.model_size, device="cpu", compute_type="float32")
                logger.info("faster-whisper CPU fallback model initialized successfully.")
            except Exception as ex:
                logger.error(f"Critical error initializing faster-whisper: {ex}. Disabling whisper, using fallback.")
                self.model = None

    def transcribe(self, audio_path: Path) -> Dict[str, Any]:
        """Transcribe an audio file using faster-whisper or the fallback wave simulator."""
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Check if we should use the actual whisper model
        if HAS_WHISPER and self.model is not None:
            try:
                logger.info(f"Transcribing audio file {audio_path.name}...")
                
                # Transcribe method parameters:
                # beam_size = 5 (default)
                # word_timestamps = True (for word-level timings)
                segments, info = self.model.transcribe(
                    str(audio_path), 
                    beam_size=5, 
                    word_timestamps=True
                )
                
                language = info.language
                language_probability = info.language_probability
                
                transcript_segments = []
                full_text_list = []
                
                for idx, segment in enumerate(segments):
                    words = []
                    if segment.words:
                        for word in segment.words:
                            words.append({
                                "word": word.word.strip(),
                                "start": round(word.start, 2),
                                "end": round(word.end, 2),
                                "probability": round(word.probability, 2)
                            })
                            
                    segment_data = {
                        "id": idx,
                        "text": segment.text.strip(),
                        "start": round(segment.start, 2),
                        "end": round(segment.end, 2),
                        "words": words
                    }
                    transcript_segments.append(segment_data)
                    full_text_list.append(segment.text.strip())
                    
                full_text = " ".join(full_text_list)
                logger.info(f"Transcription complete. Language detected: {language} ({language_probability:.2f})")
                
                return {
                    "full_text": full_text,
                    "language": language,
                    "segments": transcript_segments,
                    "fallback_used": False
                }
            except Exception as e:
                logger.error(f"Error during transcription: {e}. Defaulting to wave fallback.")
                
        # Wave fallback simulator
        return self._run_wave_fallback(audio_path)

    def _run_wave_fallback(self, audio_path: Path) -> Dict[str, Any]:
        """Simulates transcript segments based on wave audio duration for development safety."""
        logger.info(f"Running fallback wave simulator transcription for {audio_path.name}...")
        
        duration = 0.0
        try:
            with wave.open(str(audio_path), 'rb') as wav_file:
                frames = wav_file.getnframes()
                rate = wav_file.getframerate()
                duration = frames / float(rate)
        except Exception:
            # Default fallback duration if not a wav or corrupted
            duration = 60.0 # 1 minute fallback

        # Generate stylized dummy dialogue sentences spaced out every 8-12 seconds
        dialogue_templates = [
            ("SPEAKER_00", "Hello everyone, thanks for joining this meeting today. Let's start by reviewing the project scope."),
            ("SPEAKER_01", "Thanks, John. I completed the architectural design. The pipeline runs locally and does not depend on cloud APIs."),
            ("SPEAKER_00", "That sounds really promising. What about the database schema and indexing? Are we using SQLite?"),
            ("SPEAKER_02", "Yes, we are using SQLite for structured metadata and ChromaDB for vector indexing. It is highly offline-capable."),
            ("SPEAKER_01", "Excellent. I will set up a fallback vector index using a flat file just in case SQLite compiles fail."),
            ("SPEAKER_00", "Perfect. Let's review the timeline. Can we have the prototype completed by next Wednesday?"),
            ("SPEAKER_02", "I think so. We just need to integrate the local LLM via Ollama and hook up the React frontend."),
            ("SPEAKER_00", "Great. Let's wrap this up and get back to work. Thank you all!")
        ]

        segments = []
        current_time = 0.0
        idx = 0
        
        while current_time < duration:
            # Pick a template dialog
            speaker, text = dialogue_templates[idx % len(dialogue_templates)]
            
            # Words count estimation for segment length
            words_list = text.split()
            seg_duration = len(words_list) * 0.4 # approx 0.4s per word
            
            end_time = min(current_time + seg_duration, duration)
            
            # Synthesize words with timestamps
            words_data = []
            word_start = current_time
            for w in words_list:
                word_end = min(word_start + 0.4, end_time)
                words_data.append({
                    "word": w,
                    "start": round(word_start, 2),
                    "end": round(word_end, 2),
                    "probability": 1.0
                })
                word_start = word_end
                
            segments.append({
                "id": idx,
                "text": text,
                "start": round(current_time, 2),
                "end": round(end_time, 2),
                "words": words_data,
                "speaker_label": speaker # store speaker label directly for fallback diarizer to match
            })
            
            current_time = end_time + 1.5 # 1.5s gap between dialogues
            idx += 1

        full_text = " ".join([seg["text"] for seg in segments])
        
        return {
            "full_text": full_text,
            "language": "en",
            "segments": segments,
            "fallback_used": True
        }
