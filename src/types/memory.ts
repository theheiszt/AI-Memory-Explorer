/**
 * AI Memory Explorer - Core Type Definitions
 * Normalized memory model according to FR-01 and FR-02 specifications.
 */

export type SourceType =
  | 'json'
  | 'jsonl'
  | 'csv'
  | 'sqlite'
  | 'qdrant'
  | 'chroma'
  | 'rest'
  | 'preset'
  | 'ai_server';

export type AIServerType =
  | 'ollama'
  | 'openai_compatible'
  | 'langgraph'
  | 'mem0'
  | 'custom_agent'
  | 'ssh_agent';

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'private_key';
  password?: string;
  privateKey?: string;
  passphrase?: string;
  remoteAgentType: 'ollama' | 'openai_compatible' | 'langgraph' | 'custom_agent' | 'file_dump' | 'command';
  remotePort?: number;
  remoteFilePath?: string;
  remoteCommand?: string;
  tunnelEstablished?: boolean;
}

export interface AIServerConfig {
  id: string;
  name: string;
  serverType: AIServerType;
  endpointUrl: string;
  apiKey?: string;
  activeModel?: string;
  activeSessionId?: string;
  availableModels?: string[];
  availableSessions?: string[];
  latencyMs?: number;
  status: 'online' | 'offline' | 'connecting' | 'error';
  errorMessage?: string;
  autoSync: boolean;
  syncIntervalSec: number;
  sshConfig?: SSHConfig;
}

export interface RetrievalEvent {
  id: string;
  timestamp: string;
  query: string;
  similarityScore: number;
  rank?: number;
  callerAgent?: string;
  context?: string;
}

export interface ExplicitRelation {
  targetId: string;
  relationType: 'causes' | 'contradicts' | 'supersedes' | 'references' | 'derived_from' | 'associates_with';
  strength?: number;
  note?: string;
}

export interface NormalizedMemoryRecord {
  /** Stable unique identifier across imports */
  id: string;
  /** Identifying which source or adapter ingested this memory */
  sourceId: string;
  /** Original text content or clearly marked unavailable state */
  content: string;
  /** Content availability flag */
  contentAvailable: boolean;
  /** High-dimensional vector embedding or null if missing */
  embedding: number[] | null;
  /** Name/identifier of embedding model used if known */
  embeddingModel?: string;
  /** Dimension of the vector embedding */
  embeddingDimension?: number;
  /** Timestamps */
  createdAt?: string;
  updatedAt?: string;
  /** Category or memory layer (e.g. episodic, semantic, procedural, working) */
  memoryType?: 'episodic' | 'semantic' | 'procedural' | 'working' | 'profile' | 'system' | 'custom';
  /** Freeform key-value metadata preserved without loss */
  metadata: Record<string, unknown>;
  /** Provenance tracking who or what generated this memory */
  provenance?: {
    agentRole?: string;
    agentName?: string;
    sessionId?: string;
    conversationTurn?: number;
    sourceFile?: string;
    rawPayloadSnippet?: string;
  };
  /** Explicit relationships provided natively by the source */
  explicitRelations?: ExplicitRelation[];
  /** Historical retrieval logs, if provided by the source */
  retrievalEvents?: RetrievalEvent[];
  /** Virtual hierarchical expansion multiplier (e.g. 50-100 micro-memories per vector anchor) */
  subMemoriesCount?: number;
  /** Dynamically instantiated sub-memory nodes when this record is expanded */
  subMemories?: SubMemoryNode[];
}

export type ConnectionMode = 'all' | 'explicit' | 'cluster' | 'focused' | 'off';

export interface SubMemoryNode {
  id: string;
  parentId: string;
  title: string;
  detail: string;
  subType: 'sub_token' | 'micro_episode' | 'proposition' | 'causal_step' | 'child_embedding';
  relativeOffset: [number, number, number];
  embedding: number[];
  attentionWeight: number;
  similarityToParent: number;
  tokensCount: number;
  order: number;
}

export interface MemoryConnection {
  sourceId: string;
  targetId: string;
  connectionType: 'explicit' | 'semantic' | 'causal' | 'temporal' | 'sub_memory';
  weight: number;
}

export interface SourceCapabilities {
  hasEmbeddings: boolean;
  embeddingDimension?: number;
  embeddingModel?: string;
  supportsPagination: boolean;
  supportsFiltering: boolean;
  supportsRetrievalHistory: boolean;
  supportsRealtimeSync: boolean;
  isReadOnly: boolean;
  recordCount: number;
}

export interface SourceConfig {
  id: string;
  name: string;
  type: SourceType;
  endpoint?: string;
  filePath?: string;
  description?: string;
  isPreset?: boolean;
  capabilities: SourceCapabilities;
  lastSyncedAt?: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  errorMessage?: string;
  /** Custom field mapping for CSV / SQLite */
  fieldMapping?: {
    idField: string;
    contentField: string;
    embeddingField?: string;
    timestampField?: string;
    typeField?: string;
    metadataFields?: string[];
  };
}

export interface ProjectionPoint {
  id: string;
  x: number;
  y: number;
  z?: number;
  clusterId: number;
  record: NormalizedMemoryRecord;
}

export type ProjectionAlgorithm = 'umap' | 'pca';

export interface ProjectionSettings {
  algorithm: ProjectionAlgorithm;
  dimensions: 2 | 3;
  nNeighbors: number;
  minDist: number;
  iterations: number;
  metric: 'cosine' | 'euclidean';
}

export interface ClusterInfo {
  id: number;
  label: string;
  color: string;
  count: number;
  memberIds: string[];
  centroid: [number, number, number?];
  representativeMemoryId?: string;
  isInferred: boolean;
}

export interface ClusteringSettings {
  method: 'kmeans' | 'dbscan';
  k: number; // for kmeans
  eps: number; // for dbscan
  minPts: number; // for dbscan
  filterNoise: boolean;
}

export interface MemorySnapshot {
  id: string;
  name: string;
  timestamp: string;
  sourceId: string;
  recordCount: number;
  records: NormalizedMemoryRecord[];
  clusterCount: number;
}

export interface SnapshotDiff {
  snapshotA: string;
  snapshotB: string;
  timestampA: string;
  timestampB: string;
  addedRecords: NormalizedMemoryRecord[];
  modifiedRecords: Array<{
    before: NormalizedMemoryRecord;
    after: NormalizedMemoryRecord;
    changes: string[];
  }>;
  removedRecords: NormalizedMemoryRecord[];
  clusterMigrations: Array<{
    recordId: string;
    fromCluster: number;
    toCluster: number;
  }>;
  retrievalFrequencyChanges: Array<{
    recordId: string;
    content: string;
    beforeCount: number;
    afterCount: number;
    delta: number;
  }>;
}

export interface DiagnosticLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  sourceId?: string;
  message: string;
  redactedContext?: Record<string, unknown>;
}

export interface SearchMatch {
  record: NormalizedMemoryRecord;
  score: number; // 0 to 1
  matchType: 'lexical' | 'vector' | 'hybrid' | 'explicit_relation';
  explanation: string;
}

export interface AuditFinding {
  id: string;
  type: 'contradiction' | 'duplicate' | 'knowledge_drift' | 'hallucination' | 'isolated_node';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  involvedMemoryIds: string[];
  suggestedAction: string;
}

export interface AuditResult {
  summary: string;
  findings: AuditFinding[];
  thinkingProcess?: string;
  analyzedCount: number;
  timestamp: string;
}
