from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.services.search.hybrid_search import HybridSearchService
from backend.app.services.llm.llm_service import LLMService

router = APIRouter()

class ChatRequest(BaseModel):
    query: str
    media_ids: Optional[List[int]] = None
    limit: Optional[int] = 5
    vector_weight: Optional[float] = 0.6

class CitationSource(BaseModel):
    chunk_id: str
    text: str
    media_id: int
    file_name: str
    file_path: str
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    page_number: Optional[int] = None

class ChatResponse(BaseModel):
    answer: str
    citations: List[CitationSource]
    fallback_used: bool

@router.post("", response_model=ChatResponse)
def ask_local_brain(
    request: ChatRequest, 
    db: Session = Depends(get_db)
):
    """
    RAG chat query endpoint.
    Retrieves relevant source document chunks and answers using local LLM synthesis.
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    try:
        # 1. Search matching context chunks
        searcher = HybridSearchService(db_session_factory=lambda: db)
        context_chunks = searcher.search(
            query=request.query,
            limit=request.limit,
            media_ids=request.media_ids,
            vector_weight=request.vector_weight
        )
        
        # 2. Call local LLM to synthesize answer
        llm = LLMService()
        result = llm.answer_query(request.query, context_chunks)
        
        # Format response citations list
        citations_list = []
        for idx, chunk in enumerate(context_chunks):
            citations_list.append(
                CitationSource(
                    chunk_id=chunk["chunk_id"],
                    text=chunk["text"],
                    media_id=chunk["media_id"],
                    file_name=chunk["file_name"],
                    file_path=chunk["file_path"],
                    start_time=chunk.get("start_time"),
                    end_time=chunk.get("end_time"),
                    page_number=chunk.get("page_number")
                )
            )

        return ChatResponse(
            answer=result["answer"],
            citations=citations_list,
            fallback_used=result["fallback_used"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
