"use client";

import { useEffect, useState, useMemo } from "react";
import { ReactFlow, Controls, Background, useNodesState, useEdgesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Network, Loader2, Info } from "lucide-react";
import { api } from "@/services/api";

// Custom node styling layout based on entity type
const CustomNode = ({ data }: { data: any }) => {
  let colorClass = "border-purple-500 bg-purple-500/10 text-purple-400";
  if (data.type.toLowerCase() === "person") colorClass = "border-rose-500 bg-rose-500/10 text-rose-300";
  else if (data.type.toLowerCase() === "company" || data.type.toLowerCase() === "organization") colorClass = "border-blue-500 bg-blue-500/10 text-blue-300";
  else if (data.type.toLowerCase() === "technology") colorClass = "border-teal-500 bg-teal-500/10 text-teal-300";
  else if (data.type.toLowerCase() === "project") colorClass = "border-amber-500 bg-amber-500/10 text-amber-300";

  return (
    <div className={`px-4 py-3 rounded-xl border-2 backdrop-blur shadow-2xl min-w-[120px] text-center ${colorClass}`}>
      <p className="text-xs font-bold font-mono tracking-wide">{data.label}</p>
      <span className="text-[8px] uppercase tracking-wider opacity-60 font-semibold">{data.type}</span>
    </div>
  );
};

export default function KnowledgeGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);

  const nodeTypes = useMemo(() => ({ customNode: CustomNode }), []);

  useEffect(() => {
    loadGraphData();
  }, []);

  const loadGraphData = async () => {
    try {
      const data = await api.getKnowledgeGraph();
      // Ensure nodes have types mapped
      const mappedNodes = data.nodes.map(n => ({
        ...n,
        type: "customNode" // override to custom node component
      }));
      setNodes(mappedNodes as any);
      setEdges(data.edges as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = (event: any, node: any) => {
    setSelectedEntity({
      name: node.data.label,
      type: node.data.type,
      description: node.data.description
    });
  };

  return (
    <div className="space-y-6 h-[85vh] flex flex-col justify-between">
      {/* Header */}
      <div className="border-b border-glass-border pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">Knowledge Graph</h2>
          <p className="text-zinc-400 mt-1.5 font-medium">Interactive network visualization of AI-extracted entities and their relationships.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-zinc-400 font-semibold">Generating knowledge map network...</p>
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 glass-panel rounded-2xl">
          <Network className="w-16 h-16 text-zinc-600 mb-4 animate-pulse" />
          <h3 className="font-bold text-zinc-300">No entities or relationships registered</h3>
          <p className="text-xs text-zinc-500 mt-1">Process audio/video files or documents via the Dashboard to generate entities.</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
          
          {/* React Flow Canvas (3 cols) */}
          <div className="lg:col-span-3 glass-panel rounded-2xl overflow-hidden border border-glass-border relative h-full bg-zinc-950/40">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              fitView
              className="w-full h-full"
            >
              <Controls className="bg-zinc-900 border-glass-border text-zinc-300 rounded" />
              <Background color="#52525b" gap={16} size={1} />
            </ReactFlow>
          </div>

          {/* Info Side Inspector (1 col) */}
          <div className="lg:col-span-1 glass-panel p-5 rounded-2xl flex flex-col gap-4 overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-glass-border pb-3">
              <Info className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-zinc-200 text-sm">Entity Details</h3>
            </div>

            {selectedEntity ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-bold text-white font-mono">{selectedEntity.name}</h4>
                  <span className="text-[10px] uppercase font-bold text-primary px-2.5 py-0.5 rounded bg-primary/10 border border-primary/20 mt-1.5 inline-block">
                    {selectedEntity.type}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-950/30 border border-glass-border p-4 rounded-xl">
                  {selectedEntity.description || "No description extracted for this entity."}
                </p>
              </div>
            ) : (
              <div className="text-center py-20 text-zinc-500 text-xs">
                Click on any entity node inside the graph to inspect its background details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
