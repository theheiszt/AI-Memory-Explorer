import React from 'react';
import {
  Brain,
  Layers,
  Box,
  Table,
  History,
  Sparkles,
  Download,
  PlusCircle,
  Database,
  RefreshCw,
  Info,
  Settings,
} from 'lucide-react';
import { SourceConfig } from '../types/memory.ts';

interface HeaderProps {
  sources: SourceConfig[];
  activeSourceId: string;
  onSelectSource: (sourceId: string) => void;
  activeView: 'map2d' | 'map3d' | 'table' | 'history' | 'audit';
  onChangeView: (view: 'map2d' | 'map3d' | 'table' | 'history' | 'audit') => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onOpenAIServer: () => void;
  onOpenSettings?: () => void;
  onRecompute: () => void;
  isRecomputing: boolean;
  totalRecords: number;
  totalClusters: number;
  connectedAIServerName?: string;
  datasetProvenance?: 'local' | 'cached' | 'live';
}

export const Header: React.FC<HeaderProps> = ({
  sources,
  activeSourceId,
  onSelectSource,
  activeView,
  onChangeView,
  onOpenImport,
  onOpenExport,
  onOpenAIServer,
  onOpenSettings,
  onRecompute,
  isRecomputing,
  totalRecords,
  totalClusters,
  connectedAIServerName,
  datasetProvenance = 'local',
}) => {
  const isDesktop = typeof window !== 'undefined' && !!window.desktopBridge?.isDesktop;
  const currentSource = sources.find(s => s.id === activeSourceId);

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <Brain className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-slate-100 text-base tracking-tight font-sans">
              AI Memory Explorer
            </h1>
            <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Desktop Edition
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Read-Only
            </span>
            {datasetProvenance === 'cached' && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Cached Offline
              </span>
            )}
            {datasetProvenance === 'live' && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                Live Connected
              </span>
            )}
            {datasetProvenance === 'local' && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Local Dataset
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <span>Provider-Independent Semantic Inspector</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300 font-mono text-[11px]">{totalRecords} records</span>
            <span className="text-slate-600">•</span>
            <span className="text-indigo-400 font-mono text-[11px]">{totalClusters} clusters</span>
          </p>
        </div>
      </div>

      {/* Navigation View Switcher */}
      <nav aria-label="Explorer views" className="flex items-center bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs font-medium overflow-x-auto max-w-full">
        <button
          onClick={() => onChangeView('map2d')}
          className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeView === 'map2d'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Interactive 2D Semantic Map (UMAP/PCA)"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>2D Map</span>
        </button>

        <button
          onClick={() => onChangeView('map3d')}
          className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeView === 'map3d'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Interactive 3D Semantic Landscape (Three.js WebGL)"
        >
          <Box className="w-3.5 h-3.5" />
          <span>3D Space</span>
        </button>

        <button
          onClick={() => onChangeView('table')}
          className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeView === 'table'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Tabular Memory Ledger & Raw Metadata"
        >
          <Table className="w-3.5 h-3.5" />
          <span>Ledger</span>
        </button>

        <button
          onClick={() => onChangeView('history')}
          className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeView === 'history'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Memory Snapshots & Evolution Diff"
        >
          <History className="w-3.5 h-3.5" />
          <span>History & Diff</span>
        </button>

        <button
          onClick={() => onChangeView('audit')}
          className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeView === 'audit'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
              : 'text-purple-300 hover:text-purple-100 hover:bg-purple-950/40'
          }`}
          title="Cognitive Audit with Gemini 4 Argon High Thinking"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-300" />
          <span>Cognitive Audit</span>
        </button>
      </nav>

      {/* Source Selector & Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Source Dropdown */}
        <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
          <Database className="w-3.5 h-3.5 text-indigo-400 mr-2 flex-shrink-0" />
          <select
            value={activeSourceId}
            onChange={e => onSelectSource(e.target.value)}
            className="bg-transparent text-slate-200 outline-none cursor-pointer pr-4 font-medium"
            aria-label="Active memory source"
          >
            {Array.from(new Map(sources.map(s => [s.id, s])).values()).map(s => (
              <option key={s.id} value={s.id} className="bg-slate-900 text-slate-100">
                {s.name} {s.isPreset ? '(Preset)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Recompute button */}
        <button
          onClick={onRecompute}
          disabled={isRecomputing}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors disabled:opacity-50"
          title="Recompute 2D/3D projections and clusters"
          aria-label="Recompute projections"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRecomputing ? 'animate-spin text-indigo-400' : ''}`} />
        </button>

        {/* Connect AI Server button */}
        <button
          onClick={onOpenAIServer}
          className="px-2.5 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-200 text-xs font-medium border border-cyan-500/40 flex items-center gap-1.5 transition-all shadow-sm shadow-cyan-900/20"
          title="Connect local AI (Ollama, LM Studio) or remote agent server"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          <span>{connectedAIServerName ? `AI: ${connectedAIServerName}` : 'AI Servers'}</span>
        </button>

        {/* Connect / Import modal button */}
        <button
          onClick={onOpenImport}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
          title="Connect file or database source (JSON, CSV, SQLite, Qdrant, Chroma, REST)"
        >
          <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Files / DBs</span>
        </button>

        {/* Export button */}
        <button
          onClick={onOpenExport}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
          title="Export normalized memories, projection coordinates, and logs"
        >
          <Download className="w-3.5 h-3.5 text-slate-300" />
          <span>Export</span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 transition-colors"
          title="Application Settings & Projections"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
