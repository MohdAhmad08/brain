"use client";

import { useEffect, useState, useRef } from "react";
import { 
  FileText, 
  Video, 
  Music, 
  Upload, 
  FolderSync, 
  FileCheck,
  AlertTriangle,
  Loader2,
  Plus,
  Play,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  FolderOpen,
  ArrowUp,
  Settings,
  MessageSquare,
  Search,
  BookOpen,
  Brain,
  X,
  FileSpreadsheet
} from "lucide-react";
import { api, MediaAsset } from "@/services/api";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [foldersInput, setFoldersInput] = useState("");
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [showManageFolders, setShowManageFolders] = useState(false);
  const [askInput, setAskInput] = useState("");
  const [greeting, setGreeting] = useState("Good Morning");

  const [watchedFolders, setWatchedFolders] = useState<string[]>([
    "D:\\Media\\Meetings",
    "D:\\Lectures\\",
    "D:\\Documents\\"
  ]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);

    // Initial folder load
    const stored = localStorage.getItem("watched_folders");
    if (stored) {
      try {
        setWatchedFolders(JSON.parse(stored));
      } catch (e) {}
    } else {
      localStorage.setItem("watched_folders", JSON.stringify(watchedFolders));
    }

    // Dynamic greeting according to local time
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting("Good Morning");
    } else if (hour < 17) {
      setGreeting("Good Afternoon");
    } else {
      setGreeting("Good Evening");
    }

    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const data = await api.listMedia();
      setMedia(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foldersInput.trim()) return;
    
    const dirs = foldersInput.split(",").map(d => d.trim()).filter(Boolean);
    setSyncStatus("Queuing folder scan...");
    try {
      await api.syncFolders(dirs);
      setSyncStatus("Folders synchronized!");
      
      const newFolders = Array.from(new Set([...watchedFolders, ...dirs]));
      setWatchedFolders(newFolders);
      localStorage.setItem("watched_folders", JSON.stringify(newFolders));
      
      setFoldersInput("");
      fetchDashboardData();
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (e) {
      setSyncStatus("Sync failed. Check paths.");
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const removeFolder = (pathToRemove: string) => {
    const next = watchedFolders.filter(f => f !== pathToRemove);
    setWatchedFolders(next);
    localStorage.setItem("watched_folders", JSON.stringify(next));
  };

  const handleQuickUploadClick = () => {
    // Triggers the hidden file input element in the global header component
    const headerInput = document.querySelector('header input[type="file"]') as HTMLInputElement;
    if (headerInput) {
      headerInput.click();
    }
  };

  const handleAskBarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (askInput.trim()) {
      router.push(`/chat?q=${encodeURIComponent(askInput.trim())}`);
    }
  };

  // Helper size formatter
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  // Live Statistics calculation
  const totalFiles = media.length;
  const processingCount = media.filter(m => m.status === "processing" || m.status === "pending").length;
  const completedCount = media.filter(m => m.status === "completed").length;
  const failedCount = media.filter(m => m.status === "failed").length;

  const typeCounts = media.reduce((acc, m) => {
    const t = m.mime_type.toLowerCase();
    if (["mp4", "mkv", "avi", "mov", "video"].includes(t)) {
      acc.video.count++;
      acc.video.size += m.file_size;
    } else if (["mp3", "wav", "m4a", "flac", "audio"].includes(t)) {
      acc.audio.count++;
      acc.audio.size += m.file_size;
    } else if (["pdf", "docx", "doc", "pptx", "ppt", "txt", "md"].includes(t)) {
      acc.docs.count++;
      acc.docs.size += m.file_size;
    } else {
      acc.others.count++;
      acc.others.size += m.file_size;
    }
    return acc;
  }, { 
    video: { count: 0, size: 0 }, 
    audio: { count: 0, size: 0 }, 
    docs: { count: 0, size: 0 }, 
    others: { count: 0, size: 0 } 
  });

  // Fallbacks for mockup display if database is empty
  const displayTotal = totalFiles > 0 ? totalFiles : 164;
  const displayVideos = totalFiles > 0 ? typeCounts.video.count : 62;
  const displayVideosSize = totalFiles > 0 ? formatBytes(typeCounts.video.size) : "8.4 GB";
  const displayAudio = totalFiles > 0 ? typeCounts.audio.count : 38;
  const displayAudioSize = totalFiles > 0 ? formatBytes(typeCounts.audio.size) : "2.1 GB";
  const displayDocs = totalFiles > 0 ? typeCounts.docs.count : 49;
  const displayDocsSize = totalFiles > 0 ? formatBytes(typeCounts.docs.size) : "1.3 GB";
  const displayFailed = totalFiles > 0 ? failedCount : 13;

  const displayIngest = totalFiles > 0 ? media.filter(m => m.status === "pending").length : 1;
  const displayTranscribe = totalFiles > 0 ? media.filter(m => m.status === "processing").length : 1;
  const displayIndex = totalFiles > 0 ? completedCount : 150;
  const displayEmbed = totalFiles > 0 ? completedCount : 150;

  // Pie chart data
  const pieData = [
    { name: "Videos", value: displayVideos, size: displayVideosSize, color: "#8b5cf6" },
    { name: "Audio", value: displayAudio, size: displayAudioSize, color: "#10b981" },
    { name: "Documents", value: displayDocs, size: displayDocsSize, color: "#60a5fa" },
    { name: "Others", value: totalFiles > 0 ? typeCounts.others.count : 15, size: totalFiles > 0 ? formatBytes(typeCounts.others.size) : "0.4 GB", color: "#f59e0b" },
  ].filter(d => d.value > 0);

  const totalPieValue = pieData.reduce((acc, curr) => acc + curr.value, 0);

  // Ingestion Pipeline logs
  const activityList = media.length > 0 
    ? media.slice(0, 5).map((m) => {
        let msg = "Registered asset";
        let color = "text-zinc-400";
        if (m.status === "completed") {
          msg = m.mime_type.includes("pdf") || m.mime_type.includes("txt") ? "Indexed successfully" : "Transcription completed";
          color = "text-emerald-400";
        } else if (m.status === "processing") {
          msg = "Processing dialog tracks...";
          color = "text-primary animate-pulse";
        } else if (m.status === "failed") {
          msg = "Processing failed";
          color = "text-rose-400";
        }

        const minsAgo = Math.max(1, Math.round((Date.now() - new Date(m.created_at).getTime()) / 60000));
        const timeStr = minsAgo < 60 ? `${minsAgo}m ago` : `${Math.round(minsAgo / 60)}h ago`;

        return {
          id: m.id,
          file_name: m.file_name,
          message: msg,
          time: timeStr,
          color,
          type: m.mime_type
        };
      })
    : [
        { id: 1, file_name: "Meeting_Notes.mp4", message: "Transcription completed", time: "2m ago", color: "text-emerald-400", type: "video" },
        { id: 2, file_name: "Lecture_12.pdf", message: "Indexed successfully", time: "8m ago", color: "text-emerald-400", type: "pdf" },
        { id: 3, file_name: "Interview_Ahmad.mp3", message: "Processing failed", time: "15m ago", color: "text-rose-400", type: "audio" },
        { id: 4, file_name: "Research_Paper.pdf", message: "Indexing completed", time: "21m ago", color: "text-emerald-400", type: "pdf" },
        { id: 5, file_name: "Podcast_Episode.mp3", message: "Transcription completed", time: "35m ago", color: "text-emerald-400", type: "audio" }
      ];

  // Recently Added items
  const recentlyAdded = media.length > 0 
    ? media.slice(0, 4) 
    : [
        { id: 101, file_name: "Team Sync Meeting.mp4", mime_type: "video/mp4", created_at: "Today, 10:30 AM" },
        { id: 102, file_name: "Deep Learning.pdf", mime_type: "application/pdf", created_at: "Today, 09:15 AM" },
        { id: 103, file_name: "Interview_Rahul.mp3", mime_type: "audio/mp3", created_at: "Yesterday, 08:45 PM" },
        { id: 104, file_name: "Project_Overview.docx", mime_type: "application/vnd.openxmlformats-officedocument", created_at: "Yesterday, 07:12 PM" }
      ];

  // Most recent completed video or audio file to showcase
  const recentPlayable = media.find(m => 
    m.status === "completed" && 
    (["mp4", "mkv", "avi", "mov", "video", "mp3", "wav", "m4a", "audio"].includes(m.mime_type.toLowerCase()))
  );

  return (
    <div className="space-y-8 pb-20">
      
      {/* Welcome Banner */}
      <div>
        <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
          <span>{greeting}</span>
          <span className="animate-bounce">👋</span>
        </h2>
        <p className="text-zinc-400 mt-1 font-semibold text-sm">Your AI brain is ready. Ask anything about your files.</p>
      </div>

      {/* Main Grid: Left Section (9 Cols) + Right Sidebar Widgets (3 Cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Section (9 Cols) */}
        <div className="xl:col-span-9 space-y-8">
          
          {/* Stat Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            
            {/* Total Files */}
            <div className="glass-panel p-4 rounded-2xl flex items-center gap-3.5 border-purple-500/10 hover:border-purple-500/20 bg-zinc-950/10">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                <FolderOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 block truncate">Total Files</span>
                <h3 className="text-lg font-black text-white mt-0.5">{displayTotal}</h3>
                <span className="text-[9px] text-purple-400 font-bold block">+12 today</span>
              </div>
            </div>

            {/* Videos */}
            <div className="glass-panel p-4 rounded-2xl flex items-center gap-3.5 border-blue-500/10 hover:border-blue-500/20 bg-zinc-950/10">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                <Video className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 block truncate">Videos</span>
                <h3 className="text-lg font-black text-white mt-0.5">{displayVideos}</h3>
                <span className="text-[9px] text-blue-400 font-bold block">{displayVideosSize}</span>
              </div>
            </div>

            {/* Audio */}
            <div className="glass-panel p-4 rounded-2xl flex items-center gap-3.5 border-emerald-500/10 hover:border-emerald-500/20 bg-zinc-950/10">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <Music className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 block truncate">Audio</span>
                <h3 className="text-lg font-black text-white mt-0.5">{displayAudio}</h3>
                <span className="text-[9px] text-emerald-400 font-bold block">{displayAudioSize}</span>
              </div>
            </div>

            {/* Documents */}
            <div className="glass-panel p-4 rounded-2xl flex items-center gap-3.5 border-amber-500/10 hover:border-amber-500/20 bg-zinc-950/10">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 block truncate">Documents</span>
                <h3 className="text-lg font-black text-white mt-0.5">{displayDocs}</h3>
                <span className="text-[9px] text-amber-400 font-bold block">{displayDocsSize}</span>
              </div>
            </div>

            {/* Failures */}
            <div className="glass-panel p-4 rounded-2xl flex items-center gap-3.5 border-rose-500/10 hover:border-rose-500/20 bg-zinc-950/10">
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20 animate-pulse">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 block truncate">Failures</span>
                <h3 className="text-lg font-black text-white mt-0.5">{displayFailed}</h3>
                <span className="text-[9px] text-rose-400 font-bold block">Need attention</span>
              </div>
            </div>

          </div>

          {/* Row 2: Watch Folders, Processing Pipeline, Library Composition */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Watch Folders Sync */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-[270px]">
              <div>
                <h4 className="font-bold text-zinc-200 text-sm flex items-center gap-2">
                  <FolderSync className="w-4 h-4 text-primary" />
                  <span>Watch Folders</span>
                </h4>
                <div className="text-[11px] text-zinc-500 font-semibold mt-1">
                  Your watcher is running. {watchedFolders.length} folders are being monitored.
                </div>
                
                {/* List of watched folder paths */}
                <div className="space-y-1.5 mt-3 max-h-24 overflow-y-auto pr-1">
                  {watchedFolders.map((path) => (
                    <div key={path} className="flex items-center justify-between p-2 rounded bg-zinc-950/30 border border-glass-border group transition hover:border-zinc-800">
                      <span className="text-[11px] text-zinc-300 font-mono truncate mr-2">{path}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-emerald-400 font-bold uppercase">Active</span>
                        <button 
                          onClick={() => removeFolder(path)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                          title="Remove folder"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add folder form / Manage toggle */}
              <div className="mt-4 border-t border-glass-border pt-4">
                {showManageFolders ? (
                  <form onSubmit={handleFolderSync} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Folder path..."
                      value={foldersInput}
                      onChange={(e) => setFoldersInput(e.target.value)}
                      className="flex-1 glass-input py-1.5 px-2.5 text-xs font-mono"
                      autoFocus
                    />
                    <button type="submit" className="glow-btn px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">
                      Add
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowManageFolders(false)}
                      className="p-1 text-zinc-400 hover:text-white transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowManageFolders(true)}
                    className="w-full py-2.5 rounded-xl border border-glass-border bg-zinc-950/20 hover:bg-zinc-800/35 transition text-xs font-bold text-zinc-300 shadow flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Manage Folders</span>
                  </button>
                )}
                {syncStatus && (
                  <p className="text-[10px] font-bold text-primary mt-2">{syncStatus}</p>
                )}
              </div>
            </div>

            {/* Processing Pipeline Monitor */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-[270px]">
              <div>
                <h4 className="font-bold text-zinc-200 text-sm flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-primary animate-spin-slow" />
                  <span>Processing Pipeline</span>
                </h4>
                <div className="text-[11px] text-zinc-500 font-semibold mt-1">
                  Active offline cognitive execution pipeline stages.
                </div>
              </div>

              {/* Pipeline layout */}
              <div className="grid grid-cols-4 gap-1 items-center relative py-6">
                
                {/* 1. Ingest */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-9 h-9 rounded-full bg-zinc-900 border border-glass-border flex items-center justify-center text-zinc-400">
                    <Upload className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9px] font-bold text-zinc-400 mt-2">Ingest</span>
                  <span className="text-[11px] font-black text-white mt-1">{displayIngest}</span>
                  <span className="text-[8px] text-zinc-500 font-bold uppercase">In Queue</span>
                </div>

                {/* 2. Transcribe */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-9 h-9 rounded-full bg-zinc-900 border border-glass-border flex items-center justify-center text-zinc-400">
                    <Music className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <span className="text-[9px] font-bold text-zinc-400 mt-2">Transcribe</span>
                  <span className="text-[11px] font-black text-white mt-1">{displayTranscribe}</span>
                  <span className="text-[8px] text-zinc-500 font-bold uppercase">Running</span>
                </div>

                {/* 3. Index */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-9 h-9 rounded-full bg-zinc-900 border border-glass-border flex items-center justify-center text-zinc-400">
                    <FileCheck className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9px] font-bold text-zinc-400 mt-2">Index</span>
                  <span className="text-[11px] font-black text-white mt-1">{displayIndex}</span>
                  <span className="text-[8px] text-zinc-500 font-bold uppercase">Done</span>
                </div>

                {/* 4. Embed */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-9 h-9 rounded-full bg-zinc-900 border border-glass-border flex items-center justify-center text-zinc-400">
                    <Brain className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9px] font-bold text-zinc-400 mt-2">Embed</span>
                  <span className="text-[11px] font-black text-white mt-1">{displayEmbed}</span>
                  <span className="text-[8px] text-zinc-500 font-bold uppercase">Done</span>
                </div>

              </div>
              
              <div className="text-[10px] text-zinc-500 font-medium italic text-center">
                Autopooled folder scanning is running in the background.
              </div>
            </div>

            {/* Donut Chart: Library Composition */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-[270px]">
              <div>
                <h4 className="font-bold text-zinc-200 text-sm">Library Composition</h4>
                <div className="text-[11px] text-zinc-500 font-semibold mt-1">File categories breakdown.</div>
              </div>

              {/* Donut graphic container */}
              <div className="relative h-28 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={50}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#09090b', border: '1px solid rgba(63,63,70,0.4)', borderRadius: '8px', color: '#fff', fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Donut Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-black text-white">{totalPieValue}</span>
                  <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">Total</span>
                </div>
              </div>

              {/* Donut Legend */}
              <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-zinc-400 mt-2">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full block shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="truncate">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Row 3: Continue Watching, Recently Added */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Continue Watching / Listening (5 Cols of left) */}
            <div className="md:col-span-5 glass-panel p-5 rounded-2xl flex flex-col justify-between h-[300px]">
              <div>
                <h4 className="font-bold text-zinc-200 text-sm">Continue Watching / Listening</h4>
                <div className="text-[11px] text-zinc-500 font-semibold mt-1">Pick up where you left off.</div>
              </div>

              {/* Player Thumbnail Wrapper */}
              <div className="relative rounded-xl overflow-hidden bg-zinc-950 border border-glass-border flex-1 my-3 flex items-center justify-center">
                {recentPlayable ? (
                  <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url(${recentPlayable.thumbnail_path || ""})` }} />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-tr from-zinc-900 to-indigo-950/20" />
                )}
                
                {/* Media Type Icon indicator */}
                <div className="absolute top-2.5 left-2.5 p-1.5 rounded bg-zinc-950/70 border border-glass-border/60 text-zinc-300">
                  {recentPlayable?.mime_type.includes("audio") ? <Music className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                </div>

                {/* Play Button Overlay */}
                <a 
                  href={`/player/${recentPlayable?.id || 1}`}
                  className="w-11 h-11 rounded-full bg-white/10 hover:bg-primary/95 text-white hover:text-white border border-white/20 hover:border-primary/20 flex items-center justify-center transition duration-200 shadow-lg scale-100 hover:scale-105"
                >
                  <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                </a>

                {/* Timeline status label at bottom */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[9px] font-bold text-zinc-300 bg-zinc-950/65 px-2 py-1.5 rounded border border-glass-border/30">
                  <span className="truncate max-w-[130px]">{recentPlayable?.file_name || "Product Strategy Meeting.mp4"}</span>
                  <span>{recentPlayable ? `0:00 / ${Math.floor((recentPlayable.duration || 0) / 60)}:00` : "42:15 / 1:24:30"}</span>
                </div>
              </div>

              {/* Actions */}
              <a
                href={`/player/${recentPlayable?.id || 1}`}
                className="w-full py-2.5 rounded-xl border border-glass-border bg-zinc-950/20 hover:bg-zinc-800/35 transition text-xs font-bold text-zinc-300 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Resume Playback</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Recently Added (7 Cols of left) */}
            <div className="md:col-span-7 glass-panel p-5 rounded-2xl flex flex-col justify-between h-[300px]">
              <div>
                <h4 className="font-bold text-zinc-200 text-sm">Recently Added</h4>
                <div className="text-[11px] text-zinc-500 font-semibold mt-1">Latest offline knowledge ingestion.</div>
              </div>

              {/* Horizontal Grid List */}
              <div className="grid grid-cols-2 gap-4 flex-1 my-3 overflow-y-auto pr-1">
                {recentlyAdded.map((item: any) => {
                  let Icon = FileText;
                  let borderTheme = "border-glass-border hover:border-zinc-700";
                  if (item.mime_type?.includes("video")) {
                    Icon = Video;
                    borderTheme = "border-blue-500/10 hover:border-blue-500/30";
                  } else if (item.mime_type?.includes("audio")) {
                    Icon = Music;
                    borderTheme = "border-emerald-500/10 hover:border-emerald-500/30";
                  } else if (item.mime_type?.includes("spreadsheet") || item.file_name.endsWith(".xlsx")) {
                    Icon = FileSpreadsheet;
                    borderTheme = "border-amber-500/10 hover:border-amber-500/30";
                  }
                  
                  return (
                    <a
                      href={`/player/${item.id}`}
                      key={item.id}
                      className={`flex flex-col justify-between p-3 rounded-xl border bg-zinc-950/20 transition cursor-pointer ${borderTheme}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded bg-zinc-900 border border-glass-border text-zinc-400">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[9px] uppercase tracking-wide text-zinc-500 font-bold">
                          {item.mime_type?.split("/")[1]?.toUpperCase() || "DOC"}
                        </span>
                      </div>
                      <div className="mt-2.5">
                        <p className="text-[11px] font-bold text-zinc-200 truncate">{item.file_name}</p>
                        <span className="text-[9px] text-zinc-500 font-medium block mt-0.5">
                          {item.created_at.includes("Today") || item.created_at.includes("Yesterday")
                            ? item.created_at 
                            : new Date(item.created_at).toLocaleDateString(undefined, {month: "short", day: "numeric"})}
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>

              {/* View All Library Link */}
              <a
                href="/library"
                className="w-full py-2.5 rounded-xl border border-glass-border bg-zinc-950/20 hover:bg-zinc-800/35 transition text-xs font-bold text-zinc-300 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>View Library Database</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>

        </div>

        {/* Right Section (3 Cols) - Sidebar Widgets */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* Recent Activity */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <h4 className="font-bold text-zinc-200 text-sm">Recent Activity</h4>
            <div className="space-y-3.5">
              {activityList.map((item) => (
                <div key={item.id} className="flex gap-2.5 items-start">
                  <div className="p-2 rounded bg-zinc-900 border border-glass-border/60 text-zinc-400 mt-0.5 shrink-0">
                    {item.type.includes("video") ? (
                      <Video className="w-3.5 h-3.5" />
                    ) : item.type.includes("audio") ? (
                      <Music className="w-3.5 h-3.5" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-zinc-300 truncate">{item.file_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[9px] font-bold ${item.color}`}>{item.message}</span>
                      <span className="text-[8px] text-zinc-600">•</span>
                      <span className="text-[9px] text-zinc-500 font-semibold">{item.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights Widget */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <h4 className="font-bold text-zinc-200 text-sm flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span>AI Insights</span>
            </h4>
            
            <div className="space-y-3">
              {/* Insight 1 */}
              <div className="p-3 rounded-xl bg-zinc-950/30 border border-glass-border/30 space-y-1">
                <div className="flex justify-between items-center text-[9px] font-bold">
                  <span className="text-zinc-400">Meeting Notes Summary</span>
                  <span className="text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">42:15</span>
                </div>
                <p className="text-xs font-semibold text-zinc-200 leading-normal">
                  Budget discussion detected in Meeting_Notes.mp4
                </p>
              </div>

              {/* Insight 2 */}
              <div className="p-3 rounded-xl bg-zinc-950/30 border border-glass-border/30 space-y-1">
                <div className="flex justify-between items-center text-[9px] font-bold">
                  <span className="text-zinc-400">PDF Ingestion Scan</span>
                  <span className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">Page 18</span>
                </div>
                <p className="text-xs font-semibold text-zinc-200 leading-normal">
                  New Machine Learning concepts matching Qwen models.
                </p>
              </div>

              {/* Insight 3 */}
              <div className="p-3 rounded-xl bg-zinc-950/30 border border-glass-border/30 space-y-1">
                <div className="flex justify-between items-center text-[9px] font-bold">
                  <span className="text-zinc-400">General Synthesis</span>
                  <span className="text-zinc-500 bg-zinc-800/30 px-1.5 py-0.5 rounded">View</span>
                </div>
                <p className="text-xs font-semibold text-zinc-200 leading-normal">
                  12 Action items generated across 3 meetings
                </p>
              </div>
            </div>
            
            <a
              href="/chat?q=Synthesize%20recent%20insights"
              className="w-full py-2.5 rounded-xl border border-glass-border bg-zinc-950/20 hover:bg-zinc-800/35 transition text-xs font-bold text-zinc-300 flex items-center justify-center gap-1.5 cursor-pointer shadow"
            >
              <span>View All Insights</span>
            </a>
          </div>

          {/* Quick Actions */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <h4 className="font-bold text-zinc-200 text-sm">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-3">
              
              {/* Upload File */}
              <button 
                onClick={handleQuickUploadClick}
                className="p-3.5 rounded-xl border border-purple-500/10 hover:border-purple-500/35 bg-purple-500/5 hover:bg-purple-500/10 transition text-left flex flex-col justify-between h-20 cursor-pointer shadow group"
              >
                <Upload className="w-4 h-4 text-purple-400 group-hover:scale-105 transition" />
                <span className="text-xs font-bold text-zinc-200">Upload File</span>
              </button>

              {/* AI Chat */}
              <a 
                href="/chat"
                className="p-3.5 rounded-xl border border-blue-500/10 hover:border-blue-500/35 bg-blue-500/5 hover:bg-blue-500/10 transition text-left flex flex-col justify-between h-20 cursor-pointer shadow group"
              >
                <MessageSquare className="w-4 h-4 text-blue-400 group-hover:scale-105 transition" />
                <span className="text-xs font-bold text-zinc-200">AI Chat</span>
              </a>

              {/* New Note */}
              <a 
                href="/notes"
                className="p-3.5 rounded-xl border border-emerald-500/10 hover:border-emerald-500/35 bg-emerald-500/5 hover:bg-emerald-500/10 transition text-left flex flex-col justify-between h-20 cursor-pointer shadow group"
              >
                <FileText className="w-4 h-4 text-emerald-400 group-hover:scale-105 transition" />
                <span className="text-xs font-bold text-zinc-200">New Note</span>
              </a>

              {/* Smart Search */}
              <a 
                href="/search"
                className="p-3.5 rounded-xl border border-amber-500/10 hover:border-amber-500/35 bg-amber-500/5 hover:bg-amber-500/10 transition text-left flex flex-col justify-between h-20 cursor-pointer shadow group"
              >
                <Search className="w-4 h-4 text-amber-400 group-hover:scale-105 transition" />
                <span className="text-xs font-bold text-zinc-200">Smart Search</span>
              </a>

            </div>
          </div>

        </div>

      </div>

      {/* Floating Ask Input Bar (Mockup Bottom Ask) */}
      <div className="fixed bottom-6 left-72 right-8 flex justify-center z-20 pointer-events-none">
        <form 
          onSubmit={handleAskBarSubmit} 
          className="w-full max-w-2xl glass-panel px-4 py-3 rounded-full border border-glass-border/70 bg-zinc-950/80 shadow-2xl flex items-center gap-3 backdrop-blur-xl pointer-events-auto"
        >
          <input
            type="text"
            placeholder="Ask anything about your media..."
            value={askInput}
            onChange={(e) => setAskInput(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white outline-none border-none py-1 px-2 font-medium placeholder-zinc-500"
          />
          <button 
            type="submit" 
            disabled={!askInput.trim()}
            className="glow-btn p-2 rounded-full flex items-center justify-center transition disabled:opacity-40 disabled:scale-100 cursor-pointer"
          >
            <ArrowUp className="w-4 h-4 text-white" />
          </button>
        </form>
      </div>

    </div>
  );
}
