import hashlib
import logging
from typing import List
import numpy as np
import requests

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# Try to import sentence-transformers, fallback if not available
HAS_SENTENCE_TRANSFORMERS = False
try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    logger.warning("sentence-transformers package not found. Will use Ollama or deterministic hash-vector fallback.")

class EmbeddingService:
    _shared_model = None

    def __init__(self):
        self.model = None
        self.dimension = 384 # Default dimension for all-MiniLM-L6-v2, or 384 for bge-small-en-v1.5
        self._init_model()

    def _init_model(self):
        """Initialize sentence-transformers model if available and not forced to fallback."""
        if settings.FORCE_FALLBACK_EMBEDDINGS or not HAS_SENTENCE_TRANSFORMERS:
            logger.info("Using API-based / hash-based embedding fallbacks.")
            return

        if EmbeddingService._shared_model is not None:
            self.model = EmbeddingService._shared_model
            self.dimension = 384
            return

        try:
            logger.info("Initializing local SentenceTransformer model ('all-MiniLM-L6-v2')...")
            # We use a standard lightweight model that downloads and compiles quickly
            EmbeddingService._shared_model = SentenceTransformer("all-MiniLM-L6-v2")
            self.model = EmbeddingService._shared_model
            self.dimension = 384
            logger.info("SentenceTransformer model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load SentenceTransformer: {e}. Switching to Ollama/hash-based fallbacks.")
            self.model = None

    def get_embedding(self, text: str) -> List[float]:
        """Generate vector embedding for a single text string."""
        if not text.strip():
            return [0.0] * self.dimension

        # 1. Use local SentenceTransformer if loaded
        if self.model is not None:
            try:
                vec = self.model.encode(text, convert_to_numpy=True)
                return vec.tolist()
            except Exception as e:
                logger.error(f"SentenceTransformer encoding error: {e}. Trying fallback.")

        # 2. Try Ollama embeddings if configured & reachable
        try:
            url = f"{settings.OLLAMA_URL}/api/embeddings"
            payload = {
                "model": settings.OLLAMA_EMBED_MODEL,
                "prompt": text
            }
            # Add timeout to fail fast if Ollama isn't running
            response = requests.post(url, json=payload, timeout=2.0)
            if response.status_code == 200:
                embedding = response.json().get("embedding")
                if embedding:
                    self.dimension = len(embedding)
                    return embedding
        except Exception:
            pass

        # 3. Deterministic pseudo-random vector fallback (Offline/Dev fallback)
        return self._generate_deterministic_vector(text)

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate vector embeddings for a list of texts."""
        if not texts:
            return []

        # Use batch encoding if using local SentenceTransformer
        if self.model is not None:
            try:
                vecs = self.model.encode(texts, convert_to_numpy=True)
                return vecs.tolist()
            except Exception as e:
                logger.error(f"SentenceTransformer batch encoding error: {e}. Running fallback loops.")

        return [self.get_embedding(text) for text in texts]

    def _generate_deterministic_vector(self, text: str) -> List[float]:
        """
        Creates a deterministic unit-length vector for a text string by seeding a
        random generator with the text's MD5 hash. Used as a bulletproof fallback.
        """
        # MD5 digest integer value
        h = hashlib.md5(text.encode('utf-8', errors='ignore')).hexdigest()
        seed = int(h[:8], 16)
        
        # Seed local numpy state so we don't affect global state
        rng = np.random.default_rng(seed)
        vec = rng.standard_normal(self.dimension)
        
        # Normalize to unit length
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
            
        return vec.tolist()
