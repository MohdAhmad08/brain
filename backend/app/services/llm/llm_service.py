import json
import logging
import requests
from typing import List, Dict, Any, Tuple

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        self.url = settings.OLLAMA_URL
        self.model = settings.OLLAMA_MODEL

    def _call_ollama(self, prompt: str, system_prompt: str = None, json_mode: bool = False) -> str:
        """Helper to invoke the local Ollama API."""
        try:
            endpoint = f"{self.url}/api/generate"
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False
            }
            if system_prompt:
                payload["system"] = system_prompt
            if json_mode:
                payload["format"] = "json"
                
            response = requests.post(endpoint, json=payload, timeout=90.0)
            if response.status_code == 200:
                return response.json().get("response", "").strip()
            else:
                logger.error(f"Ollama API returned code {response.status_code}: {response.text}")
                raise RuntimeError(f"Ollama error: {response.text}")
        except Exception as e:
            logger.error(f"Could not connect to local Ollama at {self.url}: {e}")
            raise ConnectionError(f"Ollama connection failed: Ensure Ollama is running at {self.url}.")

    def generate_summary_and_metadata(self, content_text: str) -> Dict[str, Any]:
        """Summarizes transcripts or documents, extracting topics, entities, highlights, and Q&A."""
        # Truncate content to fit local LLM context limits (e.g. max ~8000 words)
        words = content_text.split()
        if len(words) > 6000:
            truncated_text = " ".join(words[:6000]) + "\n...[Content truncated due to context limits]..."
        else:
            truncated_text = content_text

        system_prompt = (
            "You are an expert AI assistant designed to extract structure from meeting transcripts and text documents. "
            "You must return your output ONLY as a valid JSON object matching the requested schema. Do not write any markdown outside the JSON."
        )

        prompt = f"""
Analyze the following text document/transcript:
---
{truncated_text}
---

Generate metadata from the content above. Your output must be a single JSON object with the following fields:
1. "summary": A concise 2-3 paragraph overview of the content.
2. "key_takeaways": A list of 4-6 bullet points summarizing core themes.
3. "action_items": A list of actionable tasks, mentioning the owner if known (e.g. "[John] Implement the database schema").
4. "topics": A list of objects representing chapters or topic shifts. Each object must have:
   - "title": Title of the topic.
   - "summary": 1-2 sentence description of what was discussed.
   - "approximate_start_time": (For transcripts) Estimations of start time in seconds if timestamps or dialog turns are present, otherwise null.
   - "approximate_end_time": End time in seconds if applicable, otherwise null.
5. "entities": A list of objects representing key nouns/subjects. Each object must have:
   - "name": Exact name (e.g., "ChromaDB", "John", "Qwen3").
   - "type": Classify as "Person", "Company", "Organization", "Technology", "Project", or "Concept".
   - "description": Brief 1-sentence explanation of their context.
6. "highlights": A list of 3-5 key quotes or direct statements from the text.
7. "suggested_questions": A list of 3-5 questions that can be answered by this document.

JSON Output Schema:
{{
  "summary": "...",
  "key_takeaways": ["...", "..."],
  "action_items": ["...", "..."],
  "topics": [
     {{"title": "...", "summary": "...", "approximate_start_time": 0.0, "approximate_end_time": 60.0}}
  ],
  "entities": [
     {{"name": "...", "type": "...", "description": "..."}}
  ],
  "highlights": ["...", "..."],
  "suggested_questions": ["...", "..."]
}}
"""

        try:
            response_text = self._call_ollama(prompt, system_prompt=system_prompt, json_mode=True)
            return json.loads(response_text)
        except Exception as e:
            logger.warning(f"LLM metadata generation failed ({e}). Running rule-based parser fallback.")
            return self._run_metadata_fallback(content_text)

    def answer_query(self, query: str, context_chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Answers queries using context chunks, providing source citations."""
        
        # Compile context string
        context_str = ""
        citation_sources = {} # Index -> Chunk metadata
        
        for idx, chunk in enumerate(context_chunks):
            citation_num = idx + 1
            file_info = chunk["file_name"]
            
            if chunk.get("start_time") is not None:
                offset_info = f"at {chunk['start_time']}s"
            elif chunk.get("page_number") is not None:
                offset_info = f"on page {chunk['page_number']}"
            else:
                offset_info = ""
                
            context_str += f"Source [{citation_num}] ({file_info} {offset_info}):\n{chunk['text']}\n\n"
            citation_sources[str(citation_num)] = chunk

        system_prompt = (
            "You are a local knowledge assistant. Answer the user's question relying ONLY on the provided sources. "
            "For every assertion, cite the source by adding brackets containing the index (e.g. [1], [2]). "
            "Interpret shorthand references to filenames in the query (like 'my_cv') as referring to the corresponding source documents (like 'my_cv.pdf'). "
            "If the query is a short keyword phrase, interpret it as a request to locate and summarize that information from the files. "
            "If the source context does not contain enough information to answer the question, state that you cannot answer it based on the local files."
        )

        prompt = f"""
Answer the user's question using the sources below. Cite sources using bracket numbers (e.g. [1], [2]).
Question: {query}

Sources:
{context_str}
"""

        try:
            answer_text = self._call_ollama(prompt, system_prompt=system_prompt)
            return {
                "answer": answer_text,
                "citations": citation_sources,
                "fallback_used": False
            }
        except Exception as e:
            logger.error(f"Ollama RAG failed: {e}. Running rule-based fallback QA.")
            return self._run_qa_fallback(query, context_chunks)

    def extract_relationships(self, entities: List[Dict[str, Any]], content_text: str) -> List[Dict[str, Any]]:
        """Finds relationships between entities in the document to construct the knowledge graph."""
        if len(entities) < 2:
            return []

        entity_list_str = ", ".join([ent["name"] for ent in entities])
        
        system_prompt = (
            "You are an AI designed to map entity relationships. "
            "You must return your output ONLY as a JSON array of objects. Do not write markdown annotations."
        )

        prompt = f"""
Based on the text:
---
{content_text[:3000]}
---

Find links or relationships between these entities: [{entity_list_str}].
Return a JSON array of objects, where each object has:
1. "source": Name of the source entity.
2. "target": Name of the target entity.
3. "relationship": A short verb/phrase describing the link (e.g., "uses", "works_at", "colleague_of", "created").

JSON Output Schema:
[
  {{"source": "Entity A", "target": "Entity B", "relationship": "works_at"}}
]
"""

        try:
            response_text = self._call_ollama(prompt, system_prompt=system_prompt, json_mode=True)
            data = json.loads(response_text)
            if isinstance(data, list):
                valid_rels = []
                for item in data:
                    if isinstance(item, dict) and "source" in item and "target" in item:
                        valid_rels.append(item)
                return valid_rels
            raise ValueError("Invalid JSON schema for relationships")
        except Exception:
            # Fallback heuristic: create a link between successive entities in the text
            relationships = []
            for idx in range(len(entities) - 1):
                relationships.append({
                    "source": entities[idx]["name"],
                    "target": entities[idx + 1]["name"],
                    "relationship": "mentioned_with"
                })
            return relationships

    # --- Rule-Based Pipeline Fallbacks ---
    
    def _run_metadata_fallback(self, content_text: str) -> Dict[str, Any]:
        """Simple rule-based metadata extractor for development when Ollama is unavailable."""
        sentences = [s.strip() for s in content_text.split('.') if s.strip()]
        
        summary = "This is a rule-based fallback summary. "
        if len(sentences) >= 3:
            summary += " ".join(sentences[:3]) + "."
        else:
            summary += content_text[:300] + "..."

        # Heuristic entity extraction: capital words
        words = content_text.split()
        capitalized = set()
        for w in words:
            clean = "".join(c for c in w if c.isalnum())
            if clean and clean[0].isupper() and len(clean) > 3 and clean.lower() not in {"this", "that", "there", "their", "they", "what", "when", "with"}:
                capitalized.add(clean)
                
        entities = []
        for name in list(capitalized)[:5]:
            entities.append({
                "name": name,
                "type": "Concept",
                "description": "Extracted concept from document text."
            })

        return {
            "summary": summary,
            "key_takeaways": ["Core point 1: " + (sentences[0] if sentences else "Document ingested"), "Core point 2: Extracted keywords: " + ", ".join(list(capitalized)[:5])],
            "action_items": ["Review document contents", "Configure local Ollama instance for full AI summarization"],
            "topics": [
                {"title": "Overview", "summary": "Initial sections of the ingested document.", "approximate_start_time": 0.0, "approximate_end_time": None}
            ],
            "entities": entities,
            "highlights": [sentences[0] if sentences else "First statement of the text."],
            "suggested_questions": ["What is the primary topic of this document?", "Who are the mentioned entities?"]
        }

    def _run_qa_fallback(self, query: str, context_chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Simple heuristic search fallback RAG search."""
        # Find which chunk has the most overlap with query keywords
        query_words = set(query.lower().split())
        best_chunk = None
        best_score = -1
        best_idx = 0
        
        for idx, chunk in enumerate(context_chunks):
            chunk_words = set(chunk["text"].lower().split())
            overlap = len(query_words.intersection(chunk_words))
            if overlap > best_score:
                best_score = overlap
                best_chunk = chunk
                best_idx = idx + 1

        citation_sources = {str(i+1): chunk for i, chunk in enumerate(context_chunks)}
        
        if best_chunk:
            answer = (
                f"**[Local Offline Fallback Answer]**\n\n"
                f"Based on the local files, here is the most relevant snippet matching your question:\n"
                f"\"{best_chunk['text']}\" [{best_idx}].\n\n"
                f"*Note: Please connect local Ollama models (e.g. Qwen) to generate natural synthesis response.*"
            )
        else:
            answer = "No relevant chunks could be matched to answer the question."

        return {
            "answer": answer,
            "citations": citation_sources,
            "fallback_used": True
        }
