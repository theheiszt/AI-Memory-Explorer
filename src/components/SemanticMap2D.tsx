import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Share2,
  Tag,
  Info,
  Eye,
  Layers,
  Sparkles,
  AlertTriangle,
  Sliders,
  Cpu,
  GitBranch,
} from 'lucide-react';
import type {
  ProjectionPoint,
  ClusterInfo,
  NormalizedMemoryRecord,
  ProjectionAlgorithm,
  ConnectionMode,
  SubMemoryNode,
  MemoryConnection,
} from '../types/memory.ts';
import {
  calculateGlobalConnections,
  computeVirtualReach,
} from '../services/adapters/memoryExpansionEngine.ts';

interface SemanticMap2DProps {
  points: ProjectionPoint[];
  clusters: ClusterInfo[];
  selectedRecordId: string | null;
  onSelectRecord: (record: NormalizedMemoryRecord) => void;
  highlightedIds: Set<string>;
  algorithm: ProjectionAlgorithm;
  onAlgorithmChange: (algo: ProjectionAlgorithm) => void;
  colorBy: 'cluster' | 'type' | 'source';
  onChangeColorBy: (mode: 'cluster' | 'type' | 'source') => void;
  densityScale?: number;
  onDensityScaleChange?: (scale: number) => void;
  connectionMode?: ConnectionMode;
  onChangeConnectionMode?: (mode: ConnectionMode) => void;
  expandedRecordIds?: Set<string>;
  expandedSubMemories?: Map<string, SubMemoryNode[]>;
  onToggleExpandRecord?: (recordId: string) => void;
  onExpandCluster?: (clusterId: number) => void;
  onCollapseAll?: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  episodic: '#3b82f6', // blue
  semantic: '#10b981', // emerald
  procedural: '#f59e0b', // amber
  working: '#ec4899', // pink
  profile: '#8b5cf6', // purple
  system: '#64748b', // slate
  custom: '#06b6d4', // cyan
};

