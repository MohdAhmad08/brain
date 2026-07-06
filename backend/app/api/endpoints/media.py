import os
import shutil
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.connection import get_db
from backend.app.database.models import Media, Transcript, Speaker
from backend.app.services.ingestion.pipeline import IngestionPipeline
from backend.app.services.ingestion.watcher import FolderWatcherService
from backend.app.core.worker import submit_ingestion_task

router = APIRouter()

@router.post("/upload")
def upload_media_file(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    """API endpoint to manually upload a local media asset."""
    settings.create_directories()
    dest_path = settings.RAW_DIR / file.filename
    
    # Save the file locally in storage/raw
    try:
        with dest_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file to disk: {e}")
        
    # Queue the file for processing
    submit_ingestion_task(dest_path)
    return {"message": f"File '{file.filename}' uploaded and queued for processing.", "path": str(dest_path)}

@router.get("", response_model=List[dict])
def list_media_assets(
    status: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    """Retrieve metadata records of all registered media assets."""
    query = db.query(Media)
    if status:
        query = query.filter(Media.status == status)
    
    media_list = query.order_by(Media.created_at.desc()).all()
    
    results = []
    for m in media_list:
        results.append({
            "id": m.id,
            "file_path": m.file_path,
            "file_hash": m.file_hash,
            "file_name": m.file_name,
            "file_size": m.file_size,
            "mime_type": m.mime_type,
            "duration": m.duration,
            "thumbnail_path": f"/api/v1/media/thumbnail/{m.id}" if m.thumbnail_path else None,
            "status": m.status,
            "error_message": m.error_message,
            "created_at": m.created_at,
            "updated_at": m.updated_at
        })
    return results

@router.get("/{media_id}")
def get_media_detail(media_id: int, db: Session = Depends(get_db)):
    """Retrieve details, full transcripts, and chapters of a specific media resource."""
    media = db.query(Media).filter(Media.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media asset not found.")

    import json
    # Fetch transcript if processed
    transcript_data = None
    if media.transcript:
        word_data = []
        if media.transcript.word_level_data:
            try:
                word_data = json.loads(media.transcript.word_level_data)
            except Exception:
                pass
                
        transcript_data = {
            "id": media.transcript.id,
            "full_text": media.transcript.full_text,
            "language": media.transcript.language,
            "segments": word_data
        }

    # Fetch topics/chapters
    topics_list = []
    for t in media.topics:
        topics_list.append({
            "id": t.id,
            "title": t.title,
            "summary": t.summary,
            "start_time": t.start_time,
            "end_time": t.end_time
        })

    # Fetch speakers
    speakers_list = []
    for s in media.speakers:
        speakers_list.append({
            "id": s.id,
            "label": s.label,
            "display_name": s.display_name
        })

    # Fetch chunks list
    chunks_list = []
    for c in sorted(media.chunks, key=lambda x: x.chunk_index):
        chunks_list.append({
            "id": c.id,
            "text": c.text,
            "start_time": c.start_time,
            "end_time": c.end_time,
            "page_number": c.page_number,
            "chunk_index": c.chunk_index
        })

    # Load insights JSON
    insights_data = None
    processed_path = settings.PROCESSED_DIR / f"{media.id}_insights.json"
    if processed_path.exists():
        try:
            with open(processed_path, "r", encoding="utf-8") as f:
                insights_data = json.load(f)
        except Exception:
            pass

    return {
        "id": media.id,
        "file_name": media.file_name,
        "file_path": media.file_path,
        "mime_type": media.mime_type,
        "duration": media.duration,
        "status": media.status,
        "error_message": media.error_message,
        "transcript": transcript_data,
        "topics": topics_list,
        "speakers": speakers_list,
        "chunks": chunks_list,
        "insights": insights_data
    }

@router.delete("/{media_id}")
def delete_media_asset(media_id: int, db: Session = Depends(get_db)):
    """Deletes the database records and indexing vectors associated with a media ID."""
    media = db.query(Media).filter(Media.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media asset not found.")

    # Remove from Vector index
    from backend.app.services.indexing.vector_store import VectorStore
    vstore = VectorStore()
    vstore.delete_by_media_id(media_id)

    # Delete physical audio/thumbnail if they exist in storage
    try:
        # We don't delete original raw user files to prevent data loss, but we can delete extracted wavs
        if media.thumbnail_path and os.path.exists(media.thumbnail_path) and "thumbnails" in media.thumbnail_path:
            os.remove(media.thumbnail_path)
    except Exception:
        pass

    db.delete(media)
    db.commit()
    return {"message": f"Media asset {media_id} and indices deleted successfully."}

@router.post("/sync-folders")
def trigger_folder_sync(
    directories: List[str], 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Recursively scans directories for new files and queues them."""
    settings.WATCHED_DIRECTORIES = directories
    # Update active watcher
    # Wait, we will run the scanner in background
    def run_sync():
        for d in directories:
            files = FolderWatcherService.scan_directory(d)
            for f in files:
                submit_ingestion_task(f)
                
    background_tasks.add_task(run_sync)
    return {"message": f"Sync started recursively for {len(directories)} directories in the background."}

@router.put("/speakers/{speaker_id}")
def rename_speaker(
    speaker_id: int, 
    display_name: str = Form(...), 
    db: Session = Depends(get_db)
):
    """Edits display names of speakers across transcripts (e.g. mapping SPEAKER_00 to 'John Doe')."""
    speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker record not found.")

    old_label = speaker.label
    media_id = speaker.media_id
    speaker.display_name = display_name
    db.commit()

    # Update names in transcript word-level lists to match renaming
    media = db.query(Media).filter(Media.id == media_id).first()
    if media and media.transcript:
        import json
        try:
            segments = json.loads(media.transcript.word_level_data)
            for seg in segments:
                if seg.get("speaker_label") == old_label:
                    seg["display_name"] = display_name
            media.transcript.word_level_data = json.dumps(segments)
            db.commit()
        except Exception:
            pass

    return {"message": f"Speaker label '{old_label}' updated to name '{display_name}'."}

@router.get("/thumbnail/{media_id}")
def get_thumbnail(media_id: int, db: Session = Depends(get_db)):
    """Yields the raw image bytes of a media asset's thumbnail."""
    from fastapi.responses import FileResponse
    media = db.query(Media).filter(Media.id == media_id).first()
    if not media or not media.thumbnail_path or not os.path.exists(media.thumbnail_path):
        # Return fallback system thumbnail or 404
        raise HTTPException(status_code=404, detail="Thumbnail not available.")
    return FileResponse(media.thumbnail_path)
