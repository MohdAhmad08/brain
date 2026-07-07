"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  FileText, 
  Video as VideoIcon, 
  Music, 
  Trash2, 
  RefreshCw, 
  ExternalLink,
  Loader2,
  FolderOpen
} from "lucide-react";
import { api, MediaAsset, BACKEND_URL } from "@/services/api";

export default function MediaLibrary() {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "video" | "audio" | "pdf" | "docx">("all");

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      const data = await api.listMedia();
      setMedia(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this media asset and all associated transcript indices?")) return;
    
    try {
      await api.deleteMedia(id);
      setMedia(media.filter(m => m.id !== id));
    } catch (e) {
      alert("Failed to delete media asset.");
    }
  };

  // Filters items based on selection
  const filteredMedia = media.filter(m => {
    if (filter === "all") return true;
    if (filter === "video") return ["video", "mp4", "mkv", "avi", "mov"].includes(m.mime_type.toLowerCase());
    if (filter === "audio") return ["audio", "mp3", "wav", "m4a", "flac"].includes(m.mime_type.toLowerCase());
    if (filter === "pdf") return m.mime_type.toLowerCase() === "pdf";
    if (filter === "docx") return ["docx", "doc", "pptx", "ppt", "txt", "md"].includes(m.mime_type.toLowerCase());
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-glass-border pb-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">Local Library</h2>
          <p className="text-zinc-400 mt-1.5 font-medium">Browse, review, and manage your offline local knowledge assets.</p>
        </div>

        {/* Filter categories tabs */}
        <div className="flex bg-zinc-900/60 p-1.5 rounded-xl border border-glass-border">
          {["all", "video", "audio", "pdf", "docx"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab as any)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg capitalize transition ${
                filter === tab 
                  ? "bg-primary text-white shadow-md shadow-primary/10" 
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab === "docx" ? "Text Docs" : tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-zinc-400 font-semibold">Loading media library...</p>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl text-center space-y-4 max-w-xl mx-auto">
          <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mx-auto border border-glass-border">
            <FolderOpen className="w-8 h-8 text-zinc-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-200">No matching assets found</h3>
            <p className="text-sm text-zinc-500 mt-1.5">
              Sync folders in the Dashboard or manually upload files to register local content.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMedia.map((m) => {
            const sizeMB = (m.file_size / (1024 * 1024)).toFixed(1);
            
            // Icon selection
            let Icon = FileText;
            let themeColor = "text-blue-400 border-blue-500/20 bg-blue-500/10";
            if (["video", "mp4", "mkv", "avi", "mov"].includes(m.mime_type.toLowerCase())) {
              Icon = VideoIcon;
              themeColor = "text-purple-400 border-purple-500/20 bg-purple-500/10";
            } else if (["audio", "mp3", "wav", "m4a", "flac"].includes(m.mime_type.toLowerCase())) {
              Icon = Music;
              themeColor = "text-emerald-400 border-emerald-500/20 bg-emerald-500/10";
            } else if (m.mime_type.toLowerCase() === "pdf") {
              themeColor = "text-red-400 border-red-500/20 bg-red-500/10";
            }

            return (
              <div 
                key={m.id}
                className="glass-panel rounded-2xl overflow-hidden flex flex-col justify-between group"
              >
                {/* Thumbnail placeholder or raw image */}
                <div className="h-40 bg-zinc-950/60 relative border-b border-glass-border flex items-center justify-center overflow-hidden">
                  {m.thumbnail_path ? (
                    <img 
                      src={`${BACKEND_URL}/api/v1/media/thumbnail/${m.id}`} 
                      alt={m.file_name} 
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-all duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className={`p-5 rounded-2xl border ${themeColor}`}>
                      <Icon className="w-8 h-8" />
                    </div>
                  )}

                  {/* Badges overlay */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                      m.status === "completed" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/20" :
                      m.status === "failed" ? "bg-red-500/20 text-red-400 border-red-500/20" :
                      "bg-purple-500/20 text-purple-400 border-purple-500/20"
                    }`}>
                      {m.status}
                    </span>
                    <span className="bg-zinc-950/70 border border-glass-border backdrop-blur px-2 py-0.5 rounded text-[10px] font-semibold text-zinc-300">
                      {sizeMB} MB
                    </span>
                  </div>
                </div>

                {/* Body details */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-zinc-200 group-hover:text-primary transition line-clamp-1">
                      {m.file_name}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-2 font-medium break-all line-clamp-2">
                      {m.file_path}
                    </p>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-between border-t border-glass-border pt-4 mt-5">
                    {/* Action buttons based on status */}
                    {m.status === "completed" ? (
                      <Link 
                        href={`/player/${m.id}`}
                        className="text-xs font-bold text-primary hover:text-white flex items-center gap-1.5 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Document</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-zinc-500 font-semibold italic flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Processing pipeline...</span>
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDelete(m.id, e)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl transition"
                        title="Delete asset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
