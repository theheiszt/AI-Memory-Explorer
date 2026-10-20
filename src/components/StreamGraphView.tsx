/**
 * Stream Graph View Component (Stages 5 & 6)
 * High-performance, hardware-agnostic 2D Canvas viewport for memory topology exploration.
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  GitBranch,
  Layers,
  Sparkles,
  Search,
  Filter,
  Eye,
  Activity,
  Sliders,
  ChevronRight,
  Info,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import type { NormalizedMemoryRecord, ClusterInfo } from '../types/memory.ts';
import type {
  StreamGraphNode,
  StreamGraphEdge,
  DetailLevel,
  StreamGraphEdgeType,
} from '../types/streamGraph.ts';
import {
  buildStreamGraphFromRecords,
  resolveRecordFromNode,
  computeVirtualReach,
  toggleClusterExpansion,
  toggleMemoryExpansion,
} from '../services/graph/graphBuilder.ts';
import { ForceLayoutEngine } from '../services/graph/forceLayout.ts';
import { getEdgeStyle, renderArrowhead, EXPLICIT_RELATION_COLORS } from '../services/graph/edgeStyling.ts';

export interface StreamGraphViewProps {
  records: NormalizedMemoryRecord[];
  clusters: ClusterInfo[];
  clusterMap: Map<string, number>;
  selectedRecordId: string | null;
  onSelectRecord: (record: NormalizedMemoryRecord) => void;
  searchQuery?: string;
  highlightedIds?: Set<string>;
  initialPositions?: Map<string, [number, number]>;
}

export const StreamGraphView: React.FC<StreamGraphViewProps> = ({
  records,
  clusters,
  clusterMap,
  selectedRecordId,
  onSelectRecord,
  searchQuery = '',
  highlightedIds = new Set(),
  initialPositions,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Layout engine instance ref
  const engineRef = useRef<ForceLayoutEngine>(new ForceLayoutEngine());
  const animationFrameRef = useRef<number | null>(null);

  // Viewport camera state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1.0);

  // Interaction state
  const [hoveredNode, setHoveredNode] = useState<StreamGraphNode | null>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggedNode, setDraggedNode] = useState<StreamGraphNode | null>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Graph control options
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('detailed');
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.70);
  const [activeEdgeTypes, setActiveEdgeTypes] = useState<Set<StreamGraphEdgeType>>(
    new Set(['explicit', 'similarity', 'temporal', 'retrieval', 'cluster'])
  );
  const [expandedClusterIds, setExpandedClusterIds] = useState<Set<number>>(new Set());
  const [expandedMemoryIds, setExpandedMemoryIds] = useState<Set<string>>(new Set());
  const [simStatus, setSimStatus] = useState<string>('Quiescent');

  // Build graph model
  const graphData = useMemo(() => {
    return buildStreamGraphFromRecords(records, {
      clusters,
      clusterMap,
      detailLevel,
      similarityThreshold,
      activeEdgeTypes,
      expandedClusterIds,
      expandedMemoryIds,
      searchQuery,
    });
  }, [
    records,
    clusters,
    clusterMap,
    detailLevel,
    similarityThreshold,
    activeEdgeTypes,
    expandedClusterIds,
    expandedMemoryIds,
    searchQuery,
  ]);

  // Sync graph with physics engine
  useEffect(() => {
    const engine = engineRef.current;
    engine.setGraph(graphData.nodes, graphData.edges, {
      initialPositions,
      warmupTicks: 35,
      preserveExisting: true,
    });
    setSimStatus('Relaxing');
    startLoop();
  }, [graphData]);

  // Coordinate transforms
  const screenToWorld = useCallback(
    (sx: number, sy: number, width: number, height: number): { x: number; y: number } => {
      return {
        x: (sx - width / 2 - pan.x) / zoom,
        y: (sy - height / 2 - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  const worldToScreen = useCallback(
    (wx: number, wy: number, width: number, height: number): { x: number; y: number } => {
      return {
        x: wx * zoom + width / 2 + pan.x,
        y: wy * zoom + height / 2 + pan.y,
      };
    },
    [pan, zoom]
  );

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    // Adjust canvas resolution for high-DPI displays
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#020617'; // slate-950
    ctx.fillRect(0, 0, width, height);

    // Subtle background grid
    ctx.strokeStyle = '#0f172a'; // slate-900
    ctx.lineWidth = 1;
    const gridSize = 60 * zoom;
    const offsetX = (width / 2 + pan.x) % gridSize;
    const offsetY = (height / 2 + pan.y) % gridSize;

    ctx.beginPath();
    for (let x = offsetX; x < width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    const nodes = engineRef.current.getNodes();
    const nodeMap = graphData.nodeMap;

    // Set of IDs directly connected to hovered or selected node
    const connectedNodeIds = new Set<string>();
    const activeFocusNodeId = hoveredNode?.id || (selectedRecordId ? `node_${selectedRecordId}` : null);

    if (activeFocusNodeId) {
      connectedNodeIds.add(activeFocusNodeId);
      for (const edge of graphData.edges) {
        if (edge.source === activeFocusNodeId) connectedNodeIds.add(edge.target);
        if (edge.target === activeFocusNodeId) connectedNodeIds.add(edge.source);
      }
    }

    // 1. Draw Edges
    for (const edge of graphData.edges) {
      const nodeA = nodeMap.get(edge.source);
      const nodeB = nodeMap.get(edge.target);
      if (!nodeA || !nodeB || !nodeA.isVisible || !nodeB.isVisible) continue;

      const p1 = worldToScreen(nodeA.x, nodeA.y, width, height);
      const p2 = worldToScreen(nodeB.x, nodeB.y, width, height);

      // Cull off-screen edges
      if (
        (p1.x < -100 && p2.x < -100) ||
        (p1.x > width + 100 && p2.x > width + 100) ||
        (p1.y < -100 && p2.y < -100) ||
        (p1.y > height + 100 && p2.y > height + 100)
      ) {
        continue;
      }

      const style = getEdgeStyle(edge);
      const isIncidentToFocus = activeFocusNodeId && (edge.source === activeFocusNodeId || edge.target === activeFocusNodeId);
      const isDimmed = activeFocusNodeId && !isIncidentToFocus;

      ctx.save();
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = Math.max(1, style.lineWidth * zoom * (isIncidentToFocus ? 1.6 : 1.0));
      ctx.setLineDash(style.dashPattern.map(d => d * zoom));
      ctx.globalAlpha = isDimmed ? 0.08 : isIncidentToFocus ? 1.0 : style.opacity;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Render arrowhead if directed
      if (style.directed) {
        renderArrowhead(
          ctx,
          p1.x,
          p1.y,
          p2.x,
          p2.y,
          nodeB.radius * zoom,
          style.strokeColor,
          Math.max(6, 8 * zoom)
        );
      }

      ctx.restore();
    }

    // 2. Draw Nodes
    for (const node of nodes) {
      if (!node.isVisible) continue;

      const p = worldToScreen(node.x, node.y, width, height);

      // Cull off-screen nodes
      if (p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) {
        continue;
      }

      const isSelected = selectedRecordId === node.memoryId;
      const isHovered = hoveredNode?.id === node.id;
      const isSearchHit = searchQuery.trim().length > 0 && highlightedIds.has(node.memoryId);
      const isDimmed = activeFocusNodeId && !connectedNodeIds.has(node.id) && !isSelected;

      const r = Math.max(3, node.radius * zoom * (isSelected || isHovered ? 1.35 : 1.0));

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.2 : 1.0;

      // Glow halo for selected / hovered / search-hit
      if (isSelected || isHovered || isSearchHit) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? 'rgba(234, 179, 8, 0.35)' // Gold/amber
          : isHovered
          ? 'rgba(99, 102, 241, 0.35)' // Indigo
          : 'rgba(6, 182, 212, 0.35)'; // Cyan
        ctx.fill();
      }

      // Main Node Body
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Node Border
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.strokeStyle = isSelected
        ? '#fbbf24' // Amber-400
        : isHovered
        ? '#ffffff'
        : node.hasEmbedding
        ? 'rgba(255, 255, 255, 0.25)'
        : 'rgba(239, 68, 68, 0.8)'; // Red dash outline for missing vector

      if (!node.hasEmbedding) {
        ctx.setLineDash([3, 2]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Cluster Hub Center Badge
      if (node.nodeKind === 'cluster') {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(10, Math.floor(10 * zoom))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(node.memberCount || 0), p.x, p.y);
      }

      ctx.restore();

      // 3. Node Labels
      const shouldShowLabel =
        node.nodeKind === 'cluster' ||
        isSelected ||
        isHovered ||
        isSearchHit ||
        zoom > 1.35;

      if (shouldShowLabel && !isDimmed) {
        ctx.save();
        const fontSize = Math.max(10, Math.min(14, Math.floor(11 * zoom)));
        ctx.font = `${node.nodeKind === 'cluster' ? 'bold ' : ''}${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Dark text outline for high contrast
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.85)';
        ctx.strokeText(node.label, p.x, p.y + r + 4);

        ctx.fillStyle = isSelected ? '#fbbf24' : isHovered ? '#ffffff' : '#cbd5e1';
        ctx.fillText(node.label, p.x, p.y + r + 4);
        ctx.restore();
      }
    }

    ctx.restore();
  }, [
    pan,
    zoom,
    graphData,
    selectedRecordId,
    hoveredNode,
    searchQuery,
    highlightedIds,
    worldToScreen,
  ]);

  // Main animation / physics tick loop
  const startLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const loop = () => {
      const active = engineRef.current.tick();
      render();

      if (active) {
        const alpha = engineRef.current.getAlpha();
        setSimStatus(`Relaxing (α=${alpha.toFixed(2)})`);
        animationFrameRef.current = requestAnimationFrame(loop);
      } else {
        setSimStatus('Quiescent');
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  }, [render]);

  useEffect(() => {
    render();
  }, [render]);

  // Stop loop on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Hit-testing utility for nodes
  const hitTestNode = useCallback(
    (clientX: number, clientY: number): StreamGraphNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;

      const nodes = engineRef.current.getNodes();
      // Iterate in reverse so top-drawn nodes take precedence
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        if (!node.isVisible) continue;

        const p = worldToScreen(node.x, node.y, canvas.clientWidth, canvas.clientHeight);
        const dx = sx - p.x;
        const dy = sy - p.y;
        const hitRadius = Math.max(10, node.radius * zoom + 5);

        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          return node;
        }
      }
      return null;
    },
    [worldToScreen, zoom]
  );

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = hitTestNode(e.clientX, e.clientY);
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    if (hit) {
      setDraggedNode(hit);
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const world = screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top,
        canvas.clientWidth,
        canvas.clientHeight
      );
      engineRef.current.pinNode(hit.id, world.x, world.y);
      startLoop();
    } else {
      setIsDraggingCanvas(true);
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (draggedNode) {
      const rect = canvas.getBoundingClientRect();
      const world = screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top,
        canvas.clientWidth,
        canvas.clientHeight
      );
      engineRef.current.pinNode(draggedNode.id, world.x, world.y);
      startLoop();
    } else if (isDraggingCanvas) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
      requestAnimationFrame(render);
    } else {
      // Hover detection
      const hit = hitTestNode(e.clientX, e.clientY);
      if (hit?.id !== hoveredNode?.id) {
        setHoveredNode(hit);
        requestAnimationFrame(render);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNode) {
      engineRef.current.unpinNode(draggedNode.id);
      setDraggedNode(null);
      startLoop();
    }
    setIsDraggingCanvas(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = hitTestNode(e.clientX, e.clientY);
    if (hit) {
      if (hit.nodeKind === 'memory') {
        const resolved = resolveRecordFromNode(hit, records);
        if (resolved) {
          onSelectRecord(resolved);
        }
      } else if (hit.nodeKind === 'cluster' && hit.clusterId !== undefined) {
        setExpandedClusterIds(prev => toggleClusterExpansion(hit.clusterId!, prev));
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = hitTestNode(e.clientX, e.clientY);
    if (hit) {
      if (hit.nodeKind === 'cluster' && hit.clusterId !== undefined) {
        setExpandedClusterIds(prev => toggleClusterExpansion(hit.clusterId!, prev));
      } else if (hit.nodeKind === 'memory') {
        setExpandedMemoryIds(prev => toggleMemoryExpansion(hit.memoryId, prev));
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(0.15, Math.min(6.0, zoom * zoomFactor));

    // Zoom centered at cursor position
    const wx = (mouseX - canvas.clientWidth / 2 - pan.x) / zoom;
    const wy = (mouseY - canvas.clientHeight / 2 - pan.y) / zoom;

    const newPanX = mouseX - canvas.clientWidth / 2 - wx * newZoom;
    const newPanY = mouseY - canvas.clientHeight / 2 - wy * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
    requestAnimationFrame(render);
  };

  // Camera Actions
  const handleFitToView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const visibleNodes = engineRef.current.getNodes().filter(n => n.isVisible);
    if (visibleNodes.length === 0) {
      setPan({ x: 0, y: 0 });
      setZoom(1.0);
      return;
    }

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (const n of visibleNodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }

    const graphWidth = Math.max(100, maxX - minX);
    const graphHeight = Math.max(100, maxY - minY);
    const padding = 120;

    const scaleX = (canvas.clientWidth - padding) / graphWidth;
    const scaleY = (canvas.clientHeight - padding) / graphHeight;
    const targetZoom = Math.max(0.2, Math.min(2.5, Math.min(scaleX, scaleY)));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(targetZoom);
    setPan({
      x: -centerX * targetZoom,
      y: -centerY * targetZoom,
    });
    requestAnimationFrame(render);
  };

  const handleReheat = () => {
    engineRef.current.reheat(0.4);
    startLoop();
  };

  const toggleEdgeType = (type: StreamGraphEdgeType) => {
    setActiveEdgeTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Virtual reach metrics for currently selected record
  const selectedReach = useMemo(() => {
    if (!selectedRecordId) return null;
    return computeVirtualReach(selectedRecordId, records, similarityThreshold);
  }, [selectedRecordId, records, similarityThreshold]);

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* Top HUD Controls Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left Toolbar: Detail Level & Edge Filters */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/90 backdrop-blur border border-slate-800 shadow-xl pointer-events-auto">
          {/* Detail Level Selector */}
          <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800/80 text-[11px] font-medium text-slate-300">
            {(['overview', 'balanced', 'detailed', 'maximum'] as DetailLevel[]).map(level => (
              <button
                key={level}
                onClick={() => setDetailLevel(level)}
                className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                  detailLevel === level
                    ? 'bg-indigo-600 text-white font-semibold shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Edge Filter Badges */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleEdgeType('explicit')}
              title="Toggle Explicit Source Relationships"
              className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-colors border ${
                activeEdgeTypes.has('explicit')
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-950/40 border-slate-800 text-slate-500 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Explicit ({graphData.stats.explicitEdgesCount})
            </button>

            <button
              onClick={() => toggleEdgeType('similarity')}
              title="Toggle Cosine Similarity Links"
              className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-colors border ${
                activeEdgeTypes.has('similarity')
                  ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                  : 'bg-slate-950/40 border-slate-800 text-slate-500 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              Similarity ({graphData.stats.similarityEdgesCount})
            </button>

            <button
              onClick={() => toggleEdgeType('temporal')}
              title="Toggle Sequential Temporal Edges"
              className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-colors border ${
                activeEdgeTypes.has('temporal')
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                  : 'bg-slate-950/40 border-slate-800 text-slate-500 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              Temporal ({graphData.stats.temporalEdgesCount})
            </button>

            <button
              onClick={() => toggleEdgeType('retrieval')}
              title="Toggle Agent Retrieval Co-occurrence Edges"
              className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-colors border ${
                activeEdgeTypes.has('retrieval')
                  ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                  : 'bg-slate-950/40 border-slate-800 text-slate-500 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              Retrieval ({graphData.stats.retrievalEdgesCount})
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Similarity Threshold Slider */}
          <div className="flex items-center gap-2 px-2 text-[11px] text-slate-300">
            <span className="text-slate-400">Sim:</span>
            <input
              type="range"
              min="0.50"
              max="0.95"
              step="0.05"
              value={similarityThreshold}
              onChange={e => setSimilarityThreshold(parseFloat(e.target.value))}
              className="w-16 accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-indigo-400 font-semibold w-7">
              {similarityThreshold.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Right Toolbar: Viewport & Layout Actions */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/90 backdrop-blur border border-slate-800 shadow-xl pointer-events-auto">
          <button
            onClick={() => {
              setZoom(z => Math.min(6.0, z * 1.25));
              requestAnimationFrame(render);
            }}
            title="Zoom In"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setZoom(z => Math.max(0.15, z * 0.8));
              requestAnimationFrame(render);
            }}
            title="Zoom Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleFitToView}
            title="Fit Graph to View"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleReheat}
            title="Reheat Simulation (Relax Layout)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (expandedClusterIds.size > 0) {
                setExpandedClusterIds(new Set());
              } else {
                setExpandedClusterIds(new Set(clusters.map(c => c.id)));
              }
            }}
            title={expandedClusterIds.size > 0 ? 'Collapse All Clusters' : 'Expand All Clusters'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Bottom Floating Stats & Quiescence Indicator */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        {/* Selected Record Reach Card */}
        {selectedReach && selectedRecordId ? (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-900/90 backdrop-blur border border-amber-500/30 text-xs shadow-2xl pointer-events-auto">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <Share2 className="w-4 h-4" />
              <span>Selected Node Reach:</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">
                1-Hop: {selectedReach.directCount}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400">
                2-Hop: {selectedReach.secondHopCount}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                Total Reach: {selectedReach.totalReach}
              </span>
            </div>
            <button
              onClick={() => setExpandedMemoryIds(prev => toggleMemoryExpansion(selectedRecordId, prev))}
              className="ml-1 px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[10px] transition-colors"
            >
              {expandedMemoryIds.has(selectedRecordId) ? 'Collapse Neighbors' : 'Expand Neighbors'}
            </button>
          </div>
        ) : (
          <div />
        )}

        {/* Live Simulation & Topology Health Badge */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur border border-slate-800 text-[11px] text-slate-400 shadow-xl pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                simStatus === 'Quiescent' ? 'bg-emerald-400' : 'bg-cyan-400 animate-pulse'
              }`}
            />
            <span className="font-mono text-slate-300">{simStatus}</span>
          </div>
          <span className="text-slate-700">•</span>
          <span>
            <strong className="text-slate-200">{graphData.stats.visibleMemoryNodes}</strong> nodes
          </span>
          <span className="text-slate-700">•</span>
          <span>
            <strong className="text-slate-200">{graphData.stats.displayedEdges}</strong> edges
          </span>
          <span className="text-slate-700">•</span>
          <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};
