import logging
from typing import List, Dict, Any, Optional
from rank_bm25 import BM25Okapi
import numpy as np

from backend.app.services.embedding.embedder import EmbeddingService
from backend.app.services.indexing.vector_store import VectorStore

logger = logging.getLogger(__name__)

class HybridSearchService:
    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory
        self.embedder = EmbeddingService()
        self.vector_store = VectorStore()

    def search(self, query: str, limit: int = 5, media_ids: Optional[List[int]] = None, vector_weight: float = 0.6) -> List[Dict[str, Any]]:
        """
        Executes a hybrid search: Vector Similarity (Semantic) + BM25 Okapi (Keyword).
        Combines ranks using Reciprocal Rank Fusion (RRF).
        """
        if not query.strip():
            return []

        # 1. Fetch search vector and perform Vector Search
        logger.info(f"Vector search running for query: '{query}'")
        query_embedding = self.embedder.get_embedding(query)
        vector_results = self.vector_store.search(query_embedding, limit=limit * 3, media_ids=media_ids)

        # 2. Perform BM25 Keyword Search
        bm25_results = self._run_bm25_search(query, limit=limit * 3, media_ids=media_ids)

        # 3. Reciprocal Rank Fusion (RRF) to merge and re-rank results
        # Formula: RRF_Score = Sum_m( 1 / (k + rank_m) ) where k = 60
        k = 60
        rrf_scores = {}
        chunk_details = {} # id -> metadata & doc

        # Process Vector search ranks
        for rank, hit in enumerate(vector_results):
            chunk_id = hit["id"]
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + vector_weight * (1.0 / (k + rank + 1))
            chunk_details[chunk_id] = {
                "id": chunk_id,
                "text": hit["document"],
                "metadata": hit["metadata"],
                "vector_score": hit["score"]
            }

        # Process BM25 search ranks
        bm25_weight = 1.0 - vector_weight
        for rank, hit in enumerate(bm25_results):
            chunk_id = hit["id"]
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + bm25_weight * (1.0 / (k + rank + 1))
            
            # If not already present from vector search, populate details
            if chunk_id not in chunk_details:
                chunk_details[chunk_id] = {
                    "id": chunk_id,
                    "text": hit["document"],
                    "metadata": hit["metadata"],
                    "vector_score": 0.0
                }
            chunk_details[chunk_id]["bm25_score"] = hit["score"]

        # Sort and package top hits
        sorted_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)
        
        final_results = []
        for cid in sorted_ids[:limit]:
            details = chunk_details[cid]
            final_results.append({
                "chunk_id": details["id"],
                "text": details["text"],
                "media_id": details["metadata"].get("media_id"),
                "file_name": details["metadata"].get("file_name", "Unknown File"),
                "file_path": details["metadata"].get("file_path", ""),
                "start_time": details["metadata"].get("start_time"),
                "end_time": details["metadata"].get("end_time"),
                "page_number": details["metadata"].get("page_number"),
                "rrf_score": float(rrf_scores[cid]),
                "vector_score": float(details.get("vector_score", 0.0)),
                "bm25_score": float(details.get("bm25_score", 0.0))
            })

        return final_results

    def _run_bm25_search(self, query: str, limit: int, media_ids: Optional[List[int]]) -> List[Dict[str, Any]]:
        """Loads chunks from SQLite DB, fits a BM25 model, and returns matches."""
        db = self.db_session_factory()
        try:
            # We query the database's chunks table
            from backend.app.database.models import Chunk, Media
            query_builder = db.query(Chunk, Media.file_name, Media.file_path).join(Media, Chunk.media_id == Media.id)
            
            if media_ids:
                query_builder = query_builder.filter(Chunk.media_id.in_(media_ids))
                
            chunks_data = query_builder.all()
            if not chunks_data:
                return []

            # Prepare corpus and tokenize (simple whitespace/lowercase tokenization)
            corpus = []
            chunk_map = []
            
            for chunk, file_name, file_path in chunks_data:
                text = chunk.text
                tokens = text.lower().split()
                corpus.append(tokens)
                chunk_map.append({
                    "id": chunk.vector_id,
                    "document": text,
                    "metadata": {
                        "media_id": chunk.media_id,
                        "file_name": file_name,
                        "file_path": file_path,
                        "start_time": chunk.start_time,
                        "end_time": chunk.end_time,
                        "page_number": chunk.page_number
                    }
                })

            # Fit BM25
            bm25 = BM25Okapi(corpus)
            
            # Query scores
            query_tokens = query.lower().split()
            doc_scores = bm25.get_scores(query_tokens)
            
            # Map back to models
            matches = []
            for idx, score in enumerate(doc_scores):
                if score > 0: # Only return matching hits
                    matches.append({
                        "id": chunk_map[idx]["id"],
                        "document": chunk_map[idx]["document"],
                        "metadata": chunk_map[idx]["metadata"],
                        "score": float(score)
                    })
                    
            # Sort matches by score descending
            matches.sort(key=lambda x: x["score"], reverse=True)
            return matches[:limit]
        except Exception as e:
            logger.error(f"Error fitting BM25 index: {e}")
            return []
        finally:
            db.close()
