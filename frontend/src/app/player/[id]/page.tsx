"use client";

import { useEffect, useState, useRef, use } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Play, 
  Clock, 
  Volume2, 
  ArrowLeft,
  Loader2, 
  Edit2, 
  Check, 
  FileText,
  FileCheck,
  FolderOpen
} from "lucide-react";
import { api, MediaDetail, TranscriptSegment } from "@/services/api";

export default function MediaPlayer() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [editingSpeaker, setEditingSpeaker] = useState<number | null>(null);
  const [speakerNameInput, setSpeakerNameInput] = useState("");

  const mediaRef = useRef<HTMLMediaElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) loadMediaDetail();
  }, [id]);

  const loadMediaDetail = async () => {
    try {
      const data = await api.getMediaDetail(id);
      setDetail(data);
    } catch (e) {
      console.error(e);
      alert("Failed to load media details.");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime);
      
      // Auto scroll transcript to active segment
      if (detail?.transcript?.segments) {
        const activeSeg = detail.transcript.segments.find(
          seg => mediaRef.current!.currentTime >= seg.start && mediaRef.current!.currentTime <= seg.end
        );
        if (activeSeg) {
          const element = document.getElementById(`seg-${activeSeg.id}`);
          if (element && transcriptContainerRef.current) {
            // Smoothly center the active segment inside transcript scroll container
            element.scrollIntoView({
              behavior: "smooth",
              block: "nearest"
            });
          }
        }
      }
    }
  };

  const seekTo = (seconds: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = seconds;
      mediaRef.current.play().catch(() => {});
    }
  };

  const handleRenameSpeaker = async (speakerId: number, currentName: string) => {
    setEditingSpeaker(speakerId);
    setSpeakerNameInput(currentName);
  };

  const saveSpeakerName = async (speakerId: number) => {
    if (!speakerNameInput.trim()) return;
    try {
      await api.renameSpeaker(speakerId, speakerNameInput);
      setEditingSpeaker(null);
      loadMediaDetail(); // Reload detail to propagate changes
    } catch (e) {
      alert("Failed to rename speaker.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-zinc-400 font-semibold">Loading media player and transcript...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-20 text-zinc-400">
        <FolderOpen className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
        <h3 className="text-lg font-bold">Media file not found</h3>
        <button onClick={() => router.push("/library")} className="text-primary mt-2">Back to Library</button>
      </div>
    );
  }

  // Determine media player types (video or audio)
  const isVideo = ["video", "mp4", "mkv", "avi", "mov"].includes(detail.mime_type.toLowerCase());
  const isAudio = ["audio", "mp3", "wav", "m4a", "flac"].includes(detail.mime_type.toLowerCase());

  return (
    <div className="space-y-6">
      {/* Header back button */}
      <div className="flex items-center justify-between border-b border-glass-border pb-4">
        <button 
          onClick={() => router.push("/library")}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition font-medium text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Library</span>
        </button>
        <h2 className="text-xl font-bold text-white max-w-md truncate">{detail.file_name}</h2>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Player / Document Reader (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-2xl overflow-hidden bg-zinc-950/60 p-4 border border-glass-border">
            {isVideo && (
              <video
                ref={mediaRef as any}
                src={`http://localhost:8000/api/v1/media/thumbnail/${detail.id}`} // Video endpoint maps raw stream
                controls
                onTimeUpdate={handleTimeUpdate}
                className="w-full aspect-video rounded-xl bg-black"
              />
            )}
            
            {isAudio && (
              <div className="py-8 px-4 text-center space-y-6">
                <div className="w-24 h-24 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <Volume2 className="w-10 h-10 text-primary animate-bounce" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-200">{detail.file_name}</h3>
                  <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Audio playback</span>
                </div>
                <audio
                  ref={mediaRef as any}
                  src={`http://localhost:8000/api/v1/media/thumbnail/${detail.id}`}
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full"
                />
              </div>
            )}

            {!isVideo && !isAudio && (
              <div className="p-6 space-y-5">
                <div>
                  <h3 className="font-extrabold text-white text-sm flex items-center gap-2 border-b border-glass-border pb-2.5">
                    <FileText className="w-4 h-4 text-primary" />
                    <span>Document Summary Overview</span>
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans mt-3.5 italic bg-zinc-950/20 p-3.5 border border-glass-border rounded-xl max-h-48 overflow-y-auto">
                    "{detail.insights?.summary || "No summary available for this document."}"
                  </p>
                </div>

                {detail.insights?.key_takeaways && detail.insights.key_takeaways.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-zinc-300 text-[10px] uppercase tracking-wider">Key Takeaways:</h4>
                    <ul className="space-y-1.5 text-[11px] text-zinc-400 font-sans list-disc list-inside pl-1 max-h-36 overflow-y-auto">
                      {detail.insights.key_takeaways.map((takeaway: string, index: number) => (
                        <li key={index} className="leading-relaxed">{takeaway}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {detail.insights?.suggested_questions && detail.insights.suggested_questions.length > 0 && (
                  <div className="space-y-2 border-t border-glass-border pt-4">
                    <h4 className="font-bold text-zinc-300 text-[10px] uppercase tracking-wider">Suggested Questions:</h4>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {detail.insights.suggested_questions.map((q: string, index: number) => (
                        <a
                          href={`/chat?q=${encodeURIComponent(q)}`}
                          key={index}
                          className="block p-2 rounded-lg bg-zinc-950/30 border border-glass-border hover:border-primary/30 text-[10px] font-medium text-zinc-400 hover:text-primary transition"
                        >
                          {q}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chapters / Topics shift indices */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h3 className="text-zinc-200 font-bold text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>Chapter Timelines</span>
            </h3>
            {detail.topics.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No semantic chapters generated. Connect Ollama model for structuring topics.</p>
            ) : (
              <div className="space-y-3.5 max-h-56 overflow-y-auto pr-2">
                {detail.topics.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => t.start_time !== null && seekTo(t.start_time)}
                    className="w-full text-left p-3 rounded-xl border border-glass-border bg-zinc-950/20 hover:bg-zinc-800/20 hover:border-primary/20 transition flex justify-between gap-3 group"
                  >
                    <div>
                      <p className="text-xs font-bold text-zinc-200 group-hover:text-primary transition">{t.title}</p>
                      <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{t.summary}</p>
                    </div>
                    {t.start_time !== null && (
                      <span className="text-[10px] font-semibold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20 h-fit">
                        {Math.floor(t.start_time / 60)}:{(t.start_time % 60).toString().padStart(2, '0')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive transcript panel (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel p-6 rounded-2xl flex flex-col h-[75vh]">
            {/* Speakers List & rename editor */}
            <div className="flex flex-wrap items-center gap-3 border-b border-glass-border pb-4 mb-4">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Speakers:</span>
              {detail.speakers.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5 bg-zinc-800/50 border border-glass-border px-3 py-1 rounded-full text-xs font-medium text-zinc-300">
                  {editingSpeaker === s.id ? (
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="text" 
                        value={speakerNameInput}
                        onChange={(e) => setSpeakerNameInput(e.target.value)}
                        className="bg-black border border-glass-border rounded px-1.5 py-0.5 text-xs text-white max-w-[80px]"
                        autoFocus
                      />
                      <button onClick={() => saveSpeakerName(s.id)} className="text-emerald-400 hover:text-emerald-300">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>{s.display_name || s.label}</span>
                      <button onClick={() => handleRenameSpeaker(s.id, s.display_name || s.label)} className="text-zinc-500 hover:text-white">
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Transcript scroll pane */}
            <div 
              ref={transcriptContainerRef}
              className="flex-1 overflow-y-auto space-y-6 pr-2"
            >
              {detail.transcript?.segments && detail.transcript.segments.length > 0 ? (
                detail.transcript.segments.map((seg) => {
                  const isActive = currentTime >= seg.start && currentTime <= seg.end;
                  
                  // Find display name for speaker label
                  const speakerObj = detail.speakers.find(s => s.label === seg.speaker_label);
                  const dispName = speakerObj?.display_name || seg.speaker_label;
                  
                  const startMin = Math.floor(seg.start / 60);
                  const startSec = Math.floor(seg.start % 60).toString().padStart(2, '0');

                  return (
                    <div
                      key={seg.id}
                      id={`seg-${seg.id}`}
                      onClick={() => seekTo(seg.start)}
                      className={`p-4 rounded-xl border transition cursor-pointer flex flex-col gap-1.5 ${
                        isActive 
                          ? "bg-primary/10 border-primary/45 shadow shadow-primary/10" 
                          : "bg-zinc-950/20 border-glass-border hover:bg-zinc-800/10 hover:border-zinc-700/50"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-primary font-bold">{dispName}</span>
                        <span className="text-zinc-500 font-mono flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {startMin}:{startSec}
                        </span>
                      </div>
                      <p className={`text-sm leading-relaxed ${isActive ? "text-white font-medium" : "text-zinc-300"}`}>
                        {seg.text}
                      </p>
                    </div>
                  );
                })
              ) : detail.chunks && detail.chunks.length > 0 ? (
                detail.chunks.map((chunk) => {
                  const startMin = chunk.start_time !== null ? Math.floor(chunk.start_time / 60) : 0;
                  const startSec = chunk.start_time !== null ? Math.floor(chunk.start_time % 60).toString().padStart(2, '0') : "";

                  return (
                    <div
                      key={chunk.id}
                      className="p-4 rounded-xl border border-glass-border bg-zinc-950/20 hover:bg-zinc-800/10 hover:border-zinc-700/50 transition flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-primary font-bold">
                          {chunk.page_number ? `Page ${chunk.page_number}` : "Section"}
                        </span>
                        {chunk.start_time !== null && chunk.start_time > 0 && (
                          <span className="text-zinc-500 font-mono flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {startMin}:{startSec}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-zinc-300">
                        {chunk.text}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-20 text-zinc-500 font-semibold italic">No content or transcript available for this file.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
