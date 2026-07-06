from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.database.models import Media, Topic

router = APIRouter()

@router.get("", response_model=List[dict])
def get_timeline(
    media_id: Optional[int] = None, 
    db: Session = Depends(get_db)
):
    """
    Retrieves chronological segments, chapters, and file uploads across files to present a unified project timeline.
    """
    # Fetch media items
    media_query = db.query(Media)
    if media_id:
        media_query = media_query.filter(Media.id == media_id)
    media_items = media_query.all()
    
    timeline_events = []
    
    for m in media_items:
        # Map processing status to friendly descriptions
        status_desc = {
            "pending": "Pending processing...",
            "processing": "Currently processing file, extracting transcriptions and insights...",
            "completed": "Successfully processed and indexed.",
            "failed": f"Processing failed: {m.error_message or 'Unknown error'}"
        }.get(m.status, m.status)
        
        title_status = m.status.capitalize() if m.status else "Uploaded"
        
        # Add file upload anchor event
        timeline_events.append({
            "topic_id": None,
            "media_id": m.id,
            "file_name": m.file_name,
            "mime_type": m.mime_type,
            "title": f"[{title_status}] File Uploaded: {m.file_name}",
            "summary": f"Source file has been registered. {status_desc}",
            "start_time": None,
            "end_time": None,
            "file_created_at": m.created_at
        })
        
        # Add its topic events
        for t in m.topics:
            timeline_events.append({
                "topic_id": t.id,
                "media_id": t.media_id,
                "file_name": m.file_name,
                "mime_type": m.mime_type,
                "title": t.title,
                "summary": t.summary,
                "start_time": t.start_time,
                "end_time": t.end_time,
                "file_created_at": m.created_at
            })
            
    # Sort unified timeline chronologically:
    # 1. By file_created_at (descending) so newest files are first
    # 2. For the same file, the upload event (topic_id is None) comes first
    # 3. Then topic events by start_time (ascending)
    def sort_key(event):
        created_ts = event["file_created_at"].timestamp() if isinstance(event["file_created_at"], datetime) else 0
        is_topic = 0 if event["topic_id"] is None else 1
        start_val = event["start_time"] if event["start_time"] is not None else -1.0
        return (-created_ts, is_topic, start_val)
        
    timeline_events.sort(key=sort_key)
    
    # Serialize datetime for JSON response
    for ev in timeline_events:
        if isinstance(ev["file_created_at"], datetime):
            ev["file_created_at"] = ev["file_created_at"].isoformat()
            
    return timeline_events

