from typing import List, Optional, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
import io
import os

from backend.app.database.connection import get_db
from backend.app.database.models import Note, Media
from backend.app.services.export.exporter import DocumentExporter
from backend.app.core.config import settings

router = APIRouter()

class NoteBase(BaseModel):
    title: str
    content: str
    media_id: Optional[int] = None
    timestamp: Optional[float] = None

class NoteCreate(NoteBase):
    pass

class NoteUpdate(NoteBase):
    pass

class NoteResponse(NoteBase):
    id: int
    created_at: Any
    updated_at: Any
    file_name: Optional[str] = None # Linked media title if available

    class Config:
        from_attributes = True

@router.get("", response_model=List[dict])
def list_notes(
    media_id: Optional[int] = None, 
    db: Session = Depends(get_db)
):
    """List all created notes."""
    query = db.query(Note)
    if media_id:
        query = query.filter(Note.media_id == media_id)
        
    notes = query.order_by(Note.updated_at.desc()).all()
    results = []
    for n in notes:
        media_name = None
        if n.media:
            media_name = n.media.file_name
            
        results.append({
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "media_id": n.media_id,
            "file_name": media_name,
            "timestamp": n.timestamp,
            "created_at": n.created_at,
            "updated_at": n.updated_at
        })
    return results

@router.get("/{note_id}", response_model=dict)
def get_note(note_id: int, db: Session = Depends(get_db)):
    """Retrieve detailed note structure."""
    n = db.query(Note).filter(Note.id == note_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Note not found.")
        
    media_name = None
    if n.media:
        media_name = n.media.file_name
        
    return {
        "id": n.id,
        "title": n.title,
        "content": n.content,
        "media_id": n.media_id,
        "file_name": media_name,
        "timestamp": n.timestamp,
        "created_at": n.created_at,
        "updated_at": n.updated_at
    }

@router.post("", response_model=dict)
def create_note(note_data: NoteCreate, db: Session = Depends(get_db)):
    """Create a new note."""
    note = Note(
        title=note_data.title,
        content=note_data.content,
        media_id=note_data.media_id,
        timestamp=note_data.timestamp
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return {"message": "Note created successfully.", "id": note.id}

@router.put("/{note_id}", response_model=dict)
def update_note(
    note_id: int, 
    note_data: NoteUpdate, 
    db: Session = Depends(get_db)
):
    """Edit note text content or titles."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")

    note.title = note_data.title
    note.content = note_data.content
    note.media_id = note_data.media_id
    note.timestamp = note_data.timestamp
    db.commit()
    return {"message": "Note updated successfully."}

@router.delete("/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    """Delete a note."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    db.delete(note)
    db.commit()
    return {"message": "Note deleted successfully."}

@router.get("/{note_id}/export")
def export_note(
    note_id: int, 
    file_format: str = Query("md", alias="format", description="Format to export (pdf, docx, html, md, json)"),
    db: Session = Depends(get_db)
):
    """Exports a note to PDF, Word (Docx), Markdown, HTML or JSON files."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")

    title = note.title
    content = note.content
    file_format = file_format.lower()

    # Create temporary directory inside storage
    export_dir = settings.STORAGE_DIR / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)

    if file_format == "md":
        export_text = DocumentExporter.to_markdown(title, content)
        return Response(
            content=export_text, 
            media_type="text/markdown", 
            headers={"Content-Disposition": f"attachment; filename={note_id}_export.md"}
        )
        
    elif file_format == "html":
        export_text = DocumentExporter.to_html(title, content)
        return Response(
            content=export_text, 
            media_type="text/html", 
            headers={"Content-Disposition": f"attachment; filename={note_id}_export.html"}
        )
        
    elif file_format == "json":
        export_text = DocumentExporter.to_json(title, content)
        return Response(
            content=export_text, 
            media_type="application/json", 
            headers={"Content-Disposition": f"attachment; filename={note_id}_export.json"}
        )
        
    elif file_format == "docx":
        out_path = export_dir / f"{note_id}_export.docx"
        DocumentExporter.to_docx(title, content, out_path)
        return FileResponse(
            path=str(out_path), 
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=f"{title.replace(' ', '_')}.docx"
        )
        
    elif file_format == "pdf":
        out_path = export_dir / f"{note_id}_export.pdf"
        DocumentExporter.to_pdf(title, content, out_path)
        return FileResponse(
            path=str(out_path), 
            media_type="application/pdf", 
            filename=f"{title.replace(' ', '_')}.pdf"
        )
        
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {file_format}")
