import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header.tsx';
import { SemanticMap2D } from './components/SemanticMap2D.tsx';
import { SemanticMap3D } from './components/SemanticMap3D.tsx';
import { MemoryInspector } from './components/MemoryInspector.tsx';
import { SimilaritySearch } from './components/SimilaritySearch.tsx';
import { TableExplorer } from './components/TableExplorer.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { CognitiveAuditView } from './components/CognitiveAuditView.tsx';
import { ImportModal } from './components/ImportModal.tsx';
import { ExportModal } from './components/ExportModal.tsx';
import { AIServerConnectModal } from './components/AIServerConnectModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import {
  Server,
  Zap,
  RefreshCw,
  Plus,
  Radio,
  CheckCircle2,
  X,
  Cpu,
  Terminal,
  Play,
  Copy,
  Check,
  Shield,
  Sliders,
  Sparkles,
} from 'lucide-react';

import {
  NormalizedMemoryRecord,
  SourceConfig,
  ProjectionPoint,
  ClusterInfo,
  ProjectionAlgorithm,
  SnapshotDiff,
  AIServerConfig,
  ConnectionMode,
  SubMemoryNode,
} from './types/memory.ts';

import {
  expandMemoryRecord,
  computeVirtualReach,
} from './services/adapters/memoryExpansionEngine.ts';

import {
  PRESET_SOURCES,
  getSampleRecords,
  getSampleSnapshots,
} from './services/adapters/sampleDatasets.ts';

import { computePCA } from './services/projection/pca.ts';
import { computeUMAP } from './services/projection/umap.ts';
import { runKMeans } from './services/clustering/kmeans.ts';
import { runDBSCAN } from './services/clustering/dbscan.ts';
import { cosineSimilarity } from './services/projection/vectorMath.ts';
import { compareSnapshots } from './services/history/diffEngine.ts';

