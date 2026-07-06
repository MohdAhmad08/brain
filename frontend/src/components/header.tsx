"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Bell, Upload, Loader2, CheckCircle2, User } from "lucide-react";
import { api } from "@/services/api";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle global keyboard shortcut ⌘K or Ctrl+K to focus search input
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadStatus(`Uploading ${files.length} asset(s)...`);
    try {
      for (let i = 0; i < files.length; i++) {
        await api.uploadFile(files[i]);
      }
      setUploadStatus("Upload successful! Ingesting...");
      // Trigger a page reload or state sync if on the library/dashboard page
      setTimeout(() => {
        setUploadStatus(null);
        window.location.reload();
      }, 2000);
    } catch (err) {
      setUploadStatus("Upload failed. Verify server is running.");
      setTimeout(() => setUploadStatus(null), 4000);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <header className="w-full px-8 py-4 border-b border-glass-border bg-zinc-950/20 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between gap-6">
      {/* Search Input Bar (Mockup Centralized Search) */}
      <form onSubmit={handleSearchSubmit} className="flex-1 max-w-lg relative">
        <Search className="absolute left-4 top-3 w-4 h-4 text-zinc-400" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search anything..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full glass-input pl-11 pr-14 py-2.5 text-sm font-medium rounded-xl"
        />
        <div className="absolute right-3.5 top-2.5 px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900/60 text-[10px] font-bold text-zinc-500 select-none pointer-events-none">
          Ctrl K
        </div>
      </form>

      {/* Action Buttons & Profile Widget */}
      <div className="flex items-center gap-4">
        {/* Upload Status Toast overlay inside Header */}
        {uploadStatus && (
          <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 border border-glass-border flex items-center gap-2 text-zinc-300 animate-fade-in shadow-xl">
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{uploadStatus}</span>
          </div>
        )}

        {/* Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={triggerFileUpload}
          disabled={isUploading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-glass-border hover:bg-zinc-800/45 font-semibold text-xs text-zinc-300 transition hover:scale-[1.02] cursor-pointer disabled:opacity-40 disabled:scale-100"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload</span>
        </button>

        {/* Notifications Icon */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 rounded-xl border border-glass-border hover:bg-zinc-800/40 text-zinc-400 hover:text-white transition cursor-pointer relative"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 border border-zinc-950" />
          </button>

          {/* Simple Dropdown list */}
          {showNotifications && (
            <div className="absolute right-0 mt-2.5 w-64 glass-panel p-4 rounded-xl border border-glass-border bg-zinc-950/95 shadow-2xl z-50 text-xs space-y-2">
              <h4 className="font-bold text-zinc-200 border-b border-glass-border pb-1.5 mb-2">Notifications</h4>
              <p className="text-zinc-400 font-medium leading-relaxed">No new alerts. Your offline background indexing pipelines are active.</p>
            </div>
          )}
        </div>

        {/* Profile Initials Badge */}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 border border-primary/30 flex items-center justify-center font-bold text-sm text-white select-none shadow cursor-pointer hover:scale-105 transition">
          <User className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
}