export const SemanticMap2D: React.FC<SemanticMap2DProps> = ({
  points,
  clusters,
  selectedRecordId,
  onSelectRecord,
  highlightedIds,
  algorithm,
  onAlgorithmChange,
  colorBy,
  onChangeColorBy,
  densityScale = 1.0,
  onDensityScaleChange,
  connectionMode = 'all',
  onChangeConnectionMode,
  expandedRecordIds = new Set<string>(),
  expandedSubMemories = new Map<string, SubMemoryNode[]>(),
  onToggleExpandRecord,
  onExpandCluster,
  onCollapseAll,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<ProjectionPoint | null>(null);
  const [hoveredSubNode, setHoveredSubNode] = useState<SubMemoryNode | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [pointScale, setPointScale] = useState(1.0);
  const [activeConnMode, setActiveConnMode] = useState<ConnectionMode>(connectionMode);

  useEffect(() => {
    setActiveConnMode(connectionMode);
  }, [connectionMode]);

  const handleConnModeChange = (mode: ConnectionMode) => {
    setActiveConnMode(mode);
    onChangeConnectionMode?.(mode);
  };

  // Compute bounding box for projection
  const { minX, maxX, minY, maxY } = useMemo(() => {
    if (points.length === 0) return { minX: -100, maxX: 100, minY: -100, maxY: 100 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY };
  }, [points]);

  // Transform coordinates from projected space to canvas space
  const projectX = useCallback(
    (x: number, width: number) => {
      const range = (maxX - minX) || 1;
      return ((x - minX) / range - 0.5) * (width * 0.82) + width / 2;
    },
    [minX, maxX]
  );

  const projectY = useCallback(
    (y: number, height: number) => {
      const range = (maxY - minY) || 1;
      return ((y - minY) / range - 0.5) * (height * 0.82) + height / 2;
    },
    [minY, maxY]
  );

  // Compute connections across all memories
  const connections = useMemo(() => {
    return calculateGlobalConnections(points, activeConnMode, {
      maxNeighbors: 3,
      spatialThreshold: 65 * densityScale,
      expandedRecordIds,
      expandedMap: expandedSubMemories,
    });
  }, [points, activeConnMode, densityScale, expandedRecordIds, expandedSubMemories]);

  // Virtual reach metrics
  const reachMetrics = useMemo(() => {
    return computeVirtualReach(points.length, expandedRecordIds.size, 100);
  }, [points.length, expandedRecordIds.size]);

  // Color lookup helper
  const getPointColor = useCallback(
    (point: ProjectionPoint) => {
      if (colorBy === 'cluster') {
        const c = clusters.find(cl => cl.id === point.clusterId);
        return c?.color || '#94a3b8';
      }
      if (colorBy === 'type') {
        const type = point.record.memoryType || 'semantic';
        return TYPE_COLORS[type] || '#94a3b8';
      }
      return '#6366f1';
    },
    [colorBy, clusters]
  );

  // Spatial Grid Index for fast O(1) hover inspection among 10,000 points
  const spatialIndex = useMemo(() => {
    const cellSize = 25;
    const grid = new Map<string, ProjectionPoint[]>();

    return {
      clear() {
        grid.clear();
      },
      populate(pts: ProjectionPoint[], w: number, h: number) {
        grid.clear();
        for (const p of pts) {
          const cx = projectX(p.x, w);
          const cy = projectY(p.y, h);
          const cellKey = `${Math.floor(cx / cellSize)}_${Math.floor(cy / cellSize)}`;
          let list = grid.get(cellKey);
          if (!list) {
            list = [];
            grid.set(cellKey, list);
          }
          list.push(p);
        }
      },
      findNearest(screenX: number, screenY: number, w: number, h: number, maxDist: number = 20): ProjectionPoint | null {
        const canvasX = (screenX - pan.x) / zoom;
        const canvasY = (screenY - pan.y) / zoom;

        const cellX = Math.floor(canvasX / cellSize);
        const cellY = Math.floor(canvasY / cellSize);

        let nearest: ProjectionPoint | null = null;
        let minDistSq = maxDist * maxDist;

        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const list = grid.get(`${cellX + dx}_${cellY + dy}`);
            if (list) {
              for (const p of list) {
                const px = projectX(p.x, w);
                const py = projectY(p.y, h);
                const dSq = (canvasX - px) * (canvasX - px) + (canvasY - py) * (canvasY - py);
                if (dSq < minDistSq) {
                  minDistSq = dSq;
                  nearest = p;
                }
              }
            }
          }
        }
        return nearest;
      },
    };
  }, [projectX, projectY, pan, zoom]);

  // Compute cluster centroids
  const clusterCentroids = useMemo(() => {
    if (!showLabels || clusters.length === 0) return [];
    const centroids: Array<{ id: number; cx: number; cy: number; count: number; color: string }> = [];

    clusters.forEach(c => {
      const clusterPoints = points.filter(p => p.clusterId === c.id);
      if (clusterPoints.length > 0) {
        const sumX = clusterPoints.reduce((acc, p) => acc + p.x, 0);
        const sumY = clusterPoints.reduce((acc, p) => acc + p.y, 0);
        centroids.push({
          id: c.id,
          cx: sumX / clusterPoints.length,
          cy: sumY / clusterPoints.length,
          count: clusterPoints.length,
          color: c.color,
        });
      }
    });

    return centroids;
  }, [clusters, points, showLabels]);

  // Selected point
  const selectedPoint = useMemo(() => {
    return points.find(p => p.id === selectedRecordId) || null;
  }, [points, selectedRecordId]);

  const isSelectedExpanded = selectedRecordId ? expandedRecordIds.has(selectedRecordId) : false;

  // High-performance Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    spatialIndex.populate(points, width, height);

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, width, height);

    // Apply pan & zoom
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Background grid
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1 / zoom;
    const gridSize = 40;
    const startX = Math.floor((-pan.x / zoom) / gridSize) * gridSize;
    const endX = startX + (width / zoom) + gridSize * 2;
    const startY = Math.floor((-pan.y / zoom) / gridSize) * gridSize;
    const endY = startY + (height / zoom) + gridSize * 2;

    ctx.beginPath();
    for (let gx = startX; gx <= endX; gx += gridSize) {
      ctx.moveTo(gx, startY);
      ctx.lineTo(gx, endY);
    }
    for (let gy = startY; gy <= endY; gy += gridSize) {
      ctx.moveTo(startX, gy);
      ctx.lineTo(endX, gy);
    }
    ctx.stroke();

    // Map point coordinates
    const pointPosMap = new Map<string, { cx: number; cy: number }>();
    points.forEach(p => {
      pointPosMap.set(p.id, {
        cx: projectX(p.x, width),
        cy: projectY(p.y, height),
      });
    });

    // 1. Draw ALL Synaptic Connection Lines in Fast Batch
    if (activeConnMode !== 'off' && connections.length > 0) {
      // Split connections by type for distinct styling
      const explicitEdges: MemoryConnection[] = [];
      const semanticEdges: MemoryConnection[] = [];
      const subEdges: MemoryConnection[] = [];

      connections.forEach(c => {
        if (c.connectionType === 'sub_memory' || c.connectionType === 'temporal') {
          subEdges.push(c);
        } else if (c.connectionType === 'explicit') {
          explicitEdges.push(c);
        } else {
          semanticEdges.push(c);
        }
      });

      // Draw Semantic intra-cluster webs
      if (semanticEdges.length > 0) {
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.16)';
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        semanticEdges.forEach(c => {
          const p1 = pointPosMap.get(c.sourceId);
          const p2 = pointPosMap.get(c.targetId);
          if (p1 && p2) {
            ctx.moveTo(p1.cx, p1.cy);
            ctx.lineTo(p2.cx, p2.cy);
          }
        });
        ctx.stroke();
      }

      // Draw Explicit & Causal links
      if (explicitEdges.length > 0) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1.4 / zoom;
        ctx.beginPath();
        explicitEdges.forEach(c => {
          const p1 = pointPosMap.get(c.sourceId);
          const p2 = pointPosMap.get(c.targetId);
          if (p1 && p2) {
            ctx.moveTo(p1.cx, p1.cy);
            ctx.lineTo(p2.cx, p2.cy);
          }
        });
        ctx.stroke();
      }

      // Draw Sub-memory rays & temporal sequence lines
      if (subEdges.length > 0) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1.2 / zoom;
        ctx.beginPath();
        subEdges.forEach(c => {
          const p1 = pointPosMap.get(c.sourceId);
          const p2 = pointPosMap.get(c.targetId);
          if (p1 && p2) {
            ctx.moveTo(p1.cx, p1.cy);
            ctx.lineTo(p2.cx, p2.cy);
          }
        });
        ctx.stroke();
      }
    }

    // 2. Render Base Memory Vectors
    const baseRadius = (points.length > 5000 ? 1.6 : points.length > 1500 ? 2.2 : 3.0) * pointScale;

    // Fast batch drawing of unhighlighted points grouped by color
    const colorGroups = new Map<string, Array<{ cx: number; cy: number }>>();
    points.forEach(p => {
      const pos = pointPosMap.get(p.id);
      if (!pos) return;
      const col = getPointColor(p);
      let grp = colorGroups.get(col);
      if (!grp) {
        grp = [];
        colorGroups.set(col, grp);
      }
      grp.push(pos);
    });

    colorGroups.forEach((coords, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      coords.forEach(({ cx, cy }) => {
        ctx.moveTo(cx + baseRadius, cy);
        ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      });
      ctx.fill();
    });

    // 3. Render Expanded Sub-Memories (Micro-satellites around parent)
    if (expandedRecordIds.size > 0 && expandedSubMemories) {
      expandedRecordIds.forEach(parentId => {
        const parentPos = pointPosMap.get(parentId);
        const subNodes = expandedSubMemories.get(parentId);
        if (parentPos && subNodes) {
          // Parent glow ring
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5 / zoom;
          ctx.beginPath();
          ctx.arc(parentPos.cx, parentPos.cy, baseRadius * 2.8, 0, Math.PI * 2);
          ctx.stroke();

          // Satellite sub-nodes
          subNodes.forEach(sub => {
            const sx = parentPos.cx + sub.relativeOffset[0] * 1.8;
            const sy = parentPos.cy + sub.relativeOffset[1] * 1.8;
            pointPosMap.set(sub.id, { cx: sx, cy: sy });

            // Ray to parent
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
            ctx.lineWidth = 1 / zoom;
            ctx.beginPath();
            ctx.moveTo(parentPos.cx, parentPos.cy);
            ctx.lineTo(sx, sy);
            ctx.stroke();

            // Satellite node
            ctx.fillStyle = sub.subType === 'causal_step' ? '#f59e0b' : '#38bdf8';
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(1.8, baseRadius * 0.75), 0, Math.PI * 2);
            ctx.fill();
          });
        }
      });
    }

    // 4. Highlighted and Selected Points (Prominent rendering)
    if (selectedRecordId) {
      const selPos = pointPosMap.get(selectedRecordId);
      if (selPos) {
        // Glowing halo
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5 / zoom;
        ctx.beginPath();
        ctx.arc(selPos.cx, selPos.cy, baseRadius + 4 / zoom, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(selPos.cx, selPos.cy, baseRadius + 1 / zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Cluster Labels & Counts
    if (showLabels) {
      clusterCentroids.forEach(c => {
        const cx = projectX(c.cx, width);
        const cy = projectY(c.cy, height);
        const info = clusters.find(cl => cl.id === c.id);
        const labelText = info?.label || `Cluster ${c.id}`;

        ctx.font = '600 11px system-ui, -apple-system, sans-serif';
        const metrics = ctx.measureText(labelText);
        const bgW = metrics.width + 16;
        const bgH = 20;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 1.2 / zoom;
        ctx.beginPath();
        ctx.roundRect(cx - bgW / 2, cy - bgH / 2, bgW, bgH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, cx, cy);
      });
    }

    ctx.restore();
    ctx.restore();
  }, [
    points,
    clusters,
    colorBy,
    densityScale,
    pointScale,
    zoom,
    pan,
    selectedRecordId,
    activeConnMode,
    connections,
    expandedRecordIds,
    expandedSubMemories,
    showLabels,
    projectX,
    projectY,
    getPointColor,
    clusterCentroids,
    spatialIndex,
  ]);

  // Mouse handlers for pan & zoom & selection
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const nearest = spatialIndex.findNearest(mouseX, mouseY, rect.width, rect.height, 16);
    setHoveredPoint(nearest);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const nearest = spatialIndex.findNearest(mouseX, mouseY, rect.width, rect.height, 18);
    if (nearest) {
      onSelectRecord(nearest.record);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(0.2, Math.min(15, zoom * zoomFactor));

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setPan({
      x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full bg-slate-950 overflow-hidden select-none"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      />

      {/* Top Left: Graph Stats & Virtual Reach Telemetry */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg px-3 py-2 text-xs shadow-xl flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="font-semibold text-slate-200">2D Manifold</span>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <span className="font-mono text-cyan-400 font-bold">
            {points.length.toLocaleString()} Base Vectors
          </span>
          <div className="h-3 w-px bg-slate-800" />
          <span className="font-mono text-indigo-400 font-bold flex items-center gap-1" title="Virtual capacity via hierarchical LOD expansion">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>{(reachMetrics.totalVirtualReach).toLocaleString()} Virtual Reach</span>
          </span>
          <div className="h-3 w-px bg-slate-800" />
          <span className="font-mono text-emerald-400 text-[11px] flex items-center gap-1">
            <Share2 className="w-3 h-3 text-emerald-400" />
            <span>{connections.length.toLocaleString()} Active Synapses</span>
          </span>
        </div>

        {/* Expanded memories notice */}
        {expandedRecordIds.size > 0 && (
          <div className="bg-indigo-950/90 backdrop-blur border border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs text-indigo-200 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>
                <strong>{expandedRecordIds.size}</strong> Memories Expanded into <strong>{reachMetrics.materializedSubCount}</strong> Micro-Vectors
              </span>
            </div>
            <button
              onClick={onCollapseAll}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900 hover:bg-indigo-800 text-indigo-100 border border-indigo-700/60 transition-colors"
            >
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Top Right: View Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 p-1.5 rounded-lg shadow-xl">
        <button
          onClick={() => setZoom(z => Math.min(15, z * 1.25))}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.2, z * 0.8))}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
          title="Reset View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="h-4 w-px bg-slate-800 my-0.5" />
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`p-1.5 rounded transition-colors ${
            showLabels
              ? 'text-cyan-400 bg-cyan-950/80 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
          }`}
          title="Toggle Cluster Labels"
        >
          <Tag className="w-4 h-4" />
        </button>
      </div>

      {/* Hover Tooltip */}
      {hoveredPoint && (
        <div className="absolute top-16 left-4 z-10 bg-slate-900/95 backdrop-blur border border-cyan-500/40 rounded-lg p-2.5 text-xs text-slate-200 max-w-xs shadow-2xl pointer-events-none">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40 uppercase font-semibold">
              {hoveredPoint.record.memoryType || 'semantic'}
            </span>
            <span className="text-[11px] font-mono text-slate-400 truncate">
              {hoveredPoint.id}
            </span>
          </div>
          <p className="line-clamp-2 text-slate-300 font-sans leading-snug">
            {hoveredPoint.record.content}
          </p>
          <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Cluster #{hoveredPoint.clusterId}</span>
            <span className="text-indigo-400 font-semibold">100x Virtual Reach</span>
          </div>
        </div>
      )}

      {/* Bottom Control Dock: Connections Controller, Density Scale & Memory Expansion */}
      <div className="absolute bottom-4 inset-x-4 z-10 flex flex-col items-center pointer-events-none">
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur border border-slate-800 rounded-xl shadow-2xl p-2.5 max-w-4xl w-full flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Connection Mode Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400 font-semibold flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Connections:</span>
              </span>
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                {(
                  [
                    { id: 'all', label: 'All Synapses' },
                    { id: 'explicit', label: 'Explicit & Causal' },
                    { id: 'cluster', label: 'Cluster Web' },
                    { id: 'focused', label: 'Focused' },
                    { id: 'off', label: 'Off' },
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleConnModeChange(opt.id)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      activeConnMode === opt.id
                        ? 'bg-emerald-600 text-white font-semibold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Density Scale & Expand Action */}
            <div className="flex items-center gap-3 flex-wrap">
              {onDensityScaleChange && (
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-slate-400 text-[11px]">Density Scale:</span>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.05"
                    value={densityScale}
                    onChange={e => onDensityScaleChange(parseFloat(e.target.value))}
                    className="w-20 sm:w-28 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-400"
                    title="Scale cluster density & spatial dispersion"
                  />
                  <span className="font-mono text-cyan-400 text-[11px] w-8">
                    {densityScale.toFixed(2)}x
                  </span>
                </div>
              )}

              {/* Expand Selected Memory Button */}
              {selectedPoint && onToggleExpandRecord && (
                <button
                  onClick={() => onToggleExpandRecord(selectedPoint.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow ${
                    isSelectedExpanded
                      ? 'bg-amber-600/90 hover:bg-amber-500 text-white border border-amber-400/50'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/50'
                  }`}
                  title="Expand memory into constituent sub-vectors (reaching 100k - 1M virtual space)"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>
                    {isSelectedExpanded ? 'Collapse Sub-Manifold' : '⚡ Expand Memory (100x Reach)'}
                  </span>
                </button>
              )}

              {/* Expand Cluster Button */}
              {selectedPoint && onExpandCluster && (
                <button
                  onClick={() => onExpandCluster(selectedPoint.clusterId)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
                  title="Expand all memory vectors in this cluster"
                >
                  Expand Cluster #{selectedPoint.clusterId}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
