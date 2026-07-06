"use client";

import { useEffect, useState } from "react";
import { 
  Search, 
  Sliders, 
  FileText, 
  Video, 
  Music, 
  ExternalLink,
  Loader2,
  Clock,
  Layers
} from "lucide-react";
import { api, MediaAsset, CitationSource } from "@/services/api";

export default function SearchView() {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [query, setQuery] = useState("");
  const [vectorWeight, setVectorWeight] = useState(0.6);
  const [limit, setLimit] = useState(5);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const filteredMedia = media.filter(m =>
    m.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    const filteredIds = filteredMedia.map(m => m.id);
    setSelectedMediaIds(prev => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleDeselectAll = () => {
    const filteredIds = new Set(filteredMedia.map(m => m.id));
    setSelectedMediaIds(prev => prev.filter(id => !filteredIds.has(id)));
  };

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async () => {
    try {
      const data = await api.listMedia("completed");
      setMedia(data);
      setSelectedMediaIds(data.map(m => m.id));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleMediaSelection = (id: number) => {
    setSelectedMediaIds(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await api.askQuestion(query, selectedMediaIds, limit, vectorWeight);
      // Wait, askQuestion returns a ChatResponse which has citations!
      // The citations array contains all retrieved chunks with scores!
      // This is exactly what we want to list as search results.
      setResults(response.citations);
    } catch (e) {
      alert("Search failed. Verify backend service health.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-glass-border pb-6">
        <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">Hybrid Semantic Search</h2>
        <p className="text-zinc-400 mt-1.5 font-medium">Query transcripts and documents using combined keyword (BM25) and vector cosine similarity.</p>
      </div>

      {/* Grid: Filters (3 cols) vs Results (9 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Filters Sidebar */}
        <div className="lg:col-span-3 space-y-6">
          {/* Weight Control */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-zinc-200 text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              <span>Hybrid Balance</span>
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-zinc-400">
                <span>Keyword (BM25)</span>
                <span>Semantic (Vector)</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={vectorWeight}
                onChange={(e) => setVectorWeight(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="text-center text-[10px] text-zinc-500 font-bold">
                Ratio: {Math.round((1 - vectorWeight) * 100)}% Keyword / {Math.round(vectorWeight * 100)}% Vector
              </div>
            </div>

            <div className="space-y-2 border-t border-glass-border pt-4">
              <label className="text-xs font-bold text-zinc-400 block">Max Results Limit</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full glass-input text-xs"
              >
                <option value={5}>Top 5 Matches</option>
                <option value={10}>Top 10 Matches</option>
                <option value={20}>Top 20 Matches</option>
              </select>
            </div>
          </div>

          {/* Media Sources Checkbox List */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-zinc-200 text-sm">Select Scope Files</h3>
            
            {/* Search Scope Files */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search scope files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full glass-input pl-9 py-2 text-xs"
              />
            </div>

            {/* Select/Deselect All Actions */}
            <div className="flex items-center justify-between text-[11px] border-b border-glass-border pb-2">
              <span className="text-zinc-500 font-medium">
                {selectedMediaIds.length} of {media.length} selected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-primary hover:underline font-semibold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-zinc-700">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-zinc-400 hover:text-zinc-300 font-medium cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {filteredMedia.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No matching assets found.</p>
              ) : (
                filteredMedia.map((m) => {
                  const isChecked = selectedMediaIds.includes(m.id);
                  return (
                    <label 
                      key={m.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-800/20 cursor-pointer text-xs font-medium text-zinc-300 transition"
                    >
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleMediaSelection(m.id)}
                        className="accent-primary rounded"
                      />
                      <span className="truncate flex-1">{m.file_name}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Search Input & Results Grid */}
        <div className="lg:col-span-9 space-y-6">
          {/* Search bar form */}
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                placeholder="Query keywords, dates, companies, speakers, or conceptual meanings..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full glass-input pl-12 py-3.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="glow-btn px-6 rounded-xl font-semibold text-sm transition"
            >
              Search
            </button>
          </form>

          {/* Results display list */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-zinc-400 font-semibold">Running hybrid search scans...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-20 text-zinc-500 font-semibold italic glass-panel rounded-2xl">
              Enter a search query to scan local index assets.
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400 font-bold px-1">Retrieved {results.length} relevant context chunks:</p>
              {results.map((hit: CitationSource, idx) => {
                let Icon = FileText;
                let cardColor = "border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40";
                if (hit.start_time !== null && hit.start_time > 0) {
                  Icon = Clock;
                  cardColor = "border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40";
                }
                
                const timeMin = hit.start_time !== null ? Math.floor(hit.start_time / 60) : 0;
                const timeSec = hit.start_time !== null ? Math.floor(hit.start_time % 60).toString().padStart(2, '0') : "";

                return (
                  <div
                    key={idx}
                    className={`glass-panel p-5 rounded-2xl border flex flex-col md:flex-row justify-between gap-6 transition ${cardColor}`}
                  >
                    <div className="space-y-3.5 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-zinc-950/45 text-primary border border-glass-border">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-200 line-clamp-1">{hit.file_name}</p>
                          <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Source document</span>
                        </div>
                      </div>

                      <p className="text-sm text-zinc-300 leading-relaxed italic">
                        "{hit.text}"
                      </p>

                      {/* Timeline offsets */}
                      <div className="flex items-center gap-3">
                        {hit.start_time !== null && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                            <Clock className="w-3 h-3" />
                            <span>Timestamp: {timeMin}:{timeSec}</span>
                          </span>
                        )}
                        {hit.page_number !== null && hit.page_number > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            <Layers className="w-3 h-3" />
                            <span>Page {hit.page_number}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions button */}
                    <div className="flex flex-row md:flex-col justify-end items-end gap-3 self-end md:self-center">
                      <a
                        href={`/player/${hit.media_id}${hit.start_time !== null ? `#L${Math.floor(hit.start_time)}` : ""}`}
                        className="p-2.5 rounded-xl border border-glass-border bg-zinc-900/60 hover:bg-primary hover:text-white transition flex items-center gap-1.5 text-xs font-bold text-zinc-300 shadow group"
                      >
                        <span>Open Document</span>
                        <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
