import React, { useState } from 'react';
import {
  ArrowUpDown,
  Search,
  ExternalLink,
  Sparkles,
  Link,
  History,
  Tag,
  Check,
  Copy,
} from 'lucide-react';
import { NormalizedMemoryRecord } from '../types/memory.ts';

interface TableExplorerProps {
  records: NormalizedMemoryRecord[];
  selectedRecordId: string | null;
  onSelectRecord: (record: NormalizedMemoryRecord) => void;
  clustersMap: Map<string, number>;
}

export const TableExplorer: React.FC<TableExplorerProps> = ({
  records,
  selectedRecordId,
  onSelectRecord,
  clustersMap,
}) => {
  const [sortField, setSortField] = useState<'id' | 'createdAt' | 'type'>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 100;

  const sortedRecords = [...records].sort((a, b) => {
    let comp = 0;
    if (sortField === 'id') {
      comp = a.id.localeCompare(b.id);
    } else if (sortField === 'type') {
      comp = (a.memoryType || '').localeCompare(b.memoryType || '');
    } else {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      comp = timeA - timeB;
    }
    return sortAsc ? comp : -comp;
  });

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRecords = sortedRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (field: 'id' | 'createdAt' | 'type') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="flex-1 h-full w-full bg-slate-950 flex flex-col overflow-hidden text-xs text-slate-300">
      {/* Pagination Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between gap-3 text-xs flex-shrink-0">
        <div className="flex items-center gap-2 text-slate-400">
          <span>Showing</span>
          <span className="font-mono text-slate-200">
            {sortedRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
            {Math.min(currentPage * pageSize, sortedRecords.length)}
          </span>
          <span>of</span>
          <span className="font-mono text-cyan-400 font-semibold">{sortedRecords.length.toLocaleString()}</span>
          <span>memories</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 border border-slate-700 text-xs font-medium"
          >
            Previous
          </button>
          <span className="font-mono text-slate-400 text-xs">
            Page {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 border border-slate-700 text-xs font-medium"
          >
            Next
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
        <thead className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
          <tr>
            <th
              onClick={() => toggleSort('id')}
              className="py-3 px-4 cursor-pointer hover:text-slate-200 select-none"
            >
              <div className="flex items-center gap-1.5">
                <span>Memory ID</span>
                <ArrowUpDown className="w-3 h-3 text-slate-500" />
              </div>
            </th>
            <th className="py-3 px-4">Content</th>
            <th
              onClick={() => toggleSort('type')}
              className="py-3 px-4 cursor-pointer hover:text-slate-200 select-none"
            >
              <div className="flex items-center gap-1.5">
                <span>Type</span>
                <ArrowUpDown className="w-3 h-3 text-slate-500" />
              </div>
            </th>
            <th className="py-3 px-4">Cluster</th>
            <th className="py-3 px-4">Virtual Reach</th>
            <th className="py-3 px-4">Vector Dim</th>
            <th
              onClick={() => toggleSort('createdAt')}
              className="py-3 px-4 cursor-pointer hover:text-slate-200 select-none"
            >
              <div className="flex items-center gap-1.5">
                <span>Timestamp</span>
                <ArrowUpDown className="w-3 h-3 text-slate-500" />
              </div>
            </th>
            <th className="py-3 px-4">Retrievals</th>
            <th className="py-3 px-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {paginatedRecords.map(r => {
            const isSelected = r.id === selectedRecordId;
            const clusterId = clustersMap.get(r.id);

            return (
              <tr
                key={r.id}
                onClick={() => onSelectRecord(r)}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-indigo-950/40 hover:bg-indigo-900/40'
                    : 'hover:bg-slate-900/60'
                }`}
              >
                {/* ID */}
                <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                  <span className="text-indigo-400 font-semibold">{r.id}</span>
                </td>

                {/* Content */}
                <td className="py-3 px-4 max-w-md">
                  <p className="line-clamp-2 text-slate-200 leading-relaxed font-sans">
                    {r.content}
                  </p>
                  {r.explicitRelations && r.explicitRelations.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-cyan-400">
                      <Link className="w-3 h-3" />
                      <span>{r.explicitRelations.length} relations ({r.explicitRelations[0].relationType})</span>
                    </div>
                  )}
                </td>

                {/* Type */}
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    {r.memoryType || 'semantic'}
                  </span>
                </td>

                {/* Cluster */}
                <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400">
                  {clusterId !== undefined ? `Cluster ${clusterId + 1}` : '—'}
                </td>

                {/* Virtual Reach */}
                <td className="py-3 px-4 whitespace-nowrap font-mono">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                    {r.subMemoriesCount || 100}x reach
                  </span>
                </td>

                {/* Vector Dim */}
                <td className="py-3 px-4 whitespace-nowrap font-mono">
                  {r.embedding ? (
                    <span className="text-emerald-400 text-[11px]">
                      {r.embedding.length}d
                    </span>
                  ) : (
                    <span className="text-amber-500 text-[10px]">None</span>
                  )}
                </td>

                {/* Timestamp */}
                <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                </td>

                {/* Retrieval Events */}
                <td className="py-3 px-4 whitespace-nowrap">
                  {r.retrievalEvents && r.retrievalEvents.length > 0 ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {r.retrievalEvents.length} events
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>

                {/* Action */}
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onSelectRecord(r);
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 transition-colors"
                  >
                    Inspect
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
};
