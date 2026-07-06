"use client";

import { useEffect, useState, useRef } from "react";
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  BookOpen, 
  FileText, 
  ChevronRight, 
  CheckSquare, 
  Square,
  Clock,
  Layers,
  Search
} from "lucide-react";
import { api, MediaAsset, CitationSource } from "@/services/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: CitationSource[];
}

export default function ChatView() {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I am your Local Media Brain. Select files on the sidebar and ask me any questions. I will search across transcripts and documents locally, providing answers with precise citations, timestamps, and pages."
    }
  ]);
  
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeCitation, setActiveCitation] = useState<CitationSource | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q");
      if (q) {
        setInput(q);
      }
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadMedia = async () => {
    try {
      const data = await api.listMedia("completed");
      setMedia(data);
      // Select all by default
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userQuery = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userQuery }]);
    setLoading(true);

    try {
      const response = await api.askQuestion(userQuery, selectedMediaIds);
      setMessages(prev => [
        ...prev, 
        { 
          role: "assistant", 
          content: response.answer, 
          citations: response.citations 
        }
      ]);
    } catch (e) {
      setMessages(prev => [
        ...prev, 
        { 
          role: "assistant", 
          content: "Sorry, I encountered an error communicating with the Ollama model. Ensure Ollama is running and has the model pulled." 
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to replace citations text (e.g. "[1]", "[2]") with clickable chips
  const renderMessageContent = (text: string, citations?: CitationSource[]) => {
    if (!citations || citations.length === 0) return <p className="whitespace-pre-wrap">{text}</p>;

    // Regular expression to match citation tags like [1] or [2]
    const regex = /\[(\d+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      const citationNumber = match[1];

      // Add text before citation
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      // Check if citation exists in returned references
      const citation = citations[Number(citationNumber) - 1];
      if (citation) {
        parts.push(
          <button
            key={matchIndex}
            onClick={() => setActiveCitation(citation)}
            className="inline-flex items-center justify-center bg-primary/20 hover:bg-primary/30 border border-primary/35 text-primary text-[11px] font-bold px-1.5 py-0.5 rounded mx-0.5 transition cursor-pointer"
            title={`Source: ${citation.file_name}`}
          >
            {citationNumber}
          </button>
        );
      } else {
        parts.push(match[0]);
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return <div className="whitespace-pre-wrap leading-relaxed">{parts}</div>;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[80vh]">
      
      {/* Sidebar: Sources selection checkbox list (3 cols) */}
      <div className="lg:col-span-3 glass-panel p-5 rounded-2xl flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 border-b border-glass-border pb-4 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-zinc-200">Chat Sources</h3>
        </div>

        {/* Search & Selection Options */}
        <div className="space-y-3 mb-4">
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
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {filteredMedia.length === 0 ? (
            <p className="text-xs text-zinc-500 italic text-center py-10">No matching assets found.</p>
          ) : (
            filteredMedia.map((m) => {
              const isSelected = selectedMediaIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleMediaSelection(m.id)}
                  className={`w-full flex items-start gap-2.5 p-3 rounded-xl border text-left transition ${
                    isSelected 
                      ? "bg-zinc-800/40 border-primary/20 text-zinc-200" 
                      : "bg-zinc-950/20 border-glass-border text-zinc-500"
                  }`}
                >
                  <div className="mt-0.5">
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-bold truncate">{m.file_name}</p>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">{m.mime_type}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Column: Chat stream (6 cols) */}
      <div className="lg:col-span-6 glass-panel rounded-2xl flex flex-col h-full overflow-hidden">
        {/* Chat Header */}
        <div className="p-5 border-b border-glass-border flex items-center gap-3 bg-zinc-950/15">
          <MessageSquare className="w-5 h-5 text-primary animate-pulse" />
          <h3 className="font-bold text-zinc-200">Conversation Pane</h3>
        </div>

        {/* Message scroll list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div 
                key={idx}
                className={`flex gap-3 max-w-[85%] ${isUser ? "ml-auto flex-row-reverse" : ""}`}
              >
                <div className={`p-4 rounded-2xl text-sm leading-relaxed border ${
                  isUser 
                    ? "bg-primary text-white border-primary/10 rounded-tr-none shadow-md shadow-primary/5" 
                    : "glass-panel bg-zinc-900/40 border-glass-border rounded-tl-none text-zinc-200"
                }`}>
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    renderMessageContent(msg.content, msg.citations)
                  )}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex items-center gap-3">
              <div className="glass-panel p-4 rounded-2xl rounded-tl-none border border-glass-border bg-zinc-900/40 text-zinc-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs font-medium">Local AI thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input box form */}
        <form onSubmit={handleSend} className="p-4 border-t border-glass-border bg-zinc-950/20 flex gap-3">
          <input
            type="text"
            placeholder="Ask anything about the meetings or documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 glass-input text-sm"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="glow-btn p-3 rounded-xl hover:scale-[1.03] transition flex items-center justify-center disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Right Column: Active Citation Inspector (3 cols) */}
      <div className="lg:col-span-3 glass-panel p-5 rounded-2xl flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 border-b border-glass-border pb-4 mb-4">
          <ChevronRight className="w-5 h-5 text-primary animate-bounce-horizontal" />
          <h3 className="font-bold text-zinc-200">Citation Inspector</h3>
        </div>

        {activeCitation ? (
          <div className="flex-1 flex flex-col justify-between overflow-y-auto space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold">
                <FileText className="w-4 h-4 text-zinc-500" />
                <span className="truncate">{activeCitation.file_name}</span>
              </div>

              {activeCitation.start_time !== null && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/25 rounded-md text-xs font-bold text-primary">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Offset: {Math.floor(activeCitation.start_time / 60)}:{(Math.floor(activeCitation.start_time % 60)).toString().padStart(2, '0')}</span>
                </div>
              )}

              {activeCitation.page_number !== null && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/25 rounded-md text-xs font-bold text-blue-400">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Page {activeCitation.page_number}</span>
                </div>
              )}

              <div className="bg-zinc-950/40 p-4 border border-glass-border rounded-xl text-xs leading-relaxed text-zinc-300 italic">
                "{activeCitation.text}"
              </div>
            </div>

            {/* Link to media viewer directly */}
            <a
              href={`/player/${activeCitation.media_id}`}
              className="glow-btn py-3 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2 shadow"
            >
              <span>Jump to Source File</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <BookOpen className="w-10 h-10 text-zinc-600 mb-2.5" />
            <p className="text-xs text-zinc-500 leading-normal">
              Click on a citation bracket number (like <span className="text-primary font-bold">[1]</span>) inside an AI response to inspect its exact source block.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
