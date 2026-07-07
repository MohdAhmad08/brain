import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Local Media Brain"
    API_V1_STR: str = "/api/v1"

    # Base workspace paths
    BASE_DIR: Path = Path("/tmp") if os.environ.get("VERCEL") == "1" else Path(__file__).resolve().parent.parent.parent.parent
    STORAGE_DIR: Path = BASE_DIR / "storage"
    
    # Storage subdirectories
    @property
    def RAW_DIR(self) -> Path:
        return self.STORAGE_DIR / "raw"
        
    @property
    def AUDIO_DIR(self) -> Path:
        return self.STORAGE_DIR / "audio"
        
    @property
    def TRANSCRIPTS_DIR(self) -> Path:
        return self.STORAGE_DIR / "transcripts"
        
    @property
    def PROCESSED_DIR(self) -> Path:
        return self.STORAGE_DIR / "processed"
        
    @property
    def EMBEDDINGS_DIR(self) -> Path:
        return self.STORAGE_DIR / "embeddings"
        
    @property
    def THUMBNAILS_DIR(self) -> Path:
        return self.STORAGE_DIR / "thumbnails"

    # Database
    DATABASE_PATH: Path = BASE_DIR / "database" / "media.db"
    
    @property
    def DATABASE_URL(self) -> str:
        db_path = self.DATABASE_PATH
        # Ensure parent directory exists
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path}"

    # AI Models Configs
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"
    
    # Hugging Face token for gated models (like pyannote/speaker-diarization-3.1)
    HF_TOKEN: str = ""

    # Worker options
    USE_CELERY: bool = False
    REDIS_URL: str = "redis://localhost:6379/0"

    # Fallback configs if C++ libraries fail to import or compile
    FORCE_FALLBACK_VECTOR_DB: bool = False
    FORCE_FALLBACK_EMBEDDINGS: bool = False

    # Directories configured by the user to sync/watch
    WATCHED_DIRECTORIES: List[str] = []

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def create_directories(self):
        """Create storage directories if they do not exist."""
        self.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        self.RAW_DIR.mkdir(parents=True, exist_ok=True)
        self.AUDIO_DIR.mkdir(parents=True, exist_ok=True)
        self.TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
        self.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        self.EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)
        self.THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
        self.DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

settings = Settings()
settings.create_directories()

if settings.HF_TOKEN:
    import os
    os.environ["HF_TOKEN"] = settings.HF_TOKEN
