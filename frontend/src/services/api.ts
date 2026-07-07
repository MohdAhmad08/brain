export const BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;

export interface MediaAsset {
  id: number;
  file_path: string;
  file_hash: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  duration: number | null;
  thumbnail_path: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Speaker {
  id: number;
  label: string;
  display_name: string;
}

export interface Topic {
  id: number;
  title: string;
  summary: string;
  start_time: number | null;
  end_time: number | null;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  probability: number;
}

export interface TranscriptSegment {
  id: number;
  text: string;
  start: number;
  end: number;
  speaker_label: string;
  display_name?: string;
  words?: WordTimestamp[];
}

export interface ChunkDetail {
  id: number;
  text: string;
  start_time: number | null;
  end_time: number | null;
  page_number: number | null;
  chunk_index: number;
}

export interface MediaDetail extends MediaAsset {
  transcript: {
    id: number;
    full_text: string;
    language: string;
    segments: TranscriptSegment[];
  } | null;
  topics: Topic[];
  speakers: Speaker[];
  chunks?: ChunkDetail[];
  insights?: {
    summary: string;
    key_takeaways?: string[];
    action_items?: string[];
    highlights?: string[];
    suggested_questions?: string[];
  } | null;
}

export interface CitationSource {
  chunk_id: string;
  text: string;
  media_id: number;
  file_name: string;
  file_path: string;
  start_time: number | null;
  end_time: number | null;
  page_number: number | null;
}

export interface ChatResponse {
  answer: string;
  citations: CitationSource[];
  fallback_used: boolean;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  media_id: number | null;
  file_name: string | null;
  timestamp: number | null;
  created_at: string;
  updated_at: string;
}

export interface GraphNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; type: string; description: string };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  animated: boolean;
  style?: Record<string, string>;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface TimelineEvent {
  topic_id: number;
  media_id: number;
  file_name: string;
  mime_type: string;
  title: string;
  summary: string;
  start_time: number | null;
  end_time: number | null;
  file_created_at: string;
}

export const api = {
  // Media APIs
  listMedia: async (status?: string): Promise<MediaAsset[]> => {
    const url = status ? `${API_BASE_URL}/media?status=${status}` : `${API_BASE_URL}/media`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load media list");
    return res.json();
  },

  getMediaDetail: async (id: number): Promise<MediaDetail> => {
    const res = await fetch(`${API_BASE_URL}/media/${id}`);
    if (!res.ok) throw new Error(`Failed to load media details for ID: ${id}`);
    return res.json();
  },

  uploadFile: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE_URL}/media/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("File upload failed");
    return res.json();
  },

  syncFolders: async (paths: string[]): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/media/sync-folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paths),
    });
    if (!res.ok) throw new Error("Folder sync failed");
    return res.json();
  },

  renameSpeaker: async (speakerId: number, name: string): Promise<any> => {
    const formData = new FormData();
    formData.append("display_name", name);
    const res = await fetch(`${API_BASE_URL}/media/speakers/${speakerId}`, {
      method: "PUT",
      body: formData,
    });
    if (!res.ok) throw new Error("Rename speaker failed");
    return res.json();
  },

  deleteMedia: async (id: number): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/media/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete media resource");
    return res.json();
  },

  // Chat/RAG API
  askQuestion: async (
    query: string,
    mediaIds?: number[],
    limit: number = 5,
    vectorWeight: number = 0.6
  ): Promise<ChatResponse> => {
    const res = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        media_ids: mediaIds && mediaIds.length > 0 ? mediaIds : null,
        limit,
        vector_weight: vectorWeight,
      }),
    });
    if (!res.ok) throw new Error("Brain chat lookup query failed");
    return res.json();
  },

  // Notes APIs
  listNotes: async (mediaId?: number): Promise<Note[]> => {
    const url = mediaId ? `${API_BASE_URL}/notes?media_id=${mediaId}` : `${API_BASE_URL}/notes`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load notes");
    return res.json();
  },

  getNote: async (id: number): Promise<Note> => {
    const res = await fetch(`${API_BASE_URL}/notes/${id}`);
    if (!res.ok) throw new Error(`Failed to load note ID: ${id}`);
    return res.json();
  },

  createNote: async (note: Omit<Note, "id" | "created_at" | "updated_at" | "file_name">): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note),
    });
    if (!res.ok) throw new Error("Create note failed");
    return res.json();
  },

  updateNote: async (id: number, note: Omit<Note, "id" | "created_at" | "updated_at" | "file_name">): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note),
    });
    if (!res.ok) throw new Error("Update note failed");
    return res.json();
  },

  deleteNote: async (id: number): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/notes/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Delete note failed");
    return res.json();
  },

  getNoteExportUrl: (id: number, format: "pdf" | "docx" | "html" | "md" | "json"): string => {
    return `${API_BASE_URL}/notes/${id}/export?format=${format}`;
  },

  // Knowledge Graph API
  getKnowledgeGraph: async (mediaId?: number): Promise<KnowledgeGraphData> => {
    const url = mediaId ? `${API_BASE_URL}/graph?media_id=${mediaId}` : `${API_BASE_URL}/graph`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load graph nodes and relationships");
    return res.json();
  },

  // Project Timeline API
  getTimeline: async (mediaId?: number): Promise<TimelineEvent[]> => {
    const url = mediaId ? `${API_BASE_URL}/timeline?media_id=${mediaId}` : `${API_BASE_URL}/timeline`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load timeline chapters");
    return res.json();
  },
};
