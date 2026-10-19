import React from 'react';
import {
  Search,
  SlidersHorizontal,
  X,
  Sparkles,
  FileText,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { ClusterInfo } from '../types/memory.ts';

interface SimilaritySearchProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchMode: 'hybrid' | 'lexical' | 'vector';
  onSearchModeChange: (mode: 'hybrid' | 'lexical' | 'vector') => void;
  minSimilarity: number;
  onMinSimilarityChange: (val: number) => void;
  selectedType: string | null;
  onSelectType: (type: string | null) => void;
  selectedClusterId: number | null;
  onSelectClusterId: (cId: number | null) => void;
  clusters: ClusterInfo[];
  matchCount: number;
  totalCount: number;
}

const MEMORY_TYPES = ['episodic', 'semantic', 'procedural', 'working', 'profile'];

export const SimilaritySearch: React.FC<SimilaritySearchProps> = ({
  searchQuery,
  onSearchChange,
  searchMode,
  onSearchModeChange,
  minSimilarity,
  onMinSimilarityChange,
  selectedType,
  onSelectType,
  selectedClusterId,
  onSelectClusterId,
  clusters,
  matchCount,
  totalCount,
}) => {
  return (
    <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* Search Input Bar */}
      <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-lg">
        <div className="relative w-full flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search memories by keyword or semantic meaning..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-8 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
            aria-label="Search memory content"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 text-slate-500 hover:text-slate-300"
              aria-label="Clear search input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Mode Segmented Control (FR-05) */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => onSearchModeChange('hybrid')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              searchMode === 'hybrid'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Hybrid: combines text match and vector embedding similarity"
          >
            Hybrid
          </button>
          <button
            onClick={() => onSearchModeChange('lexical')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
              searchMode === 'lexical'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Lexical: exact substring and keyword match"
          >
            <FileText className="w-3 h-3" />
            <span>Exact</span>
          </button>
          <button
            onClick={() => onSearchModeChange('vector')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
              searchMode === 'vector'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Vector: cosine distance nearest neighbors"
          >
            <Sparkles className="w-3 h-3 text-cyan-300" />
            <span>Vector</span>
          </button>
        </div>
      </div>

      {/* Filter Chips & Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Similarity Threshold Slider (for vector mode) */}
        {searchMode !== 'lexical' && (
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
            <span className="text-[11px] text-slate-400 whitespace-nowrap">
              Min Sim: <span className="text-indigo-400 font-mono font-medium">{minSimilarity}%</span>
            </span>
            <input
              type="range"
              min="30"
              max="95"
              step="5"
              value={minSimilarity}
              onChange={e => onMinSimilarityChange(Number(e.target.value))}
              className="w-16 h-1 bg-slate-800 rounded-lg accent-indigo-500 cursor-pointer"
              title="Minimum similarity threshold"
              aria-label="Minimum similarity percentage"
            />
          </div>
        )}

        {/* Memory Type filter */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSelectType(null)}
            className={`px-2 py-1 rounded-md text-[11px] transition-colors ${
              selectedType === null
                ? 'bg-slate-800 text-white font-medium border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Types
          </button>
          {MEMORY_TYPES.map(t => (
            <button
              key={t}
              onClick={() => onSelectType(selectedType === t ? null : t)}
              className={`px-2 py-1 rounded-md text-[11px] capitalize transition-colors ${
                selectedType === t
                  ? 'bg-indigo-600/30 text-indigo-300 font-medium border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Cluster Filter */}
        <select
          value={selectedClusterId === null ? '' : String(selectedClusterId)}
          onChange={e => onSelectClusterId(e.target.value === '' ? null : Number(e.target.value))}
          className="bg-slate-950 text-slate-300 border border-slate-800 rounded-lg px-2 py-1 text-[11px] outline-none cursor-pointer"
          aria-label="Filter by cluster"
        >
          <option value="">All Clusters</option>
          {clusters.map(c => (
            <option key={c.id} value={c.id}>
              Cluster {c.id + 1} ({c.count})
            </option>
          ))}
        </select>

        {/* Matches Status Badge */}
        <span className="text-slate-400 font-mono text-[11px] ml-1">
          {searchQuery || selectedType || selectedClusterId !== null ? (
            <span className="text-indigo-300 font-medium">{matchCount} matching</span>
          ) : (
            <span>{totalCount} total</span>
          )}
        </span>
      </div>
    </div>
  );
};
