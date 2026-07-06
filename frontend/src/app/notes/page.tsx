"use client";

import { useEffect, useState } from "react";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  Download, 
  Layers,
  FileDown,
  Loader2,
  Check,
  ChevronDown
} from "lucide-react";
import { api, Note, MediaAsset } from "@/services/api";

export default function NotesView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaId, setMediaId] = useState<number | "">("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  useEffect(() => {
    loadNotesAndMedia();
  }, []);

  const loadNotesAndMedia = async () => {
    try {
      const notesData = await api.listNotes();
      const mediaData = await api.listMedia();
      setNotes(notesData);
      setMedia(mediaData);
      
      if (notesData.length > 0) {
        selectNote(notesData[0]);
      } else {
        handleLocalReset();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectNote = (note: Note) => {
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    setMediaId(note.media_id || "");
  };

  const handleLocalReset = () => {
    setSelectedNote(null);
    setTitle("New Note");
    setContent("");
    setMediaId("");
  };

  const handleNewNote = async () => {
    try {
      setSaving(true);
      const payload = {
        title: "New Note",
        content: "",
        media_id: null,
        timestamp: null
      };
      const response = await api.createNote(payload);
      
      // Reload lists
      const notesData = await api.listNotes();
      setNotes(notesData);
      
      // Find the newly created note and select it
      const newNote = notesData.find(n => n.id === response.id);
      if (newNote) {
        selectNote(newNote);
      } else {
        handleLocalReset();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to create a new note.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Note title cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title,
        content,
        media_id: mediaId === "" ? null : Number(mediaId),
        timestamp: null
      };

      if (selectedNote) {
        await api.updateNote(selectedNote.id, payload);
      } else {
        const response = await api.createNote(payload);
        // Map created note id
        const newNoteObj: Note = {
          id: response.id,
          ...payload,
          file_name: media.find(m => m.id === payload.media_id)?.file_name || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setSelectedNote(newNoteObj);
      }
      
      // Reload lists
      const notesData = await api.listNotes();
      setNotes(notesData);
      
      // Update selected reference
      if (selectedNote) {
        const updated = notesData.find(n => n.id === selectedNote.id);
        if (updated) setSelectedNote(updated);
      }
      
      setExportStatus("Saved successfully!");
      setTimeout(() => setExportStatus(null), 3000);
    } catch (e) {
      alert("Failed to save note.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      await api.deleteNote(selectedNote.id);
      const notesData = await api.listNotes();
      setNotes(notesData);
      
      if (notesData.length > 0) {
        selectNote(notesData[0]);
      } else {
        handleNewNote();
      }
    } catch (e) {
      alert("Failed to delete note.");
    }
  };

  const handleExport = (format: "pdf" | "docx" | "html" | "md" | "json") => {
    if (!selectedNote) return;
    const url = api.getNoteExportUrl(selectedNote.id, format);
    
    // Trigger direct browser download
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/\s+/g, "_")}.${format === "markdown" ? "md" : format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setExportOpen(false);
    setExportStatus(`Exporting as ${format.toUpperCase()}...`);
    setTimeout(() => setExportStatus(null), 3000);
  };

  // Simple client-side Markdown preview renderer (supports header, bold, code, bullets)
  const renderMarkdownPreview = (text: string) => {
    if (!text.trim()) return <p className="text-zinc-600 italic text-xs">Write markdown content to see live previews.</p>;
    
    return text.split("\n").map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("### ")) return <h4 key={idx} className="text-sm font-bold text-teal-400 mt-3 mb-1.5">{trimmed.substring(4)}</h4>;
      if (trimmed.startsWith("## ")) return <h3 key={idx} className="text-base font-bold text-blue-400 mt-4 mb-2">{trimmed.substring(3)}</h3>;
      if (trimmed.startsWith("# ")) return <h2 key={idx} className="text-lg font-bold text-primary mt-5 mb-3 border-b border-glass-border pb-1">{trimmed.substring(2)}</h2>;
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) return <li key={idx} className="text-xs text-zinc-300 ml-4 mb-1 list-disc">{trimmed.substring(2)}</li>;
      if (trimmed === "") return <div key={idx} className="h-2" />;
      
      // Inline formatting replacements
      let formattedText = trimmed;
      // Bold **text** -> strong
      formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, "$1"); // for preview we just strip formatting or do basic wraps
      
      return <p key={idx} className="text-xs text-zinc-300 leading-normal mb-1.5">{formattedText}</p>;
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[80vh]">
      
      {/* Sidebar: Notes lists pane (3 cols) */}
      <div className="lg:col-span-3 glass-panel p-5 rounded-2xl flex flex-col h-full overflow-hidden">
        <button
          onClick={handleNewNote}
          className="glow-btn w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mb-4"
        >
          <Plus className="w-4 h-4" />
          <span>New Note</span>
        </button>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {notes.length === 0 ? (
            <p className="text-xs text-zinc-500 italic text-center py-10">No notes created yet. Click New Note to start.</p>
          ) : (
            notes.map((n) => {
              const isSelected = selectedNote?.id === n.id;
              const dateStr = new Date(n.updated_at).toLocaleDateString(undefined, {
                month: "short", day: "numeric"
              });
              
              return (
                <button
                  key={n.id}
                  onClick={() => selectNote(n)}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-2.5 transition ${
                    isSelected 
                      ? "bg-primary/10 border-primary/20 text-zinc-200" 
                      : "bg-zinc-950/20 border-glass-border text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <FileText className={`w-5 h-5 mt-0.5 ${isSelected ? "text-primary animate-pulse" : "text-zinc-500"}`} />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-bold truncate">{n.title}</p>
                    <span className="text-[10px] text-zinc-500 font-semibold">{dateStr}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Editor & Preview Pane (9 cols) */}
      <div className="lg:col-span-9 glass-panel rounded-2xl flex flex-col h-full overflow-hidden">
        
        {/* Editor Toolbar Header */}
        <div className="p-4 border-b border-glass-border bg-zinc-950/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Note Title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent border-0 font-bold text-lg text-white outline-none w-full focus:ring-0 placeholder:text-zinc-600"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Media Linking drop-down selector */}
            <div className="flex items-center gap-2 border border-glass-border rounded-xl px-3 py-2 bg-zinc-950/20 max-w-[200px]">
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              <select
                value={mediaId}
                onChange={(e) => setMediaId(e.target.value)}
                className="bg-transparent border-0 text-xs text-zinc-400 font-medium outline-none cursor-pointer w-full focus:ring-0"
              >
                <option value="" className="bg-zinc-900">Unlinked (General)</option>
                {media.map((m) => (
                  <option key={m.id} value={m.id} className="bg-zinc-900 truncate">
                    {m.file_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Save Note Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-2.5 rounded-xl border border-glass-border bg-zinc-900 hover:bg-zinc-800 transition text-zinc-300 font-bold text-xs flex items-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{saving ? "Saving..." : "Save"}</span>
            </button>

            {/* Export Dropdown Menu */}
            {selectedNote && (
              <div className="relative">
                <button
                  onClick={() => setExportOpen(!exportOpen)}
                  className="p-2.5 rounded-xl border border-glass-border bg-zinc-900 hover:bg-zinc-800 transition text-zinc-300 font-bold text-xs flex items-center gap-1.5"
                >
                  <FileDown className="w-3.5 h-3.5 text-primary" />
                  <span>Export</span>
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                </button>

                {exportOpen && (
                  <div className="absolute right-0 mt-2 w-40 rounded-xl bg-zinc-900 border border-glass-border shadow-2xl z-50 p-1">
                    {["md", "pdf", "docx", "html", "json"].map((format) => (
                      <button
                        key={format}
                        onClick={() => handleExport(format as any)}
                        className="w-full px-4 py-2.5 text-left text-xs font-semibold text-zinc-300 hover:bg-zinc-800 rounded-lg hover:text-white uppercase transition"
                      >
                        {format === "md" ? "Markdown (.md)" : format}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Delete button */}
            {selectedNote && (
              <button
                onClick={handleDelete}
                className="p-2.5 rounded-xl border border-red-500/10 hover:border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 transition"
                title="Delete note"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sync/Saved notice overlays */}
        {exportStatus && (
          <div className="bg-primary/20 text-primary border-b border-primary/20 px-6 py-2.5 text-xs font-bold text-center animate-fade-in flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            <span>{exportStatus}</span>
          </div>
        )}

        {/* Main Editing Split Area */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-glass-border overflow-hidden">
          
          {/* Markdown Text Area Editor */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write details in markdown formatting (# header, ## topic, - list, **bold**)..."
            className="w-full h-full p-6 bg-transparent border-0 outline-none resize-none text-zinc-300 text-xs leading-relaxed focus:ring-0 placeholder:text-zinc-600"
          />

          {/* Markdown Live Preview Area */}
          <div className="w-full h-full p-6 overflow-y-auto bg-zinc-950/10 space-y-2">
            <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold border-b border-glass-border pb-1.5 mb-4">
              Notes Live Preview
            </div>
            {renderMarkdownPreview(content)}
          </div>
        </div>
      </div>
    </div>
  );
}
