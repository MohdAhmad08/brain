import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class TranscriptSegmenter:
    # Set of common filler words to strip
    FILLER_WORDS = {
        r'\buh\b', r'\bum\b', r'\bhmm\b', r'\bah\b', 
        r'\beh\b', r'\ber\b', r'\bouh\b', r'\blike,\b',
        r'\buh-huh\b', r'\bmhm\b'
    }

    @classmethod
    def clean_text(cls, text: str) -> str:
        """Clean transcript text by removing filler words and cleaning whitespaces."""
        cleaned = text
        for filler in cls.FILLER_WORDS:
            cleaned = re.sub(filler, '', cleaned, flags=re.IGNORECASE)
        
        # Clean up multiple whitespaces
        cleaned = re.sub(r'\s+', ' ', cleaned)
        return cleaned.strip()

    @classmethod
    def format_paragraphs(cls, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Groups small segment utterances by the same speaker into larger, 
        more readable paragraphs to avoid visual clutter.
        """
        if not segments:
            return []

        paragraphs = []
        current_para = None

        for seg in segments:
            # Clean segment text
            cleaned_text = cls.clean_text(seg["text"])
            if not cleaned_text:
                continue

            speaker = seg.get("speaker_label", "SPEAKER_00")
            
            # Initialize first paragraph
            if current_para is None:
                current_para = {
                    "speaker_label": speaker,
                    "text": cleaned_text,
                    "start": seg["start"],
                    "end": seg["end"],
                    "segments": [seg]
                }
            # Append to current paragraph if same speaker and gap is small (< 5.0 seconds)
            elif current_para["speaker_label"] == speaker and (seg["start"] - current_para["end"] < 5.0):
                current_para["text"] += " " + cleaned_text
                current_para["end"] = seg["end"]
                current_para["segments"].append(seg)
            # Create new paragraph if speaker changed or gap is large
            else:
                paragraphs.append(current_para)
                current_para = {
                    "speaker_label": speaker,
                    "text": cleaned_text,
                    "start": seg["start"],
                    "end": seg["end"],
                    "segments": [seg]
                }
                
        if current_para:
            paragraphs.append(current_para)
            
        return paragraphs

    @classmethod
    def chunk_transcript(cls, paragraphs: List[Dict[str, Any]], max_chunk_words: int = 250) -> List[Dict[str, Any]]:
        """
        Splits structured paragraphs into sliding-window text chunks 
        suitable for generating embeddings and vector storage.
        """
        chunks = []
        chunk_index = 0
        
        current_chunk_words = []
        chunk_start = None
        chunk_end = None
        
        for para in paragraphs:
            words = para["text"].split()
            para_start = para["start"]
            para_end = para["end"]
            
            # Heuristic to calculate time offset per word inside paragraph
            para_duration = para_end - para_start
            word_duration = para_duration / max(len(words), 1)
            
            for idx, word in enumerate(words):
                word_time_offset = para_start + (idx * word_duration)
                
                if chunk_start is None:
                    chunk_start = word_time_offset
                    
                current_chunk_words.append(word)
                chunk_end = word_time_offset + word_duration
                
                if len(current_chunk_words) >= max_chunk_words:
                    chunks.append({
                        "chunk_index": chunk_index,
                        "text": f"[{para['speaker_label']}]: " + " ".join(current_chunk_words),
                        "start_time": round(chunk_start, 2),
                        "end_time": round(chunk_end, 2),
                        "page_number": None
                    })
                    chunk_index += 1
                    
                    # Slide window by keeping last 30% of words for overlap context
                    overlap_count = int(max_chunk_words * 0.3)
                    current_chunk_words = current_chunk_words[-overlap_count:]
                    if current_chunk_words:
                        chunk_start = chunk_end - (len(current_chunk_words) * word_duration)
                    else:
                        chunk_start = None
                        
        # Append remaining words as final chunk
        if current_chunk_words:
            chunks.append({
                "chunk_index": chunk_index,
                "text": " ".join(current_chunk_words),
                "start_time": round(chunk_start if chunk_start is not None else 0.0, 2),
                "end_time": round(chunk_end if chunk_end is not None else 0.0, 2),
                "page_number": None
            })
            
        return chunks

    @classmethod
    def chunk_document(cls, text: str, max_chunk_chars: int = 1000, overlap_chars: int = 200) -> List[Dict[str, Any]]:
        """
        Splits flat extracted document text into chunks 
        for vector indexing, using character lengths.
        """
        chunks = []
        chunk_index = 0
        
        # Strip duplicate newlines
        cleaned_text = re.sub(r'\n{3,}', '\n\n', text).strip()
        if not cleaned_text:
            return []
            
        start = 0
        while start < len(cleaned_text):
            end = min(start + max_chunk_chars, len(cleaned_text))
            
            # Try to align chunk boundary to a paragraph or sentence end
            if end < len(cleaned_text):
                # Search backwards for double newline (paragraph boundary)
                para_boundary = cleaned_text.rfind('\n\n', start, end)
                if para_boundary > start + (max_chunk_chars * 0.5):
                    end = para_boundary + 2
                else:
                    # Search backwards for sentence end (period)
                    sentence_boundary = cleaned_text.rfind('. ', start, end)
                    if sentence_boundary > start + (max_chunk_chars * 0.5):
                        end = sentence_boundary + 2
                        
            chunk_text = cleaned_text[start:end].strip()
            if chunk_text:
                chunks.append({
                    "chunk_index": chunk_index,
                    "text": chunk_text,
                    "start_time": None,
                    "end_time": None,
                    "page_number": None
                })
                chunk_index += 1
                
            start = end
            # Slide window back by overlap
            if start < len(cleaned_text):
                start = max(start - overlap_chars, 0)
                if start == 0:
                    break # infinite loop guard
                    
        return chunks
