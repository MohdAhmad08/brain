from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.core.config import settings
from backend.app.database.models import Base

# sqlite connection configuration (with thread checking disabled since FastAPI handles multithreading)
engine = create_engine(
    settings.DATABASE_URL, 
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Create all SQLite database tables if they do not exist."""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Dependency injection yield for database sessions in FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
