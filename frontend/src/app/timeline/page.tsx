"use client";

import { useEffect, useState } from "react";
import { 
  Calendar, 
  Clock, 
  FileText, 
  Video, 
  Music, 
  ExternalLink,
  Loader2,
  FolderOpen
} from "lucide-react";
import { api, TimelineEvent } from "@/services/api";

export default function TimelineView() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
  }, []);

  const loadTimeline = async () => {
    try {
      const data = await api.getTimeline();
      setEvents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-glass-border pb-6">
        <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">Project Timeline</h2>
        <p className="text-zinc-400 mt-1.5 font-medium font-sans">Unified chronological stream of meeting segments, topics, and events across your library.</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-zinc-400 font-semibold">Generating unified project timelines...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl text-center space-y-4 max-w-xl mx-auto">
          <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mx-auto border border-glass-border">
            <Calendar className="w-8 h-8 text-zinc-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-200">No timeline events found</h3>
            <p className="text-sm text-zinc-500 mt-1.5 font-sans">
              Once you upload video or audio transcripts, their topic transitions will compile automatically here.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative max-w-3xl mx-auto pl-8 border-l-2 border-glass-border space-y-12 py-4">
          {events.map((ev, idx) => {
            let Icon = FileText;
            let badgeColor = "text-blue-400 bg-blue-500/10 border-blue-500/20";
            
            if (["video", "mp4", "mkv", "avi", "mov"].includes(ev.mime_type.toLowerCase())) {
              Icon = Video;
              badgeColor = "text-purple-400 bg-purple-500/10 border-purple-500/20";
            } else if (["audio", "mp3", "wav", "m4a", "flac"].includes(ev.mime_type.toLowerCase())) {
              Icon = Music;
              badgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
            }

            const timeMin = ev.start_time !== null ? Math.floor(ev.start_time / 60) : 0;
            const timeSec = ev.start_time !== null ? Math.floor(ev.start_time % 60).toString().padStart(2, '0') : "";
            
            const fileDate = new Date(ev.file_created_at).toLocaleDateString(undefined, {
              year: "numeric", month: "short", day: "numeric"
            });

            return (
              <div key={idx} className="relative group">
                {/* Bullet point nodes */}
                <div className="absolute -left-[41px] top-1 bg-zinc-950 p-2 rounded-full border-2 border-primary shadow shadow-primary/20 group-hover:scale-110 transition duration-200">
                  <Icon className="w-4 h-4 text-primary" />
                </div>

                {/* Event Card */}
                <div className="glass-panel p-6 rounded-2xl border border-glass-border bg-zinc-900/20 hover:bg-zinc-800/15 transition flex flex-col md:flex-row justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[10px] font-bold text-zinc-500 font-mono uppercase tracking-wide">
                        {fileDate}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${badgeColor}`}>
                        {ev.mime_type}
                      </span>
                      <span className="text-zinc-600 font-semibold text-xs truncate max-w-[200px]">
                        {ev.file_name}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-zinc-200 font-sans tracking-tight">
                      {ev.title}
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                      {ev.summary}
                    </p>
                  </div>

                  {/* Actions column / Seek offsets */}
                  <div className="flex flex-row md:flex-col items-end justify-between md:justify-center gap-3 border-t md:border-t-0 border-zinc-800/40 pt-3 md:pt-0">
                    {ev.start_time !== null && (
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary px-2.5 py-1 bg-primary/10 rounded-md border border-primary/25 h-fit font-mono shadow-sm">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{timeMin}:{timeSec}</span>
                      </div>
                    )}
                    
                    <a
                      href={`/player/${ev.media_id}${ev.start_time !== null ? `#L${Math.floor(ev.start_time)}` : ""}`}
                      className="p-2 rounded-xl border border-glass-border bg-zinc-900/60 hover:bg-primary hover:text-white transition flex items-center gap-1 text-xs font-bold text-zinc-400 group/btn"
                    >
                      <span>Jump</span>
                      <ExternalLink className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition" />
                    </a>
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
