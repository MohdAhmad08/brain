import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.database.connection import init_db
from backend.app.core.worker import start_worker, stop_worker, submit_ingestion_task
from backend.app.services.ingestion.watcher import FolderWatcherService
from backend.app.api.endpoints import media, chat, notes, graph, timeline

# Configure logging layout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Folder watchdog observer reference
folder_watcher = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events coordinating DB tables, threads, and watchdog processes."""
    global folder_watcher
    logger.info("Initializing database...")
    init_db()
    
    logger.info("Starting background pipelines worker...")
    start_worker()
    
    # Initialize folder watcher for synchronizing directories
    watcher_callback = lambda path: submit_ingestion_task(path)
    folder_watcher = FolderWatcherService(process_callback=watcher_callback)
    
    if settings.WATCHED_DIRECTORIES:
        logger.info("Starting watched folders syncing watchdog observer...")
        folder_watcher.start(settings.WATCHED_DIRECTORIES)
        
    yield
    
    # Clean up operations on shutdown
    logger.info("Stopping folder watchdog observer...")
    if folder_watcher:
        folder_watcher.stop()
        
    logger.info("Stopping background worker threads...")
    stop_worker()
    logger.info("Application shutdown complete.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    docs_url="/docs"
)

# CORS configurations for local frontend clients (Next.js & Tauri)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Tauri webviews run on custom/local origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach API endpoints
app.include_router(media.router, prefix=f"{settings.API_V1_STR}/media", tags=["media"])
app.include_router(chat.router, prefix=f"{settings.API_V1_STR}/chat", tags=["chat"])
app.include_router(notes.router, prefix=f"{settings.API_V1_STR}/notes", tags=["notes"])
app.include_router(graph.router, prefix=f"{settings.API_V1_STR}/graph", tags=["graph"])
app.include_router(timeline.router, prefix=f"{settings.API_V1_STR}/timeline", tags=["timeline"])

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "api_prefix": settings.API_V1_STR
    }
