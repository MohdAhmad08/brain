import os
import json
import logging
from typing import List, Dict, Any, Tuple
import numpy as np

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# Try to import chromadb, fallback if unavailable
HAS_CHROMADB = False
try:
    import chromadb
    HAS_CHROMADB = True
except ImportError:
    logger.warning("chromadb package not found. Using SQLite-backed local vector index fallback.")

class VectorStore:
    _shared_client = None
    _shared_collection = None

    def __init__(self):
        self.client = None
        self.collection = None
        self._init_store()

    def _init_store(self):
        """Initialize ChromaDB or prepare fallback structures."""
        if settings.FORCE_FALLBACK_VECTOR_DB or not HAS_CHROMADB:
            logger.info("ChromaDB disabled or not available. Using local SQLite vector index.")
            return

        if VectorStore._shared_client is not None:
            self.client = VectorStore._shared_client
            self.collection = VectorStore._shared_collection
            return

        try:
            db_dir = settings.STORAGE_DIR / "chromadb"
            db_dir.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"Initializing ChromaDB PersistentClient at {db_dir}...")
            VectorStore._shared_client = chromadb.PersistentClient(path=str(db_dir))
            
            # Get or create collection
            VectorStore._shared_collection = VectorStore._shared_client.get_or_create_collection(
                name="media_chunks",
                metadata={"hnsw:space": "cosine"} # Use cosine similarity
            )
            self.client = VectorStore._shared_client
            self.collection = VectorStore._shared_collection
            logger.info("ChromaDB initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB: {e}. Switching to SQLite fallback.")
            self.client = None
            self.collection = None

    def add_chunks(self, ids: List[str], embeddings: List[List[float]], documents: List[str], metadatas: List[Dict[str, Any]]):
        """Add text chunks and their embeddings to the vector database."""
        if not ids:
            return

        # 1. Use ChromaDB if active
        if self.collection is not None:
            try:
                # ChromaDB add
                self.collection.add(
                    ids=ids,
                    embeddings=embeddings,
                    documents=documents,
                    metadatas=metadatas
                )
                return
            except Exception as e:
                logger.error(f"ChromaDB add error: {e}. Falling back to SQLite storage.")

        # 2. SQLite vector fallback store
        self._sqlite_add(ids, embeddings, documents, metadatas)

    def delete_by_media_id(self, media_id: int):
        """Remove all chunks associated with a media ID."""
        if self.collection is not None:
            try:
                # ChromaDB delete using metadatas filters
                self.collection.delete(
                    where={"media_id": media_id}
                )
                return
            except Exception as e:
                logger.error(f"ChromaDB delete error: {e}.")

        # Fallback delete
        self._sqlite_delete_by_media(media_id)

    def search(self, query_embedding: List[float], limit: int = 5, media_ids: List[int] = None) -> List[Dict[str, Any]]:
        """Search vector store for matches."""
        # 1. Use ChromaDB if active
        if self.collection is not None:
            try:
                where_clause = None
                if media_ids:
                    if len(media_ids) == 1:
                        where_clause = {"media_id": media_ids[0]}
                    else:
                        where_clause = {"media_id": {"$in": media_ids}}
                        
                results = self.collection.query(
                    query_embeddings=[query_embedding],
                    n_results=limit,
                    where=where_clause
                )
                
                # Format ChromaDB output
                hits = []
                if results and results["ids"] and results["ids"][0]:
                    for idx in range(len(results["ids"][0])):
                        hits.append({
                            "id": results["ids"][0][idx],
                            "document": results["documents"][0][idx],
                            "metadata": results["metadatas"][0][idx],
                            "distance": results["distances"][0][idx] if results["distances"] else 1.0,
                            # Cosine distance to similarity: similarity = 1 - distance
                            "score": 1.0 - (results["distances"][0][idx] if results["distances"] else 0.5)
                        })
                return hits
            except Exception as e:
                logger.error(f"ChromaDB search error: {e}. Falling back to SQLite search.")

        # 2. SQLite vector fallback store search
        return self._sqlite_search(query_embedding, limit, media_ids)

    # --- SQLite Fallback Implementation ---
    # We open a direct connection to the SQLite database to store vectors 
    # as JSON strings in a separate table.
    
    def _get_sqlite_conn(self):
        import sqlite3
        conn = sqlite3.connect(str(settings.DATABASE_PATH))
        conn.row_factory = sqlite3.Row
        # Create vector fallback tables if they don't exist
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sqlite_vector_store (
                id TEXT PRIMARY KEY,
                media_id INTEGER,
                document TEXT,
                metadata TEXT,
                embedding TEXT
            )
        """)
        conn.commit()
        return conn

    def _sqlite_add(self, ids: List[str], embeddings: List[List[float]], documents: List[str], metadatas: List[Dict[str, Any]]):
        conn = self._get_sqlite_conn()
        try:
            cursor = conn.cursor()
            for idx in range(len(ids)):
                cursor.execute(
                    "INSERT OR REPLACE INTO sqlite_vector_store (id, media_id, document, metadata, embedding) VALUES (?, ?, ?, ?, ?)",
                    (
                        ids[idx],
                        metadatas[idx].get("media_id"),
                        documents[idx],
                        json.dumps(metadatas[idx]),
                        json.dumps(embeddings[idx])
                    )
                )
            conn.commit()
        finally:
            conn.close()

    def _sqlite_delete_by_media(self, media_id: int):
        conn = self._get_sqlite_conn()
        try:
            conn.execute("DELETE FROM sqlite_vector_store WHERE media_id = ?", (media_id,))
            conn.commit()
        finally:
            conn.close()

    def _sqlite_search(self, query_embedding: List[float], limit: int = 5, media_ids: List[int] = None) -> List[Dict[str, Any]]:
        conn = self._get_sqlite_conn()
        try:
            cursor = conn.cursor()
            if media_ids:
                placeholders = ",".join("?" for _ in media_ids)
                cursor.execute(f"SELECT * FROM sqlite_vector_store WHERE media_id IN ({placeholders})", tuple(media_ids))
            else:
                cursor.execute("SELECT * FROM sqlite_vector_store")
                
            rows = cursor.fetchall()
            if not rows:
                return []

            query_vec = np.array(query_embedding)
            query_norm = np.linalg.norm(query_vec)
            
            hits = []
            for row in rows:
                emb = json.loads(row["embedding"])
                row_vec = np.array(emb)
                
                # Compute Cosine Similarity
                row_norm = np.linalg.norm(row_vec)
                if query_norm > 0 and row_norm > 0:
                    similarity = np.dot(query_vec, row_vec) / (query_norm * row_norm)
                else:
                    similarity = 0.0
                    
                hits.append({
                    "id": row["id"],
                    "document": row["document"],
                    "metadata": json.loads(row["metadata"]),
                    "score": float(similarity)
                })
                
            # Sort by similarity score descending
            hits.sort(key=lambda x: x["score"], reverse=True)
            return hits[:limit]
        finally:
            conn.close()
