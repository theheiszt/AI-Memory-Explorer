import React, { useState } from 'react';
import {
  History,
  PlusCircle,
  FileEdit,
  Trash2,
  GitCommit,
  TrendingUp,
  ArrowRight,
  Layers,
  Calendar,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { SnapshotDiff, NormalizedMemoryRecord } from '../types/memory.ts';

interface HistoryViewProps {
  diff: SnapshotDiff;
  onSelectRecord: (record: NormalizedMemoryRecord) => void;
  onTakeSnapshot: () => void;
  snapshotsCount: number;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  diff,
  onSelectRecord,
  onTakeSnapshot,
  snapshotsCount,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'added' | 'modified' | 'removed' | 'clusters' | 'retrievals'>('all');

  return (
    <div className="flex-1 h-full w-full bg-slate-950 overflow-y-auto p-6 space-y-6 text-xs text-slate-300">
      {/* Top Banner & Snapshot Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <History className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">
              Memory Lifecycle & Snapshot Diff
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              FR-08 Audit Log
            </span>
          </div>
          <p className="text-slate-400 text-xs">
            Comparing <span className="font-semibold text-slate-200">{diff.snapshotA}</span> ({new Date(diff.timestampA).toLocaleDateString()}) vs{' '}
            <span className="font-semibold text-slate-200">{diff.snapshotB}</span> ({new Date(diff.timestampB).toLocaleDateString()}).
          </p>
        </div>

        <button
          onClick={onTakeSnapshot}
          className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 transition-colors"
        >
          <GitCommit className="w-4 h-4" />
          <span>Capture New Snapshot ({snapshotsCount})</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => setActiveTab('added')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            activeTab === 'added' ? 'bg-emerald-950/40 border-emerald-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-[11px] font-medium">Added</span>
            <PlusCircle className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300">
            +{diff.addedRecords.length}
          </div>
        </div>

        <div
          onClick={() => setActiveTab('modified')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            activeTab === 'modified' ? 'bg-amber-950/40 border-amber-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-amber-400 mb-1">
            <span className="text-[11px] font-medium">Modified</span>
            <FileEdit className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-300">
            {diff.modifiedRecords.length}
          </div>
        </div>

        <div
          onClick={() => setActiveTab('removed')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            activeTab === 'removed' ? 'bg-rose-950/40 border-rose-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-rose-400 mb-1">
            <span className="text-[11px] font-medium">Removed</span>
            <Trash2 className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-300">
            -{diff.removedRecords.length}
          </div>
        </div>

        <div
          onClick={() => setActiveTab('clusters')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            activeTab === 'clusters' ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-indigo-400 mb-1">
            <span className="text-[11px] font-medium">Cluster Shifts</span>
            <Layers className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-300">
            {diff.clusterMigrations.length}
          </div>
        </div>

        <div
          onClick={() => setActiveTab('retrievals')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            activeTab === 'retrievals' ? 'bg-cyan-950/40 border-cyan-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-cyan-400 mb-1">
            <span className="text-[11px] font-medium">Retrieval Deltas</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-300">
            {diff.retrievalFrequencyChanges.length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Changes
        </button>
        <button
          onClick={() => setActiveTab('added')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'added' ? 'bg-emerald-900/40 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Added ({diff.addedRecords.length})
        </button>
        <button
          onClick={() => setActiveTab('modified')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'modified' ? 'bg-amber-900/40 text-amber-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Modified ({diff.modifiedRecords.length})
        </button>
        <button
          onClick={() => setActiveTab('removed')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'removed' ? 'bg-rose-900/40 text-rose-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Removed ({diff.removedRecords.length})
        </button>
        <button
          onClick={() => setActiveTab('retrievals')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'retrievals' ? 'bg-cyan-900/40 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Retrieval Frequency ({diff.retrievalFrequencyChanges.length})
        </button>
      </div>

      {/* Detailed Diff Sections */}
      <div className="space-y-4">
        {/* Added Records */}
        {(activeTab === 'all' || activeTab === 'added') && diff.addedRecords.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Newly Stored Memories</span>
            </h3>
            <div className="space-y-2">
              {diff.addedRecords.map(r => (
                <div
                  key={r.id}
                  onClick={() => onSelectRecord(r)}
                  className="p-3 rounded-lg bg-slate-900 border border-emerald-900/40 hover:border-emerald-500/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                    <span className="text-emerald-400 font-semibold">{r.id}</span>
                    <span className="text-slate-500">{new Date(r.createdAt || '').toLocaleString()}</span>
                  </div>
                  <p className="text-slate-200 font-sans text-xs">{r.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modified Records */}
        {(activeTab === 'all' || activeTab === 'modified') && diff.modifiedRecords.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <FileEdit className="w-3.5 h-3.5" />
              <span>Evolved / Mutated Memories</span>
            </h3>
            <div className="space-y-2">
              {diff.modifiedRecords.map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectRecord(m.after)}
                  className="p-3 rounded-lg bg-slate-900 border border-amber-900/40 hover:border-amber-500/50 cursor-pointer transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-amber-400 font-semibold">{m.before.id}</span>
                    <div className="flex items-center gap-1">
                      {m.changes.map(ch => (
                        <span key={ch} className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 font-mono text-[10px]">
                          {ch} changed
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800 text-slate-400">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold mb-1">Previous</span>
                      <p>{m.before.content}</p>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-indigo-900/50 text-slate-200">
                      <span className="text-[10px] text-indigo-400 uppercase block font-semibold mb-1">Current</span>
                      <p>{m.after.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Removed Records */}
        {(activeTab === 'all' || activeTab === 'removed') && diff.removedRecords.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Forgotten / Evicted Memories</span>
            </h3>
            <div className="space-y-2">
              {diff.removedRecords.map(r => (
                <div key={r.id} className="p-3 rounded-lg bg-slate-900 border border-rose-900/40 text-xs">
                  <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                    <span className="text-rose-400 font-semibold">{r.id}</span>
                    <span className="text-slate-500">Pruned from store</span>
                  </div>
                  <p className="text-slate-400 line-through">{r.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Retrieval Frequency Changes */}
        {(activeTab === 'all' || activeTab === 'retrievals') && diff.retrievalFrequencyChanges.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Retrieval Frequency Shifts</span>
            </h3>
            <div className="space-y-2">
              {diff.retrievalFrequencyChanges.map(rf => (
                <div key={rf.recordId} className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <span className="font-mono text-cyan-400 font-semibold text-[11px] mr-2">{rf.recordId}</span>
                    <span className="text-slate-300 font-sans text-xs">{rf.content}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs whitespace-nowrap">
                    <span className="text-slate-400">{rf.beforeCount} recalls</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-cyan-300 font-semibold">{rf.afterCount} recalls</span>
                    <span className="text-[10px] text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10">
                      +{rf.delta}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
