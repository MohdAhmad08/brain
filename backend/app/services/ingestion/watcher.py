import os
import time
import logging
from pathlib import Path
from typing import Dict, List
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class MediaFileHandler(FileSystemEventHandler):
    def __init__(self, process_callback):
        super().__init__()
        self.process_callback = process_callback
        self.supported_extensions = {
            '.mp4', '.mkv', '.avi', '.mov', 
            '.mp3', '.wav', '.m4a', '.flac', 
            '.pdf', '.docx', '.doc', '.pptx', '.ppt', 
            '.png', '.jpg', '.jpeg', 
            '.txt', '.md'
        }

    def on_created(self, event):
        if event.is_directory:
            return
        self._handle_file(event.src_path)

    def on_modified(self, event):
        if event.is_directory:
            return
        self._handle_file(event.src_path)

    def _handle_file(self, file_path_str: str):
        path = Path(file_path_str)
        if path.suffix.lower() not in self.supported_extensions:
            return
            
        # Ignore temporary/hidden files (like Office lock files ~$filename.docx)
        if path.name.startswith("~$") or path.name.startswith("."):
            return

        logger.info(f"Watchdog detected file event: {path}")
        
        # Stabilization check: wait until the file size is stable (fully written)
        try:
            prev_size = -1
            retries = 5
            while retries > 0:
                if not path.exists():
                    return # File was deleted or moved during wait
                current_size = path.stat().st_size
                if current_size == prev_size and current_size > 0:
                    break
                prev_size = current_size
                time.sleep(1.0)
                retries -= 1
                
            # Submit to processing queue callback
            self.process_callback(path)
        except Exception as e:
            logger.error(f"Error handling watched file {path}: {e}")

class FolderWatcherService:
    def __init__(self, process_callback):
        self.process_callback = process_callback
        self.observer = None
        self.watched_paths: Dict[str, Any] = {} # path_str -> watch

    def start(self, directories: List[str]):
        """Start watching directories."""
        self.stop()
        
        self.observer = Observer()
        handler = MediaFileHandler(self.process_callback)
        
        for dir_path in directories:
            if not os.path.exists(dir_path):
                logger.warning(f"Watch directory does not exist: {dir_path}")
                continue
                
            try:
                watch = self.observer.schedule(handler, path=dir_path, recursive=True)
                self.watched_paths[dir_path] = watch
                logger.info(f"Started watching directory recursively: {dir_path}")
            except Exception as e:
                logger.error(f"Failed to watch directory {dir_path}: {e}")
                
        if self.watched_paths:
            self.observer.start()

    def update_watched_directories(self, directories: List[str]):
        """Update watched directories on settings change."""
        logger.info("Updating watched directories...")
        self.start(directories)

    def stop(self):
        """Stop watching directories."""
        if self.observer:
            try:
                self.observer.stop()
                self.observer.join()
            except Exception as e:
                logger.error(f"Error stopping observer: {e}")
            self.observer = None
            self.watched_paths = {}

    @staticmethod
    def scan_directory(directory_path: str) -> List[Path]:
        """Perform a one-time recursive scan of a directory returning all supported files."""
        supported_extensions = {
            '.mp4', '.mkv', '.avi', '.mov', 
            '.mp3', '.wav', '.m4a', '.flac', 
            '.pdf', '.docx', '.doc', '.pptx', '.ppt', 
            '.png', '.jpg', '.jpeg', 
            '.txt', '.md'
        }
        found_files = []
        path = Path(directory_path)
        if not path.exists():
            return []
            
        for root, _, files in os.walk(directory_path):
            for file in files:
                file_path = Path(root) / file
                if file_path.suffix.lower() in supported_extensions:
                    # Ignore temp files
                    if not (file.startswith("~$") or file.startswith(".")):
                        found_files.append(file_path)
                        
        return found_files
