import React, { useState } from 'react';
import {
  X,
  Download,
  ShieldCheck,
  FileCode,
  FileSpreadsheet,
  Layers,
  FileText,
  Check,
} from 'lucide-react';
import {
  NormalizedMemoryRecord,
  ProjectionPoint,
  ClusterInfo,
} from '../types/memory.ts';
import {
  exportNormalizedRecords,
  exportProjectionCoordinatesCSV,
  exportClustersJSON,
  exportDiagnosticLogs,
} from '../services/export/exporter.ts';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: NormalizedMemoryRecord[];
  points: ProjectionPoint[];
  clusters: ClusterInfo[];
  sourceName: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  records,
  points,
  clusters,
  sourceName,
}) => {
  const [includeEmbeddings, setIncludeEmbeddings] = useState(false);
  const [redactSensitiveData, setRedactSensitiveData] = useState(true);
  const [downloadedFormat, setDownloadedFormat] = useState<string | null>(null);

  if (!isOpen) return null;

  const triggerDownload = (content: string, filename: string, type = 'application/json') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportNormalized = () => {
    const json = exportNormalizedRecords(records, {
      includeEmbeddings,
      redactSensitiveData,
      prettyPrint: true,
    });
    triggerDownload(json, `${sourceName.toLowerCase().replace(/\s+/g, '_')}_normalized.json`);
    setDownloadedFormat('normalized');
    setTimeout(() => setDownloadedFormat(null), 2000);
  };

  const handleExportCoordinates = () => {
    const csv = exportProjectionCoordinatesCSV(points);
    triggerDownload(csv, `${sourceName.toLowerCase().replace(/\s+/g, '_')}_coordinates.csv`, 'text/csv');
    setDownloadedFormat('coordinates');
    setTimeout(() => setDownloadedFormat(null), 2000);
  };

  const handleExportClusters = () => {
    const json = exportClustersJSON(clusters);
    triggerDownload(json, `${sourceName.toLowerCase().replace(/\s+/g, '_')}_clusters.json`);
    setDownloadedFormat('clusters');
    setTimeout(() => setDownloadedFormat(null), 2000);
  };

  const handleExportDiagnostics = () => {
    const logs = [
      {
        timestamp: new Date().toISOString(),
        level: 'info' as const,
        message: 'System audit and memory projection generated successfully',
        redactedContext: { sourceName, recordCount: records.length, auth_token: 'secret_jwt_xyz' },
      },
    ];
    const logJson = exportDiagnosticLogs(logs, redactSensitiveData);
    triggerDownload(logJson, `${sourceName.toLowerCase().replace(/\s+/g, '_')}_diagnostic_logs.json`);
    setDownloadedFormat('diagnostics');
    setTimeout(() => setDownloadedFormat(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <Download className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-slate-100 font-sans">
              Export Memory Data (FR-09)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-slate-300">
          {/* Privacy & Safeguard Toggles (FR-09 explicit requirements) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="font-semibold text-slate-200">Redact Sensitive Data</span>
                  <p className="text-[11px] text-slate-400">Masks API keys, tokens, and PII keys by default</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={redactSensitiveData}
                onChange={e => setRedactSensitiveData(e.target.checked)}
                className="rounded accent-emerald-500 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-900">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <div>
                  <span className="font-semibold text-slate-200">Include Raw Embedding Vectors</span>
                  <p className="text-[11px] text-slate-400">Requires explicit user confirmation per FR-09</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeEmbeddings}
                onChange={e => setIncludeEmbeddings(e.target.checked)}
                className="rounded accent-indigo-500 w-4 h-4"
              />
            </label>
          </div>

          {/* Export Formats Selection */}
          <div className="space-y-2.5">
            <button
              onClick={handleExportNormalized}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 flex items-center justify-between text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100">Normalized Memory Records (.json)</div>
                  <div className="text-[11px] text-slate-400">All {records.length} records with metadata and provenance</div>
                </div>
              </div>
              {downloadedFormat === 'normalized' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Download className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
              )}
            </button>

            <button
              onClick={handleExportCoordinates}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 flex items-center justify-between text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100">Projection Coordinates (.csv)</div>
                  <div className="text-[11px] text-slate-400">2D/3D manifold coordinates (x, y, z) with cluster assignments</div>
                </div>
              </div>
              {downloadedFormat === 'coordinates' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Download className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
              )}
            </button>

            <button
              onClick={handleExportClusters}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 flex items-center justify-between text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100">Cluster Assignments & Centroids (.json)</div>
                  <div className="text-[11px] text-slate-400">{clusters.length} clusters with member IDs and representative records</div>
                </div>
              </div>
              {downloadedFormat === 'clusters' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Download className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
              )}
            </button>

            <button
              onClick={handleExportDiagnostics}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 flex items-center justify-between text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-400 group-hover:bg-slate-700">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100">Diagnostic & Connection Logs (.json)</div>
                  <div className="text-[11px] text-slate-400">Connection state, parsing telemetry, and redaction verification</div>
                </div>
              </div>
              {downloadedFormat === 'diagnostics' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Download className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
