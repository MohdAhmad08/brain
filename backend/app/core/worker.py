import os
import json
import logging
from queue import Queue
from threading import Thread
from pathlib import Path
from datetime import datetime
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.connection import SessionLocal
from backend.app.database.models import Media, Transcript, Chunk, Topic, Speaker, Entity, Relationship, Tag
from backend.app.services.ingestion.pipeline import IngestionPipeline
from backend.app.services.transcription.whisper_service import WhisperService
from backend.app.services.diarization.diarizer import DiarizationService
from backend.app.services.segmentation.segmenter import TranscriptSegmenter
from backend.app.services.embedding.embedder import EmbeddingService
from backend.app.services.indexing.vector_store import VectorStore
from backend.app.services.llm.llm_service import LLMService

logger = logging.getLogger(__name__)

# Core pipeline task queue
task_queue = Queue()
worker_thread = None
is_running = False

def start_worker():
    """Start the background in-process worker thread."""
    global worker_thread, is_running
    if worker_thread is not None and worker_thread.is_alive():
        return
        
    is_running = True
    worker_thread = Thread(target=_worker_loop, daemon=True)
    worker_thread.start()
    logger.info("Background ingestion worker thread started.")

def stop_worker():
    """Stop the background in-process worker thread."""
    global is_running
    is_running = False
    task_queue.put(None) # Sentinel to wake up and stop thread
    if worker_thread:
        worker_thread.join()
    logger.info("Background ingestion worker thread stopped.")

def submit_ingestion_task(file_path: Path):
    """Submit a local file path to the pipeline ingestion queue."""
    task_queue.put(Path(file_path))
    logger.info(f"Submitted file to queue: {file_path.name}")

def _worker_loop():
    """Continuous loop running in a separate thread processing queue items."""
    db = SessionLocal()
    
    # Initialize long-running services once inside the worker thread
    try:
        whisper_service = WhisperService()
        diarizer = DiarizationService()
        embedder = EmbeddingService()
        vector_store = VectorStore()
        llm_service = LLMService()
    except Exception as e:
        logger.error(f"Failed to initialize pipeline services: {e}")
        db.close()
        return

    while is_running:
        try:
            file_path = task_queue.get()
            if file_path is None:
                # Stop signal
                task_queue.task_done()
                break
                
            logger.info(f"Worker dequeued task: {file_path.name}")
            _process_file_pipeline(file_path, db, whisper_service, diarizer, embedder, vector_store, llm_service)
            task_queue.task_done()
        except Exception as e:
            logger.error(f"Error in worker pipeline loop: {e}", exc_info=True)
            
    db.close()