export default function App() {
  // Sources
  const [sources, setSources] = useState<SourceConfig[]>(PRESET_SOURCES);
  const [activeSourceId, setActiveSourceId] = useState<string>('source_real_10k');
  const [densityScale, setDensityScale] = useState<number>(1.0);
  const [vectorTargetCount, setVectorTargetCount] = useState<number>(2500);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('all');
  const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(new Set());
  const [expandedSubMemories, setExpandedSubMemories] = useState<Map<string, SubMemoryNode[]>>(new Map());
  const [records, setRecords] = useState<NormalizedMemoryRecord[]>(() =>
    getSampleRecords('source_real_10k', 2500, 1.0)
  );

  // Active View Tab
  const [activeView, setActiveView] = useState<'map2d' | 'map3d' | 'table' | 'history' | 'audit'>('map2d');

  // Selected Memory
  const [selectedRecord, setSelectedRecord] = useState<NormalizedMemoryRecord | null>(null);

  // Projection and Clustering Settings
  const [algorithm, setAlgorithm] = useState<ProjectionAlgorithm>('umap');
  const [colorBy, setColorBy] = useState<'cluster' | 'type' | 'source'>('cluster');
  const [isRecomputing, setIsRecomputing] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'hybrid' | 'lexical' | 'vector'>('hybrid');
  const [minSimilarity, setMinSimilarity] = useState(65);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAIServerModalOpen, setIsAIServerModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // AI Server Connection State
  const [connectedAIServer, setConnectedAIServer] = useState<AIServerConfig | null>(null);
  const [isSyncingAI, setIsSyncingAI] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Inject Memory Modal State
  const [isInjectModalOpen, setIsInjectModalOpen] = useState(false);
  const [injectContent, setInjectContent] = useState('');
  const [injectType, setInjectType] = useState<'working' | 'procedural' | 'semantic' | 'profile' | 'system'>('working');
  const [isInjecting, setIsInjecting] = useState(false);

  // History & Snapshots
  const [snapshotCount, setSnapshotCount] = useState(2);
  const [customDiff, setCustomDiff] = useState<SnapshotDiff | null>(null);

  // SSH Terminal State
  const [isSSHTerminalOpen, setIsSSHTerminalOpen] = useState(false);
  const [sshCommand, setSshCommand] = useState('ollama list');
  const [sshTerminalOutput, setSshTerminalOutput] = useState<{ stdout: string; stderr: string; code: number } | null>(null);
  const [isExecutingSSH, setIsExecutingSSH] = useState(false);

  // Handle connecting to a live or simulated local/remote AI agent server
  const handleConnectAIServer = async (config: AIServerConfig) => {
    setConnectedAIServer(config);
    setIsSyncingAI(true);

    try {
      const isSSH = config.serverType === 'ssh_agent';
      const endpoint = isSSH ? '/api/ai-server/ssh/fetch' : '/api/ai-server/fetch';
      const payload = isSSH
        ? {
            host: config.sshConfig?.host,
            port: config.sshConfig?.port,
            username: config.sshConfig?.username,
            authType: config.sshConfig?.authType,
            password: config.sshConfig?.password,
            privateKey: config.sshConfig?.privateKey,
            passphrase: config.sshConfig?.passphrase,
            remoteAgentType: config.sshConfig?.remoteAgentType,
            remotePort: config.sshConfig?.remotePort,
            activeModel: config.activeModel,
            activeSessionId: config.activeSessionId,
          }
        : {
            serverType: config.serverType,
            endpointUrl: config.endpointUrl,
            apiKey: config.apiKey,
            activeModel: config.activeModel,
            activeSessionId: config.activeSessionId,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.memories && Array.isArray(data.memories)) {
        const desc = isSSH
          ? `SSH LAN Agent (${config.sshConfig?.username}@${config.sshConfig?.host}:${config.sshConfig?.port} -> :${config.sshConfig?.remotePort}) • ${config.activeModel || 'llama3.2'}`
          : `${config.serverType.toUpperCase()} Agent (${config.activeModel || 'llama3.2'}) • ${config.endpointUrl}`;

        const serverSource: SourceConfig = {
          id: config.id,
          name: config.name,
          type: 'ai_server',
          description: desc,
          status: 'connected',
          capabilities: {
            hasEmbeddings: true,
            embeddingDimension: 64,
            embeddingModel: `${config.activeModel || 'Local Agent'} (SSH 64d latent space)`,
            supportsPagination: true,
            supportsFiltering: true,
            supportsRetrievalHistory: true,
            supportsRealtimeSync: config.autoSync,
            isReadOnly: false,
            recordCount: data.memories.length,
          },
          lastSyncedAt: new Date().toISOString(),
        };

        setSources(prev => [serverSource, ...prev.filter(s => s.id !== config.id)]);
        setActiveSourceId(config.id);
        setRecords(data.memories);
        setLastSyncTime(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Failed to fetch from AI server:', err);
    } finally {
      setIsSyncingAI(false);
    }
  };

  // Manual or periodic sync for AI server
  const handleSyncAIServer = useCallback(async () => {
    if (!connectedAIServer) return;
    setIsSyncingAI(true);
    try {
      const isSSH = connectedAIServer.serverType === 'ssh_agent';
      const endpoint = isSSH ? '/api/ai-server/ssh/fetch' : '/api/ai-server/fetch';
      const payload = isSSH
        ? {
            host: connectedAIServer.sshConfig?.host,
            port: connectedAIServer.sshConfig?.port,
            username: connectedAIServer.sshConfig?.username,
            authType: connectedAIServer.sshConfig?.authType,
            password: connectedAIServer.sshConfig?.password,
            privateKey: connectedAIServer.sshConfig?.privateKey,
            passphrase: connectedAIServer.sshConfig?.passphrase,
            remoteAgentType: connectedAIServer.sshConfig?.remoteAgentType,
            remotePort: connectedAIServer.sshConfig?.remotePort,
            activeModel: connectedAIServer.activeModel,
            activeSessionId: connectedAIServer.activeSessionId,
          }
        : {
            serverType: connectedAIServer.serverType,
            endpointUrl: connectedAIServer.endpointUrl,
            apiKey: connectedAIServer.apiKey,
            activeModel: connectedAIServer.activeModel,
            activeSessionId: connectedAIServer.activeSessionId,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.memories && Array.isArray(data.memories)) {
        setRecords(data.memories);
        setLastSyncTime(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.warn('Sync failed:', err);
    } finally {
      setIsSyncingAI(false);
    }
  }, [connectedAIServer]);

  // Execute interactive SSH command on remote LAN machine
  const handleExecuteSSHCommand = async (cmdToRun?: string) => {
    if (!connectedAIServer?.sshConfig) return;
    const targetCmd = (cmdToRun || sshCommand).trim();
    if (!targetCmd) return;
    setIsExecutingSSH(true);
    try {
      const res = await fetch('/api/ai-server/ssh/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: connectedAIServer.sshConfig.host,
          port: connectedAIServer.sshConfig.port,
          username: connectedAIServer.sshConfig.username,
          password: connectedAIServer.sshConfig.password,
          privateKey: connectedAIServer.sshConfig.privateKey,
          command: targetCmd,
        }),
      });
      const data = await res.json();
      setSshTerminalOutput({
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        code: data.code ?? 0,
      });
    } catch (e: any) {
      setSshTerminalOutput({
        stdout: '',
        stderr: e.message || 'SSH execution error',
        code: 1,
      });
    } finally {
      setIsExecutingSSH(false);
    }
  };

  // Real-time polling effect when autoSync is enabled
  useEffect(() => {
    if (!connectedAIServer || !connectedAIServer.autoSync) return;
    const interval = Math.max(connectedAIServer.syncIntervalSec || 10, 5) * 1000;
    const timer = setInterval(() => {
      handleSyncAIServer();
    }, interval);

    return () => clearInterval(timer);
  }, [connectedAIServer, handleSyncAIServer]);

  // Listen for native desktop menu events (Ctrl+O, Ctrl+S, Ctrl+,, etc.)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.desktopBridge?.onMenuAction) {
      const cleanup = window.desktopBridge.onMenuAction((action: string) => {
        switch (action) {
          case 'open-import':
            setIsImportModalOpen(true);
            break;
          case 'open-export':
            setIsExportModalOpen(true);
            break;
          case 'open-connect':
            setIsAIServerModalOpen(true);
            break;
          case 'open-settings':
            setIsSettingsModalOpen(true);
            break;
          case 'view-map2d':
            setActiveView('map2d');
            break;
          case 'view-map3d':
            setActiveView('map3d');
            break;
          case 'view-table':
            setActiveView('table');
            break;
          case 'view-history':
            setActiveView('history');
            break;
          case 'view-audit':
            setActiveView('audit');
            break;
          case 'recompute':
            handleRecompute();
            break;
        }
      });
      return cleanup;
    }
  }, []);

  // Inject memory turn directly into active AI agent
  const handleInjectMemory = async () => {
    if (!injectContent.trim()) return;
    setIsInjecting(true);
    try {
      const res = await fetch('/api/ai-server/add-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverType: connectedAIServer?.serverType || 'ollama',
          content: injectContent.trim(),
          memoryType: injectType,
          agentModel: connectedAIServer?.activeModel || 'llama3.2:latest',
        }),
      });

      if (res.ok) {
        setInjectContent('');
        setIsInjectModalOpen(false);
        // Refresh memory stream
        await handleSyncAIServer();
      }
    } catch (e) {
      console.error('Error injecting memory:', e);
    } finally {
      setIsInjecting(false);
    }
  };

  // Update records when active source changes
  const handleSelectSource = (sourceId: string) => {
    setActiveSourceId(sourceId);
    setSelectedRecord(null);

    const preset = PRESET_SOURCES.find(s => s.id === sourceId);
    if (preset) {
      setRecords(getSampleRecords(sourceId, vectorTargetCount, densityScale));
    }
  };

  // Adjust vector density volume (1,000 to 10,000 vectors)
  const handleVectorCountChange = (count: number) => {
    setVectorTargetCount(count);
    if (activeSourceId === 'source_real_10k') {
      setRecords(getSampleRecords('source_real_10k', count, densityScale));
    }
  };

  // Adjust density scale / cluster dispersion
  const handleDensityScaleChange = (scale: number) => {
    setDensityScale(scale);
    if (activeSourceId === 'source_real_10k') {
      setRecords(getSampleRecords('source_real_10k', vectorTargetCount, scale));
    }
  };

  // Recompute projections
  const handleRecompute = () => {
    setIsRecomputing(true);
    setTimeout(() => {
      setIsRecomputing(false);
    }, 400);
  };

  // Compute Clusters
  const { clusters, clusterMap } = useMemo(() => {
    const km = runKMeans(records, 4);
    return {
      clusters: km.clusters,
      clusterMap: km.assignments,
    };
  }, [records]);

  // Compute 2D and 3D Projection Points
  const points: ProjectionPoint[] = useMemo(() => {
    const validVectors = records
      .filter(r => r.embedding && r.embedding.length > 0)
      .map(r => ({ id: r.id, embedding: r.embedding! }));

    if (validVectors.length === 0) return [];

    let projected: Array<{ id: string; x: number; y: number; z?: number }>;
    if (algorithm === 'umap') {
      projected = computeUMAP(validVectors, {
        targetDims: 3,
        nNeighbors: 8,
        iterations: 60,
        densityScale,
      });
    } else {
      projected = computePCA(validVectors, 3, densityScale).points;
    }

    const recMap = new Map<string, NormalizedMemoryRecord>();
    records.forEach(r => recMap.set(r.id, r));

    return projected.map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      clusterId: clusterMap.get(p.id) ?? 0,
      record: recMap.get(p.id)!,
    }));
  }, [records, algorithm, clusterMap, densityScale, isRecomputing]);

  // Hierarchical Sub-Memory Expansion Actions (100k - 1,000,000 virtual reach)
  const handleToggleExpandRecord = useCallback((recordId: string) => {
    setExpandedRecordIds(prev => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
        const targetRec = records.find(r => r.id === recordId);
        if (targetRec) {
          setExpandedSubMemories(m => {
            const nextMap = new Map(m);
            if (!nextMap.has(recordId)) {
              nextMap.set(recordId, expandMemoryRecord(targetRec, 16));
            }
            return nextMap;
          });
        }
      }
      return next;
    });
  }, [records]);

  const handleExpandCluster = useCallback((clusterId: number) => {
    const clusterPoints = points.filter(p => p.clusterId === clusterId).slice(0, 24);
    setExpandedRecordIds(prev => {
      const next = new Set(prev);
      clusterPoints.forEach(p => next.add(p.id));
      return next;
    });
    setExpandedSubMemories(prev => {
      const next = new Map(prev);
      clusterPoints.forEach(p => {
        if (!next.has(p.id)) {
          next.set(p.id, expandMemoryRecord(p.record, 16));
        }
      });
      return next;
    });
  }, [points]);

  const handleCollapseAll = useCallback(() => {
    setExpandedRecordIds(new Set());
    setExpandedSubMemories(new Map());
  }, []);

  const reachMetrics = useMemo(() => {
    return computeVirtualReach(records.length, expandedRecordIds.size, 100);
  }, [records.length, expandedRecordIds.size]);

  // Filtered records & highlighted points
  const { filteredRecords, highlightedIds } = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const highlights = new Set<string>();

    const filtered = records.filter(r => {
      // Memory type filter
      if (selectedType && r.memoryType !== selectedType) {
        return false;
      }

      // Cluster filter
      if (selectedClusterId !== null) {
        const cId = clusterMap.get(r.id);
        if (cId !== selectedClusterId) return false;
      }

      // Search query filter
      if (query) {
        let isMatch = false;

        if (searchMode === 'lexical' || searchMode === 'hybrid') {
          const contentMatch = r.content.toLowerCase().includes(query);
          const metaMatch = JSON.stringify(r.metadata).toLowerCase().includes(query);
          if (contentMatch || metaMatch) {
            isMatch = true;
          }
        }

        if (!isMatch && (searchMode === 'vector' || searchMode === 'hybrid')) {
          // If query matches any word, or if we have selected record, compare cosine
          if (selectedRecord && selectedRecord.embedding && r.embedding) {
            const sim = (cosineSimilarity(selectedRecord.embedding, r.embedding) + 1) / 2;
            if (sim >= minSimilarity / 100) {
              isMatch = true;
            }
          } else {
            // General lexical fallback
            isMatch = r.content.toLowerCase().includes(query);
          }
        }

        if (isMatch) {
          highlights.add(r.id);
          return true;
        }
        return false;
      }

      return true;
    });

    return { filteredRecords: filtered, highlightedIds: highlights };
  }, [
    records,
    searchQuery,
    searchMode,
    minSimilarity,
    selectedType,
    selectedClusterId,
    clusterMap,
    selectedRecord,
  ]);

  // Handle new source imported via modal
  const handleImportSource = (newSource: SourceConfig, rawData?: string, mapping?: any) => {
    setSources(prev => [newSource, ...prev.filter(s => s.id !== newSource.id)]);
    setActiveSourceId(newSource.id);
    setSelectedRecord(null);

    if (newSource.isPreset) {
      setRecords(getSampleRecords(newSource.id));
      return;
    }

    if (newSource.type === 'json' && rawData) {
      try {
        const parsed = JSON.parse(rawData);
        const list = Array.isArray(parsed) ? parsed : parsed.records || [parsed];
        const normalized = list.map((item: any, i: number) => ({
          id: String(item.id || `imported_${i + 1}`),
          sourceId: newSource.id,
          content: item.content || item.text || '[Unavailable]',
          contentAvailable: !!(item.content || item.text),
          embedding: Array.isArray(item.embedding || item.vector) ? item.embedding || item.vector : null,
          embeddingDimension: Array.isArray(item.embedding || item.vector) ? (item.embedding || item.vector).length : undefined,
          metadata: item.metadata || {},
          createdAt: item.createdAt || new Date().toISOString(),
          memoryType: item.memoryType || 'semantic',
        }));
        setRecords(normalized);
      } catch (e) {
        console.error(e);
      }
    } else if (newSource.type === 'csv' && rawData && mapping) {
      // Ingested via CSVMemoryAdapter
      const lines = rawData.split('\n');
      const norm = lines.slice(1).map((l, i) => ({
        id: `csv_${i + 1}`,
        sourceId: newSource.id,
        content: l,
        contentAvailable: true,
        embedding: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        memoryType: 'semantic' as const,
      }));
      setRecords(norm);
    }
  };

  // Diff Engine Calculation for History View
  const diff = useMemo(() => {
    if (customDiff) return customDiff;
    const { snapshotA, snapshotB } = getSampleSnapshots();
    return compareSnapshots(
      { id: 'snap_base', name: 'Base Agent Snapshot', timestamp: '2026-10-10T12:00:00Z', records: snapshotA },
      { id: 'snap_latest', name: 'Current Evolved State', timestamp: '2026-10-17T18:00:00Z', records: snapshotB }
    );
  }, [customDiff]);

  const handleTakeSnapshot = () => {
    const count = snapshotCount + 1;
    setSnapshotCount(count);
    const newDiff = compareSnapshots(
      { id: 'snap_prev', name: `Snapshot v${count - 1}`, timestamp: new Date(Date.now() - 3600000).toISOString(), records },
      { id: 'snap_curr', name: `Snapshot v${count} (Live)`, timestamp: new Date().toISOString(), records }
    );
    setCustomDiff(newDiff);
  };

  const currentSourceName = sources.find(s => s.id === activeSourceId)?.name || 'Agent Memory';

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Application Header */}
      <Header
        sources={sources}
        activeSourceId={activeSourceId}
        onSelectSource={handleSelectSource}
        activeView={activeView}
        onChangeView={setActiveView}
        onOpenImport={() => setIsImportModalOpen(true)}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenAIServer={() => setIsAIServerModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onRecompute={handleRecompute}
        isRecomputing={isRecomputing}
        totalRecords={records.length}
        totalClusters={clusters.length}
        connectedAIServerName={connectedAIServer?.name}
      />

      {/* Live AI Agent Server Status Bar */}
      {connectedAIServer && (
        <div className="bg-slate-900/95 border-b border-cyan-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-cyan-300 flex items-center gap-1.5 font-sans">
                {connectedAIServer.serverType === 'ssh_agent' ? (
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                ) : (
                  <Server className="w-3.5 h-3.5" />
                )}
                <span>{connectedAIServer.name}</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/50">
                {connectedAIServer.activeModel || 'llama3.2'}
              </span>
              {connectedAIServer.serverType === 'ssh_agent' && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-indigo-400" />
                  <span>SSH LAN Tunnel</span>
                </span>
              )}
              <span className="text-slate-500 text-[11px] font-mono hidden sm:inline">
                {connectedAIServer.endpointUrl}
              </span>
              {connectedAIServer.latencyMs && (
                <span className="text-emerald-400 font-mono text-[11px] bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/40">
                  {connectedAIServer.latencyMs}ms
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastSyncTime && (
              <span className="text-slate-400 text-[11px] hidden md:inline">
                Synced: <span className="font-mono text-slate-300">{lastSyncTime}</span>
              </span>
            )}
            <button
              onClick={handleSyncAIServer}
              disabled={isSyncingAI}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Poll latest memories from AI agent"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncingAI ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{isSyncingAI ? 'Syncing...' : 'Sync'}</span>
            </button>
            {connectedAIServer.serverType === 'ssh_agent' && (
              <button
                onClick={() => {
                  setIsSSHTerminalOpen(true);
                  if (!sshTerminalOutput) handleExecuteSSHCommand('ollama list');
                }}
                className="px-2.5 py-1 rounded bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-200 text-xs font-medium border border-cyan-500/40 flex items-center gap-1.5 transition-all"
                title="Run SSH commands on remote host"
              >
                <Terminal className="w-3 h-3 text-cyan-400" />
                <span>SSH Terminal</span>
              </button>
            )}
            <button
              onClick={() => setIsInjectModalOpen(true)}
              className="px-2.5 py-1 rounded bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-200 text-xs font-medium border border-cyan-500/40 flex items-center gap-1.5 transition-all"
              title="Add a scratchpad note or observation to agent memory"
            >
              <Plus className="w-3 h-3 text-cyan-400" />
              <span>Inject Memory Turn</span>
            </button>
            <button
              onClick={() => setIsAIServerModalOpen(true)}
              className="px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs"
              title="Change server settings or switch model"
            >
              Configure
            </button>
          </div>
        </div>
      )}

      {/* Architecture & High-Density Memory Vector Control Strip */}
      {(activeView === 'map2d' || activeView === 'map3d' || activeView === 'table') && (
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Vector Density Volume Slider (1,000 to 10,000 vectors) */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-indigo-400 font-semibold font-sans">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>Vector Density:</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1000"
                max="10000"
                step="500"
                value={vectorTargetCount}
                onChange={e => handleVectorCountChange(parseInt(e.target.value, 10))}
                className="w-28 sm:w-36 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
                title="Adjust memory vectors displayed at once (1,000 to 10,000)"
                aria-label="Memory vector density slider"
              />
              <span className="font-mono font-bold text-cyan-400 text-xs min-w-[70px]">
                {records.length.toLocaleString()} vectors
              </span>
            </div>

            {/* Quick Volume Preset Pills */}
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
              {[1000, 2500, 5000, 10000].map(cnt => (
                <button
                  key={cnt}
                  onClick={() => {
                    if (activeSourceId !== 'source_real_10k') {
                      setActiveSourceId('source_real_10k');
                    }
                    handleVectorCountChange(cnt);
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    records.length === cnt
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={`Map ${cnt.toLocaleString()} memory vectors`}
                >
                  {cnt >= 1000 ? `${cnt / 1000}k` : cnt}
                </button>
              ))}
            </div>

            {/* Virtual Memory Reach Badge (Hierarchical LOD) */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-700/50 text-[11px] font-mono text-indigo-300">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Reach: <strong className="text-white">{reachMetrics.totalVirtualReach.toLocaleString()}</strong> virtual</span>
              {expandedRecordIds.size > 0 && (
                <span className="ml-1 px-1 rounded bg-indigo-900 text-[10px] text-amber-300 font-bold">
                  {expandedRecordIds.size} expanded ({reachMetrics.materializedSubCount} micro)
                </span>
              )}
            </div>
          </div>

          {/* Connections & Density Scale / Dispersion Slider */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Connection Mode Toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
                <span>Synapses:</span>
              </span>
              <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px]">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'explicit', label: 'Explicit' },
                    { id: 'cluster', label: 'Clusters' },
                    { id: 'focused', label: 'Focused' },
                    { id: 'off', label: 'Off' },
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setConnectionMode(opt.id)}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      connectionMode === opt.id
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Density Scale */}
            <div className="flex items-center gap-1.5 text-slate-300">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400 text-[11px]">Density Scale:</span>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.05"
                value={densityScale}
                onChange={e => handleDensityScaleChange(parseFloat(e.target.value))}
                className="w-16 sm:w-24 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-400"
                title="Scale cluster density & spatial dispersion (0.5x to 2.5x)"
                aria-label="Density scale slider"
              />
              <span className="font-mono text-cyan-400 text-[11px] w-9">{densityScale.toFixed(2)}x</span>
            </div>

            {/* Collapse All button when active */}
            {expandedRecordIds.size > 0 && (
              <button
                onClick={handleCollapseAll}
                className="px-2 py-0.5 rounded bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border border-amber-700/60 text-[11px] font-medium transition-colors"
                title="Collapse all expanded memory sub-manifolds"
              >
                Collapse All
              </button>
            )}

            {/* Telemetry info */}
            <div className="hidden xl:flex items-center gap-2 px-2 py-0.5 rounded bg-slate-950 border border-slate-800/80 text-[11px] font-mono text-slate-400">
              <span className="text-emerald-400">● 60 FPS</span>
              <span className="text-slate-600">|</span>
              <span className="text-indigo-400">{clusters.length} Clusters</span>
            </div>
          </div>
        </div>
      )}

      {/* Similarity Search & Filters Subheader (shown on 2D, 3D, and Table views) */}
      {(activeView === 'map2d' || activeView === 'map3d' || activeView === 'table') && (
        <SimilaritySearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchMode={searchMode}
          onSearchModeChange={setSearchMode}
          minSimilarity={minSimilarity}
          onMinSimilarityChange={setMinSimilarity}
          selectedType={selectedType}
          onSelectType={setSelectedType}
          selectedClusterId={selectedClusterId}
          onSelectClusterId={setSelectedClusterId}
          clusters={clusters}
          matchCount={filteredRecords.length}
          totalCount={records.length}
        />
      )}

      {/* Main Workspace Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* VIEW 1: 2D Semantic Map */}
        {activeView === 'map2d' && (
          <SemanticMap2D
            points={points}
            clusters={clusters}
            selectedRecordId={selectedRecord?.id || null}
            onSelectRecord={setSelectedRecord}
            highlightedIds={highlightedIds}
            algorithm={algorithm}
            onAlgorithmChange={setAlgorithm}
            colorBy={colorBy}
            onChangeColorBy={setColorBy}
            densityScale={densityScale}
            onDensityScaleChange={handleDensityScaleChange}
            connectionMode={connectionMode}
            onChangeConnectionMode={setConnectionMode}
            expandedRecordIds={expandedRecordIds}
            expandedSubMemories={expandedSubMemories}
            onToggleExpandRecord={handleToggleExpandRecord}
            onExpandCluster={handleExpandCluster}
            onCollapseAll={handleCollapseAll}
          />
        )}

        {/* VIEW 2: 3D Semantic Landscape */}
        {activeView === 'map3d' && (
          <SemanticMap3D
            points={points}
            clusters={clusters}
            selectedRecordId={selectedRecord?.id || null}
            onSelectRecord={setSelectedRecord}
            colorBy={colorBy}
            densityScale={densityScale}
            onDensityScaleChange={handleDensityScaleChange}
            connectionMode={connectionMode}
            onChangeConnectionMode={setConnectionMode}
            expandedRecordIds={expandedRecordIds}
            expandedSubMemories={expandedSubMemories}
            onToggleExpandRecord={handleToggleExpandRecord}
            onExpandCluster={handleExpandCluster}
            onCollapseAll={handleCollapseAll}
          />
        )}

        {/* VIEW 3: Tabular Ledger */}
        {activeView === 'table' && (
          <TableExplorer
            records={filteredRecords}
            selectedRecordId={selectedRecord?.id || null}
            onSelectRecord={setSelectedRecord}
            clustersMap={clusterMap}
          />
        )}

        {/* VIEW 4: Memory History & Snapshot Diff */}
        {activeView === 'history' && (
          <HistoryView
            diff={diff}
            onSelectRecord={setSelectedRecord}
            onTakeSnapshot={handleTakeSnapshot}
            snapshotsCount={snapshotCount}
          />
        )}

        {/* VIEW 5: Cognitive Audit with High Thinking Mode */}
        {activeView === 'audit' && (
          <CognitiveAuditView
            records={records}
            sourceName={currentSourceName}
            onSelectRecord={setSelectedRecord}
          />
        )}

        {/* Sliding Memory Inspector (Available across all views) */}
        <MemoryInspector
          record={selectedRecord}
          allRecords={records}
          onSelectRecord={setSelectedRecord}
          onClose={() => setSelectedRecord(null)}
          isExpanded={selectedRecord ? expandedRecordIds.has(selectedRecord.id) : false}
          onToggleExpand={handleToggleExpandRecord}
          subMemories={selectedRecord ? (expandedSubMemories.get(selectedRecord.id) || []) : []}
        />
      </main>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSource={handleImportSource}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        records={records}
        points={points}
        clusters={clusters}
        sourceName={currentSourceName}
      />

      {/* AI Server Connect Modal (Ollama, LM Studio, LangGraph, Mem0, Remote) */}
      <AIServerConnectModal
        isOpen={isAIServerModalOpen}
        onClose={() => setIsAIServerModalOpen(false)}
        onConnectServer={handleConnectAIServer}
        currentConnectedServer={connectedAIServer}
      />

      {/* Inject Memory Turn Dialog for Connected AI Agent */}
      {isInjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Cpu className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-100 font-sans">
                  Inject Memory Turn into Agent Stream
                </h3>
              </div>
              <button
                onClick={() => setIsInjectModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Memory / Observation Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['working', 'procedural', 'semantic', 'profile', 'system'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setInjectType(type)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs capitalize font-medium border text-center transition-all ${
                        injectType === type
                          ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-300 ring-1 ring-cyan-500/30'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Memory Content / Scratchpad Thought
                </label>
                <textarea
                  rows={4}
                  value={injectContent}
                  onChange={e => setInjectContent(e.target.value)}
                  placeholder="e.g. Agent observed high CPU usage on auth-service; identified memory leak in jwt validation worker..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 text-xs outline-none focus:border-cyan-500 font-sans resize-none leading-relaxed"
                />
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                This will immediately compute high-dimensional latent vectors and inject the node into the live 2D/3D semantic landscape, allowing instant inspection.
              </p>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-900/90">
              <button
                type="button"
                onClick={() => setIsInjectModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInjectMemory}
                disabled={isInjecting || !injectContent.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-cyan-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isInjecting ? 'Injecting...' : 'Inject into Memory Stream'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Interactive SSH Command Terminal Modal */}
      {isSSHTerminalOpen && connectedAIServer?.sshConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-sans flex items-center gap-2">
                    <span>Remote SSH Terminal</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {connectedAIServer.sshConfig.username}@{connectedAIServer.sshConfig.host}:{connectedAIServer.sshConfig.port}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Execute shell diagnostics or inspect agent processes directly on the remote machine
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSSHTerminalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 flex-1 overflow-y-auto text-xs">
              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-slate-400 font-medium">Quick Presets:</span>
                {[
                  'ollama list',
                  'nvidia-smi',
                  'uname -a',
                  'curl -s http://localhost:11434/api/tags',
                  'ps aux | grep -E "ollama|python|vllm"',
                ].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setSshCommand(preset);
                      handleExecuteSSHCommand(preset);
                    }}
                    className="font-mono text-[10px] px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-cyan-300 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Command Input Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 flex items-center">
                  <span className="absolute left-3 text-cyan-500 font-mono text-xs select-none">$</span>
                  <input
                    type="text"
                    value={sshCommand}
                    onChange={e => setSshCommand(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleExecuteSSHCommand();
                    }}
                    placeholder="Enter bash command to execute on remote host..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-2 text-slate-100 font-mono text-xs outline-none focus:border-cyan-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleExecuteSSHCommand()}
                  disabled={isExecutingSSH || !sshCommand.trim()}
                  className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${isExecutingSSH ? 'animate-spin' : ''}`} />
                  <span>{isExecutingSSH ? 'Running...' : 'Execute'}</span>
                </button>
              </div>

              {/* Output Display */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-200 overflow-x-auto min-h-[160px] max-h-[300px] whitespace-pre select-all leading-relaxed">
                {isExecutingSSH ? (
                  <div className="flex items-center gap-2 text-cyan-400 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing command over SSH channel...</span>
                  </div>
                ) : sshTerminalOutput ? (
                  <div>
                    {sshTerminalOutput.stdout && (
                      <div className="text-slate-100">{sshTerminalOutput.stdout}</div>
                    )}
                    {sshTerminalOutput.stderr && (
                      <div className="text-rose-400 mt-2">{sshTerminalOutput.stderr}</div>
                    )}
                    <div className="text-slate-500 text-[10px] mt-2 pt-2 border-t border-slate-900">
                      Process completed with exit code: {sshTerminalOutput.code}
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500 italic">
                    Output from the remote SSH agent will appear here...
                  </span>
                )}
              </div>
            </div>

            <div className="px-5 py-2.5 border-t border-slate-800 flex items-center justify-between bg-slate-900/90 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Encrypted SSH Channel</span>
              </span>
              <button
                type="button"
                onClick={() => setIsSSHTerminalOpen(false)}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Application Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        defaultAlgorithm={algorithm}
        onChangeDefaultAlgorithm={setAlgorithm}
        densityScale={densityScale}
        onChangeDensityScale={handleDensityScaleChange}
        vectorTargetCount={vectorTargetCount}
        onChangeVectorTargetCount={handleVectorCountChange}
        onClearCache={() => {
          setSelectedRecord(null);
          handleRecompute();
        }}
      />
    </div>
  );
}
