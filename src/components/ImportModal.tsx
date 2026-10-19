import React, { useState } from 'react';
import {
  X,
  FileCode,
  FileSpreadsheet,
  Database,
  Cloud,
  Check,
  AlertCircle,
  Upload,
  ArrowRight,
  FolderOpen,
} from 'lucide-react';
import { SourceConfig, SourceType } from '../types/memory.ts';
import { JSONMemoryAdapter } from '../services/adapters/jsonAdapter.ts';
import { CSVMemoryAdapter } from '../services/adapters/csvAdapter.ts';
import { PRESET_SOURCES } from '../services/adapters/sampleDatasets.ts';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSource: (newSource: SourceConfig, rawData?: string, mapping?: any) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportSource,
}) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'json' | 'csv' | 'remote'>('preset');
  const [sourceName, setSourceName] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvMapping, setCsvMapping] = useState({
    idColumn: 'id',
    contentColumn: 'content',
    embeddingColumn: 'embedding',
    timestampColumn: 'created_at',
    typeColumn: 'type',
  });
  const [remoteType, setRemoteType] = useState<'qdrant' | 'chroma' | 'rest'>('qdrant');
  const [remoteUrl, setRemoteUrl] = useState('http://localhost:6333');
  const [collectionName, setCollectionName] = useState('agent_memories');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBrowseJSONFile = async () => {
    setError(null);
    if (typeof window !== 'undefined' && window.desktopBridge?.showOpenDialog) {
      try {
        const res = await window.desktopBridge.showOpenDialog({
          title: 'Select Memory JSON or JSONL File',
          filters: [
            { name: 'JSON / JSONL Files (*.json, *.jsonl)', extensions: ['json', 'jsonl'] },
            { name: 'All Files (*.*)', extensions: ['*'] },
          ],
          properties: ['openFile'],
        });
        if (!res.canceled && res.filePaths?.[0]) {
          const filePath = res.filePaths[0];
          const readRes = await window.desktopBridge.readLocalFile(filePath);
          if (readRes.success && readRes.content) {
            setJsonText(readRes.content);
            const base = filePath.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '') || '';
            if (!sourceName && base) {
              setSourceName(base);
            }
          } else {
            setError(readRes.error || 'Failed to read selected file');
          }
        }
      } catch (err: any) {
        setError(err.message || 'File dialog error');
      }
      return;
    }

    // Browser fallback
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.jsonl';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          setJsonText(String(re.target?.result || ''));
          if (!sourceName) setSourceName(file.name.replace(/\.[^/.]+$/, ''));
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleBrowseCSVFile = async () => {
    setError(null);
    if (typeof window !== 'undefined' && window.desktopBridge?.showOpenDialog) {
      try {
        const res = await window.desktopBridge.showOpenDialog({
          title: 'Select Memory CSV File',
          filters: [
            { name: 'CSV Files (*.csv)', extensions: ['csv'] },
            { name: 'All Files (*.*)', extensions: ['*'] },
          ],
          properties: ['openFile'],
        });
        if (!res.canceled && res.filePaths?.[0]) {
          const filePath = res.filePaths[0];
          const readRes = await window.desktopBridge.readLocalFile(filePath);
          if (readRes.success && readRes.content) {
            setCsvText(readRes.content);
            const base = filePath.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '') || '';
            if (!sourceName && base) {
              setSourceName(base);
            }
          } else {
            setError(readRes.error || 'Failed to read selected file');
          }
        }
      } catch (err: any) {
        setError(err.message || 'File dialog error');
      }
      return;
    }

    // Browser fallback
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          setCsvText(String(re.target?.result || ''));
          if (!sourceName) setSourceName(file.name.replace(/\.[^/.]+$/, ''));
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleImportJSON = () => {
    setError(null);
    if (!jsonText.trim()) {
      setError('Please provide JSON or JSONL content.');
      return;
    }

    try {
      const name = sourceName.trim() || 'Custom JSON Export';
      const sourceId = `source_json_${Date.now()}`;
      const adapter = new JSONMemoryAdapter(sourceId, name, jsonText);
      const caps = adapter.getCapabilities();

      const newSource: SourceConfig = {
        id: sourceId,
        name,
        type: 'json',
        status: 'connected',
        capabilities: caps,
        lastSyncedAt: new Date().toISOString(),
      };

      onImportSource(newSource, jsonText);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to parse JSON content.');
    }
  };

  const handleImportCSV = () => {
    setError(null);
    if (!csvText.trim()) {
      setError('Please provide CSV content.');
      return;
    }

    try {
      const name = sourceName.trim() || 'Custom CSV Export';
      const sourceId = `source_csv_${Date.now()}`;
      const adapter = new CSVMemoryAdapter(sourceId, name, csvText, csvMapping);
      const caps = adapter.getCapabilities();

      const newSource: SourceConfig = {
        id: sourceId,
        name,
        type: 'csv',
        status: 'connected',
        capabilities: caps,
        lastSyncedAt: new Date().toISOString(),
        fieldMapping: csvMapping as any,
      };

      onImportSource(newSource, csvText, csvMapping);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV content.');
    }
  };

  const handleConnectRemote = () => {
    const name = sourceName.trim() || `${remoteType.toUpperCase()} Instance`;
    const sourceId = `source_${remoteType}_${Date.now()}`;

    const newSource: SourceConfig = {
      id: sourceId,
      name,
      type: remoteType,
      endpoint: remoteUrl,
      status: 'connected',
      capabilities: {
        hasEmbeddings: true,
        embeddingDimension: remoteType === 'chroma' ? 1536 : 384,
        supportsPagination: true,
        supportsFiltering: true,
        supportsRetrievalHistory: false,
        supportsRealtimeSync: true,
        isReadOnly: true,
        recordCount: 0,
      },
      lastSyncedAt: new Date().toISOString(),
    };

    onImportSource(newSource);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-slate-100 font-sans">
              Connect AI Memory Source
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Type Navigation */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950 px-6 gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('preset')}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'preset'
                ? 'border-indigo-500 text-indigo-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Framework Presets
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'json'
                ? 'border-indigo-500 text-indigo-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            JSON / JSONL
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'csv'
                ? 'border-indigo-500 text-indigo-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            CSV Export
          </button>
          <button
            onClick={() => setActiveTab('remote')}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'remote'
                ? 'border-indigo-500 text-indigo-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Vector DB / API (Qdrant, Chroma, REST)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: PRESETS */}
          {activeTab === 'preset' && (
            <div className="space-y-3">
              <p className="text-slate-400 text-xs">
                Explore preloaded real-world memory collections from popular AI agent frameworks:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_SOURCES.map(preset => (
                  <div
                    key={preset.id}
                    onClick={() => {
                      onImportSource(preset);
                      onClose();
                    }}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/60 cursor-pointer transition-all hover:scale-[1.01] space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100 group-hover:text-indigo-300">
                        {preset.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300">
                        {preset.capabilities.recordCount} records
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {preset.description}
                    </p>
                    <div className="text-[10px] font-mono text-slate-500">
                      Embedding: {preset.capabilities.embeddingModel}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: JSON / JSONL */}
          {activeTab === 'json' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Source Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., My Agent Episodic Store"
                  value={sourceName}
                  onChange={e => setSourceName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Paste JSON / JSONL or Open File
                  </label>
                  <button
                    type="button"
                    onClick={handleBrowseJSONFile}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Browse File...</span>
                  </button>
                </div>
                <textarea
                  rows={8}
                  placeholder={`[\n  {\n    "id": "mem_1",\n    "content": "User prefers concise python solutions",\n    "vector": [0.12, -0.45, ...],\n    "metadata": { "tag": "preferences" }\n  }\n]`}
                  value={jsonText}
                  onChange={e => setJsonText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 font-mono text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleImportJSON}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition-colors"
              >
                Ingest & Normalize JSON Memories
              </button>
            </div>
          )}

          {/* TAB 3: CSV WITH FIELD MAPPING */}
          {activeTab === 'csv' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Source Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Knowledge Base CSV Export"
                  value={sourceName}
                  onChange={e => setSourceName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              {/* Column Mapping Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">ID Column</label>
                  <input
                    type="text"
                    value={csvMapping.idColumn}
                    onChange={e => setCsvMapping({ ...csvMapping, idColumn: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Content Column</label>
                  <input
                    type="text"
                    value={csvMapping.contentColumn}
                    onChange={e => setCsvMapping({ ...csvMapping, contentColumn: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Embedding Column</label>
                  <input
                    type="text"
                    value={csvMapping.embeddingColumn}
                    onChange={e => setCsvMapping({ ...csvMapping, embeddingColumn: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Paste CSV Data or Open File
                  </label>
                  <button
                    type="button"
                    onClick={handleBrowseCSVFile}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Browse CSV...</span>
                  </button>
                </div>
                <textarea
                  rows={6}
                  placeholder={`id,content,embedding,type\n1,"First remembered fact","[0.1, 0.2, 0.3]",semantic\n2,"User lives in Tokyo","[0.4, 0.1, -0.2]",profile`}
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 font-mono text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleImportCSV}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition-colors"
              >
                Parse & Import CSV Memories
              </button>
            </div>
          )}

          {/* TAB 4: REMOTE VECTOR DB */}
          {activeTab === 'remote' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRemoteType('qdrant');
                    setRemoteUrl('http://localhost:6333');
                  }}
                  className={`p-2 rounded-lg border text-center transition-colors ${
                    remoteType === 'qdrant'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Qdrant
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRemoteType('chroma');
                    setRemoteUrl('http://localhost:8000');
                  }}
                  className={`p-2 rounded-lg border text-center transition-colors ${
                    remoteType === 'chroma'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Chroma
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRemoteType('rest');
                    setRemoteUrl('http://localhost:5000/api');
                  }}
                  className={`p-2 rounded-lg border text-center transition-colors ${
                    remoteType === 'rest'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Generic REST
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  API Endpoint URL
                </label>
                <input
                  type="text"
                  value={remoteUrl}
                  onChange={e => setRemoteUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              {remoteType !== 'rest' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Collection Name / ID
                  </label>
                  <input
                    type="text"
                    value={collectionName}
                    onChange={e => setCollectionName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  API Key / Bearer Token (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave empty for local instances"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleConnectRemote}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition-colors"
              >
                Connect Remote Adapter (Read-Only)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
