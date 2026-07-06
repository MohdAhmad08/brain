"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home,
  Library, 
  MessageSquare, 
  Search, 
  Network, 
  FileText, 
  Calendar, 
  Settings,
  Brain,
  HardDrive,
  FolderOpen,
  Loader2,
  RefreshCw
} from "lucide-react";
import { api } from "@/services/api";

export default function Sidebar() {
  const pathname = usePathname();
  const [processingCount, setProcessingCount] = useState(0);
  const [activeFoldersCount, setActiveFoldersCount] = useState(3); // Default mockup count

  // Menu mapping matching mockup labels
  const menuItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Library", href: "/library", icon: Library },
    { name: "AI Chat", href: "/chat", icon: MessageSquare },
    { name: "Search", href: "/search", icon: Search },
    { name: "Timeline", href: "/timeline", icon: Calendar },
    { name: "Knowledge Graph", href: "/graph", icon: Network },
    { name: "Smart Notes", href: "/notes", icon: FileText },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  useEffect(() => {
    // Dynamic polling of processing queue
    const fetchQueueState = async () => {
      try {
        const data = await api.listMedia();
        const processing = data.filter(m => m.status === "processing" || m.status === "pending").length;
        setProcessingCount(processing);
      } catch (e) {
        console.error("Sidebar background check failed:", e);
      }
    };
    
    // Check local storage folder configs
    const checkFolders = () => {
      try {
        const stored = localStorage.getItem("watched_folders");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setActiveFoldersCount(parsed.length);
          }
        }
      } catch (e) {
        // Fallback to default
      }
    };

    fetchQueueState();
    checkFolders();
    
    const interval = setInterval(fetchQueueState, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-64 h-screen glass-panel fixed left-0 top-0 z-40 flex flex-col border-r border-glass-border rounded-r-2xl m-0 shadow-2xl overflow-hidden justify-between">
      <div>
        {/* Brand Header */}
        <div className="p-6 flex items-center gap-3 border-b border-glass-border">
          <div className="bg-primary/20 p-2.5 rounded-xl border border-primary/30 text-primary animate-pulse">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight tracking-tight text-white">Media Brain</h1>
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">100% Local AI</span>
          </div>
        </div>

        {/* Nav List */}
        <nav className="px-4 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? "bg-primary/25 border border-primary/45 text-white shadow shadow-primary/10 scale-[1.01]" 
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/20 border border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-zinc-400"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Status Widgets (Mockup Widgets) */}
      <div className="p-5 border-t border-glass-border bg-zinc-950/20 space-y-5">
        {/* Storage Widget */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
              <span>Storage</span>
            </span>
            <span>1.2 TB / 2 TB Used</span>
            <span className="text-zinc-500">60%</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden border border-glass-border">
            <div className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full" style={{ width: "60%" }}></div>
          </div>
        </div>

        {/* Status Indicators Container */}
        <div className="space-y-2.5">
          {/* Watch Folders widget */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/40 border border-glass-border/40">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-400">Watch Folders</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-zinc-300">{activeFoldersCount} Active</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
          
          {/* Processing Queue widget */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/40 border border-glass-border/40">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-400">Processing Queue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-zinc-300">
                {processingCount > 0 ? `${processingCount} Running` : "Idle"}
              </span>
              {processingCount > 0 ? (
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
