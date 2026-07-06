import logging
from pathlib import Path
from typing import List, Dict, Any

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# Try to import pyannote.audio, fallback if unavailable
HAS_PYANNOTE = False
try:
    from pyannote.audio import Pipeline
    import torch
    HAS_PYANNOTE = True
except ImportError:
    logger.warning("pyannote.audio package not found. Using local speaker-alternation diarization fallback.")

class DiarizationService:
    def __init__(self):
        self.pipeline = None
        self._init_pipeline()

    def _init_pipeline(self):
        """Initialize the Pyannote speaker diarization pipeline if HF token is configured."""
        if not HAS_PYANNOTE:
            return
            
        token = settings.HF_TOKEN
        if not token:
            logger.info("Hugging Face token not configured. Skipping pyannote.audio initialization. Will use fallback.")
            return

        try:
            logger.info("Initializing pyannote.audio speaker diarization pipeline...")
            # We use standard speaker-diarization pipeline (currently 3.1)
            self.pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=token
            )
            # Send pipeline to GPU if PyTorch supports it
            if torch.cuda.is_available() and os.environ.get("USE_GPU") == "true":
                self.pipeline = self.pipeline.to(torch.device("cuda"))
                logger.info("pyannote.audio pipeline loaded on CUDA.")
            else:
                logger.info("pyannote.audio pipeline loaded on CPU.")
        except Exception as e:
            logger.error(f"Failed to initialize pyannote.audio pipeline: {e}. Falling back to rule-based speaker diarizer.")
            self.pipeline = None

    def diarize(self, audio_path: Path, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Assign speaker labels to transcription segments."""
        if not segments:
            return []

        # If the segments already have speaker labels assigned (e.g. by the wave fallback simulator), return them
        if any("speaker_label" in seg for seg in segments):
            logger.info("Segments already diarized by transcription service. Skipping.")
            return segments

        # 1. Try Pyannote Diarization if initialized
        if self.pipeline is not None:
            try:
                logger.info(f"Running pyannote diarization on {audio_path.name}...")
                diarization_result = self.pipeline(str(audio_path))
                
                # Apply speaker labels to our segments by finding overlap
                diarized_segments = []
                for seg in segments:
                    seg_start = seg["start"]
                    seg_end = seg["end"]
                    
                    # Find which speaker speaks most during this segment window
                    speaker_durations = {}
                    for turn, _, speaker in diarization_result.itertracks(yield_label=True):
                        overlap_start = max(seg_start, turn.start)
                        overlap_end = min(seg_end, turn.end)
                        overlap = overlap_end - overlap_start
                        
                        if overlap > 0:
                            speaker_durations[speaker] = speaker_durations.get(speaker, 0.0) + overlap
                            
                    # Assign the speaker with the highest overlap, defaulting to SPEAKER_00
                    assigned_speaker = "SPEAKER_00"
                    if speaker_durations:
                        assigned_speaker = max(speaker_durations, key=speaker_durations.get)
                        
                    seg["speaker_label"] = assigned_speaker
                    diarized_segments.append(seg)
                    
                logger.info("Pyannote speaker diarization complete.")
                return diarized_segments
            except Exception as e:
                logger.error(f"Error during pyannote diarization: {e}. Falling back to rule-based diarizer.")

        # 2. Rule-based local fallback diarization
        return self._run_rule_based_fallback(segments)

    def _run_rule_based_fallback(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Fallback speaker diarizer. Clusters conversation turns into alternating speakers."""
        logger.info("Running fallback speaker diarization...")
        
        diarized_segments = []
        current_speaker_idx = 0
        speakers = ["SPEAKER_00", "SPEAKER_01", "SPEAKER_02"]
        
        for i, seg in enumerate(segments):
            # Check pause duration between this segment and the previous one
            # If the pause is long (> 2.0s), or if there is a random change (simulating a dialog turn), alternate speakers
            if i > 0:
                prev_seg = segments[i - 1]
                pause = seg["start"] - prev_seg["end"]
                
                # Turn-taking heuristic: long pause or segment length threshold
                if pause > 2.0 or (seg["end"] - seg["start"] > 15.0):
                    current_speaker_idx = (current_speaker_idx + 1) % len(speakers)
                    
            seg["speaker_label"] = speakers[current_speaker_idx]
            diarized_segments.append(seg)
            
        return diarized_segments
