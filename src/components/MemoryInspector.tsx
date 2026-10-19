import React, { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Calendar,
  Layers,
  Link,
  History,
  Tag,
  ArrowRight,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  ShieldAlert,
  GitBranch,
} from 'lucide-react';
import type { NormalizedMemoryRecord, SubMemoryNode } from '../types/memory.ts';
import { findNearestNeighbors } from '../services/projection/vectorMath.ts';

interface MemoryInspectorProps {
  record: NormalizedMemoryRecord | null;
  allRecords: NormalizedMemoryRecord[];
  onSelectRecord: (record: NormalizedMemoryRecord) => void;
  onClose: () => void;
  isExpanded?: boolean;
  onToggleExpand?: (recordId: string) => void;
  subMemories?: SubMemoryNode[];
}

export const MemoryInspector: React.FC<MemoryInspectorProps> = ({
  record,
  allRecords,
  onSelectRecord,
  onClose,
  isExpanded = false,
  onToggleExpand,
  subMemories = [],
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showFullVector, setShowFullVector] = useState(false);
  const [vectorPage, setVectorPage] = useState(0);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1800);
  };

  // Compute nearest neighbors on high-dimensional vectors
  const nearestNeighbors = useMemo(() => {
    if (!record || !record.embedding) return [];
    return findNearestNeighbors(record.embedding, allRecords, 4, record.id);
  }, [record, allRecords]);

  if (!record) {
    return (
      <div className="hidden md:flex w-80 md:w-96 border-l border-slate-800 bg-slate-900/95 flex-col items-center justify-center p-6 text-center text-slate-500">
        <Layers className="w-10 h-10 mb-2 opacity-40 text-slate-400" />
        <p className="text-sm font-medium text-slate-400">No Memory Selected</p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
          Click any point in the 2D or 3D semantic map or choose a row from the ledger to inspect its vector metadata, nearest neighbors, and retrieval provenance.
        </p>
      </div>
    );
  }

  const embeddingLength = record.embedding?.length || 0;
  const pageSize = 16;
  const totalVectorPages = Math.ceil(embeddingLength / pageSize);
  const visibleVectorSlice = record.embedding?.slice(
    vectorPage * pageSize,
    (vectorPage + 1) * pageSize
  );

  return (
    <>
      {/* Mobile backdrop overlay */}
      <div
        onClick={onClose}
        className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-xs"
        aria-hidden="true"
      />

      <aside
        aria-label="Memory details inspector"
        className="fixed md:relative inset-y-0 right-0 w-full sm:w-96 md:w-96 border-l border-slate-800 bg-slate-900/98 backdrop-blur flex flex-col h-full z-50 shadow-2xl overflow-y-auto"
      >
      {/* Header */}
      <div className="p-4 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {record.memoryType || 'semantic'}
          </span>
          <span className="font-mono text-xs text-slate-400 font-medium truncate max-w-[150px]">
            {record.id}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => copyToClipboard(record.content, 'content')}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800"
            title="Copy memory content"
            aria-label="Copy memory content"
          >
            {copiedField === 'content' ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800"
            title="Close inspector"
            aria-label="Close inspector panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5 text-xs text-slate-300">
        {/* Memory Content */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Original Content
          </label>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-sans leading-relaxed text-sm whitespace-pre-wrap select-text">
            {record.content}
          </div>
        </div>

        {/* Timestamps & Provenance */}
        <div className="space-y-2 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" /> Created:
            </span>
            <span className="font-mono text-slate-200">
              {record.createdAt ? new Date(record.createdAt).toLocaleString() : 'Not provided'}
            </span>
          </div>

          {record.updatedAt && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Modified:</span>
              <span className="font-mono text-slate-200">
                {new Date(record.updatedAt).toLocaleString()}
              </span>
            </div>
          )}

          {record.provenance?.agentRole && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-500" /> Agent Role:
              </span>
              <span className="text-indigo-300 font-medium">
                {record.provenance.agentRole}
              </span>
            </div>
          )}

          {record.provenance?.sessionId && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Session ID:</span>
              <span className="font-mono text-slate-400 text-[10px]">
                {record.provenance.sessionId}
              </span>
            </div>
          )}
        </div>

        {/* Vector Embedding Details (Bounded Preview) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <span>Embedding Vector</span>
              {record.embedding ? (
                <span className="font-mono text-[10px] text-indigo-400">
                  ({embeddingLength} dimensions)
                </span>
              ) : (
                <span className="text-amber-400 text-[10px]">(Missing)</span>
              )}
            </label>
            {record.embedding && (
              <button
                onClick={() => setShowFullVector(!showFullVector)}
                className="text-indigo-400 hover:text-indigo-300 text-[11px] font-medium flex items-center gap-0.5"
              >
                <span>{showFullVector ? 'Collapse' : 'Expand'}</span>
                {showFullVector ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {record.embeddingModel && (
            <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
              <span>Model:</span>
              <span className="text-slate-200">{record.embeddingModel}</span>
            </div>
          )}

          {record.embedding ? (
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px] text-slate-300 mb-2">
                {visibleVectorSlice?.map((val, i) => (
                  <div
                    key={i}
                    className="p-1 rounded bg-slate-900 border border-slate-800/60 text-center truncate"
                    title={String(val)}
                  >
                    {val.toFixed(4)}
                  </div>
                ))}
              </div>

              {totalVectorPages > 1 && (
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>
                    Values {vectorPage * pageSize + 1} -{' '}
                    {Math.min((vectorPage + 1) * pageSize, embeddingLength)} of {embeddingLength}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setVectorPage(p => Math.max(0, p - 1))}
                      disabled={vectorPage === 0}
                      className="px-1.5 py-0.5 rounded bg-slate-800 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setVectorPage(p => Math.min(totalVectorPages - 1, p + 1))}
                      disabled={vectorPage >= totalVectorPages - 1}
                      className="px-1.5 py-0.5 rounded bg-slate-800 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              No vector embedding is stored for this memory record.
            </div>
          )}
        </div>

        {/* Explicit Relationships (Source Defined) */}
        {record.explicitRelations && record.explicitRelations.length > 0 && (
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-cyan-400" />
              <span>Explicit Source Relations ({record.explicitRelations.length})</span>
            </label>
            <div className="space-y-1.5">
              {record.explicitRelations.map((rel, idx) => {
                const targetRec = allRecords.find(r => r.id === rel.targetId);
                const isContradiction = rel.relationType === 'contradicts';
                return (
                  <div
                    key={idx}
                    onClick={() => targetRec && onSelectRecord(targetRec)}
                    className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                      isContradiction
                        ? 'bg-rose-950/30 border-rose-800/50 hover:bg-rose-900/30'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                          isContradiction
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-cyan-500/20 text-cyan-300'
                        }`}
                      >
                        {rel.relationType}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 flex items-center gap-1">
                        {rel.targetId} <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                    {rel.note && <p className="text-[11px] text-slate-300 italic mb-1">{rel.note}</p>}
                    {targetRec && (
                      <p className="text-[11px] text-slate-400 line-clamp-2">
                        {targetRec.content}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hierarchical Sub-Memories (Reaching 100k - 1M virtual space) */}
        <div className="space-y-2 p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/30">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
              <span>Hierarchical Sub-Manifold (100x Reach)</span>
            </label>
            {onToggleExpand && (
              <button
                onClick={() => onToggleExpand(record.id)}
                className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
                  isExpanded
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {isExpanded ? 'Collapse' : '⚡ Expand'}
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            {isExpanded
              ? `${subMemories.length} micro-vectors materialized in local orbit around this memory anchor.`
              : 'This memory anchor maps to 100 virtual micro-propositions and granular sub-vectors.'}
          </p>

          {isExpanded && subMemories.length > 0 && (
            <div className="mt-2 space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {subMemories.map((sub, sIdx) => (
                <div
                  key={sub.id}
                  className="p-2 rounded bg-slate-900 border border-indigo-900/60 text-[11px] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-cyan-300 font-semibold">
                      #{sIdx + 1} {sub.subType.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono text-indigo-300">
                      Sim: {(sub.similarityToParent * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-slate-200">{sub.detail}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Attn: {(sub.attentionWeight * 100).toFixed(0)}%</span>
                    <span>{sub.tokensCount} tokens</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nearest Neighbors (Calculated on Original Vectors) */}
        {nearestNeighbors.length > 0 && (
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Nearest Semantic Neighbors (Cosine)</span>
            </label>
            <div className="space-y-1.5">
              {nearestNeighbors.map((item, idx) => (
                <div
                  key={item.record.id}
                  onClick={() => onSelectRecord(item.record)}
                  className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-slate-400">
                      #{idx + 1} {item.record.id}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-indigo-300">
                      {(item.similarity * 100).toFixed(1)}% match
                    </span>
                  </div>
                  <p className="text-slate-300 line-clamp-2 text-[11px] leading-relaxed">
                    {item.record.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Historical Retrieval Logs */}
        {record.retrievalEvents && record.retrievalEvents.length > 0 && (
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span>Retrieval History ({record.retrievalEvents.length})</span>
            </label>
            <div className="space-y-1.5">
              {record.retrievalEvents.map(evt => (
                <div key={evt.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="font-medium text-slate-200">Query: "{evt.query}"</span>
                    <span className="text-amber-300 font-mono">
                      {(evt.similarityScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {new Date(evt.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata Key-Value */}
        {record.metadata && Object.keys(record.metadata).length > 0 && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Source Metadata
            </label>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 max-h-40 overflow-y-auto space-y-1 font-mono text-[11px]">
              {Object.entries(record.metadata).map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-2 border-b border-slate-900 pb-1">
                  <span className="text-slate-400 font-medium">{k}:</span>
                  <span className="text-slate-200 text-right truncate max-w-[180px]">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
    </>
  );
};