def _process_file_pipeline(
    file_path: Path, 
    db: Session,
    whisper_service: WhisperService,
    diarizer: DiarizationService,
    embedder: EmbeddingService,
    vector_store: VectorStore,
    llm_service: LLMService
):
    """Core execution sequence of the Local Media Brain pipeline."""
    # 1. Deduplicate & Calculate Hash
    file_hash = IngestionPipeline.calculate_hash(file_path)
    
    # Fetch or create Media record
    media_item = db.query(Media).filter(Media.file_hash == file_hash).first()
    if media_item and media_item.status == "completed":
        logger.info(f"File {file_path.name} already processed and indexed. Skipping.")
        return

    if not media_item:
        media_item = Media(
            file_path=str(file_path),
            file_hash=file_hash,
            file_name=file_path.name,
            file_size=file_path.stat().st_size,
            mime_type=file_path.suffix[1:].lower(),
            status="processing"
        )
        db.add(media_item)
        db.commit()
    else:
        media_item.status = "processing"
        media_item.error_message = None
        db.commit()

    try:
        # Delete old index records if overwriting/reprocessing
        vector_store.delete_by_media_id(media_item.id)
        db.query(Chunk).filter(Chunk.media_id == media_item.id).delete()
        db.query(Transcript).filter(Transcript.media_id == media_item.id).delete()
        db.query(Topic).filter(Topic.media_id == media_item.id).delete()
        db.query(Speaker).filter(Speaker.media_id == media_item.id).delete()
        db.query(Relationship).filter(Relationship.media_id == media_item.id).delete()
        db.commit()

        # 2. Extract media/metadata
        logger.info(f"Extracting file text/audio contents: {file_path.name}")
        ingest_data = IngestionPipeline.process_file(file_path)
        
        if ingest_data["error"]:
            raise RuntimeError(ingest_data["error"])

        # Update Media metadata
        media_item.mime_type = ingest_data["mime_type"]
        media_item.duration = ingest_data["duration"]
        media_item.thumbnail_path = ingest_data["thumbnail_path"]
        db.commit()

        content_text = ""
        chunks = []

        # 3. Perform Speech-to-Text & Diarization for audio/video media
        if ingest_data["extracted_audio_path"]:
            logger.info("Transcribing audio...")
            transcript_result = whisper_service.transcribe(Path(ingest_data["extracted_audio_path"]))
            
            logger.info("Running speaker diarization...")
            diarized_segments = diarizer.diarize(Path(ingest_data["extracted_audio_path"]), transcript_result["segments"])
            
            # Clean and paragraph format
            paragraphs = TranscriptSegmenter.format_paragraphs(diarized_segments)
            
            # Reconstruct clean structured full text
            content_text = "\n\n".join([f"[{p['speaker_label']}]: {p['text']}" for p in paragraphs])
            
            # Create Transcript record
            transcript_record = Transcript(
                media_id=media_item.id,
                full_text=content_text,
                language=transcript_result["language"],
                word_level_data=json.dumps(diarized_segments)
            )
            db.add(transcript_record)
            db.commit()

            # Save Speaker records
            registered_speakers = {}
            for para in paragraphs:
                spk = para["speaker_label"]
                if spk not in registered_speakers:
                    speaker_obj = db.query(Speaker).filter(Speaker.media_id == media_item.id, Speaker.label == spk).first()
                    if not speaker_obj:
                        speaker_obj = Speaker(
                            media_id=media_item.id,
                            label=spk,
                            display_name=spk
                        )
                        db.add(speaker_obj)
                        db.commit()
                    registered_speakers[spk] = speaker_obj

            # Segment transcript into sliding window semantic chunks
            chunks = TranscriptSegmenter.chunk_transcript(paragraphs)

        else:
            # For documents/text/images
            content_text = ingest_data["extracted_text"]
            
            # Chunk document by character sizes
            chunks = TranscriptSegmenter.chunk_document(content_text)
            
            # Set page numbers if parsing PDF pages
            segments = []
            if ingest_data.get("pages_data"):
                # We align chunks to pages if pages are available
                chunks = []
                chunk_index = 0
                for idx, page in enumerate(ingest_data["pages_data"]):
                    page_chunks = TranscriptSegmenter.chunk_document(page["text"])
                    for pc in page_chunks:
                        pc["page_number"] = page["page_number"]
                        pc["chunk_index"] = chunk_index
                        chunks.append(pc)
                        chunk_index += 1
                    
                    segments.append({
                        "id": idx,
                        "start": 0.0,
                        "end": 0.0,
                        "speaker_label": f"Page {page['page_number']}",
                        "text": page["text"]
                    })
            else:
                paragraphs = [p.strip() for p in content_text.split("\n\n") if p.strip()]
                if not paragraphs:
                    paragraphs = [content_text]
                for idx, para in enumerate(paragraphs):
                    segments.append({
                        "id": idx,
                        "start": 0.0,
                        "end": 0.0,
                        "speaker_label": "Content",
                        "text": para
                    })

            # Create Transcript record for non-audio/video text assets
            transcript_record = Transcript(
                media_id=media_item.id,
                full_text=content_text,
                language="en",
                word_level_data=json.dumps(segments)
            )
            db.add(transcript_record)
            db.commit()

        if not content_text.strip():
            raise ValueError("No text could be extracted or transcribed from this file.")

        # 4. Prompt Local LLM for summaries & entities
        logger.info("Extracting insights and entities via local LLM (Ollama)...")
        metadata = llm_service.generate_summary_and_metadata(content_text)
        
        # Save Chapter Topics
        for top in metadata.get("topics", []):
            topic_record = Topic(
                media_id=media_item.id,
                title=top.get("title", "Topic shift"),
                summary=top.get("summary", ""),
                start_time=top.get("approximate_start_time"),
                end_time=top.get("approximate_end_time")
            )
            db.add(topic_record)
        
        # Save Entities (Person, Organization, Tech, etc.)
        entity_id_map = {}
        for ent in metadata.get("entities", []):
            name = ent.get("name", "").strip()
            etype = ent.get("type", "Concept").strip()
            desc = ent.get("description", "").strip()
            if not name:
                continue
                
            entity_record = db.query(Entity).filter(Entity.name == name).first()
            if not entity_record:
                entity_record = Entity(
                    name=name,
                    entity_type=etype,
                    description=desc
                )
                db.add(entity_record)
                db.commit()
            entity_id_map[name] = entity_record.id

        db.commit()

        # Extract Relationships between Entities for Knowledge Graph
        relationships = llm_service.extract_relationships(metadata.get("entities", []), content_text)
        if isinstance(relationships, list):
            for rel in relationships:
                if not isinstance(rel, dict):
                    continue
                src = rel.get("source", "").strip()
                tgt = rel.get("target", "").strip()
                desc = rel.get("relationship", "associated_with").strip()
                
                if src in entity_id_map and tgt in entity_id_map:
                    rel_record = Relationship(
                        media_id=media_item.id,
                        source_id=entity_id_map[src],
                        target_id=entity_id_map[tgt],
                        relation_type=desc
                    )
                    db.add(rel_record)
        
        db.commit()

        # 5. Embed Chunks & Index in Vector DB
        logger.info(f"Generating embeddings for {len(chunks)} chunks...")
        vector_ids = []
        embeddings = []
        documents = []
        metadatas = []
        
        for idx, chunk in enumerate(chunks):
            v_id = f"media_{media_item.id}_chunk_{idx}"
            chunk_text = chunk["text"]
            
            # Save chunk metadata record to SQL
            chunk_record = Chunk(
                media_id=media_item.id,
                vector_id=v_id,
                text=chunk_text,
                start_time=chunk.get("start_time"),
                end_time=chunk.get("end_time"),
                page_number=chunk.get("page_number"),
                chunk_index=chunk["chunk_index"]
            )
            db.add(chunk_record)

            # Generate embedding
            emb = embedder.get_embedding(chunk_text)
            
            vector_ids.append(v_id)
            embeddings.append(emb)
            documents.append(chunk_text)
            
            # Metadata dictionary mapping inside vector DB
            metadatas.append({
                "media_id": media_item.id,
                "file_name": media_item.file_name,
                "file_path": media_item.file_path,
                "start_time": chunk.get("start_time") or 0.0,
                "end_time": chunk.get("end_time") or 0.0,
                "page_number": chunk.get("page_number") or 0
            })

        db.commit()

        # Add to Vector store
        logger.info("Indexing chunks in vector database...")
        vector_store.add_chunks(
            ids=vector_ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )

        # 6. Save summaries/highlights as text files in processed/ directory
        processed_path = settings.PROCESSED_DIR / f"{media_item.id}_insights.json"
        with open(processed_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)

        # Set status to completed
        media_item.status = "completed"
        db.commit()
        logger.info(f"Ingestion pipeline completed successfully for {file_path.name}!")

    except Exception as e:
        db.rollback()
        logger.error(f"Pipeline ingestion failed for {file_path.name}: {e}", exc_info=True)
        media_item.status = "failed"
        media_item.error_message = str(e)
        db.commit()
