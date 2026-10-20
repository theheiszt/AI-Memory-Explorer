/**
 * Stream Graph Type Definitions (Stage 1)
 * Decoupled, stable graph data model for memory topology visualization.
 */

import type { NormalizedMemoryRecord, ClusterInfo } from './memory.ts';

export type StreamGraphNodeKind = 'memory' | 'cluster' | 'source' | 'event';

export interface StreamGraphNode {
  /** Stable unique node identifier (e.g. "node_mem_123" or "cluster_1") */
  id: string;
  /** Primary identifier resolving to original NormalizedMemoryRecord.id */
  memoryId: string;
  /** Primary human-readable label */
  label: string;
  /** Data source identifier */
  sourceId: string;
  /** Concise truncated content preview */
  contentPreview?: string;
  /** Categorical memory type (e.g. 'episodic', 'semantic', 'procedural', 'working', 'profile') */
  category?: string;
  /** Creation timestamp, if available natively from the source */
  timestamp?: string;
  /** Last update timestamp, if available */
  updatedAt?: string;
  /** Embedding model identifier, if known */
  embeddingModel?: string;
  /** Vector dimension if embedding exists */
  embeddingDimension?: number;
  /** Cluster identifier assignment */
  clusterId?: number;
  /** Source metadata preserved without loss */
  metadata?: Record<string, unknown>;
  /** Functional node role in graph */
  nodeKind: StreamGraphNodeKind;
  /** Visibility filter state */
  isVisible: boolean;
  /** Expansion state (for cluster nodes or memory neighborhoods) */
  isExpanded?: boolean;
  /** Count of member memories if this is a cluster node */
  memberCount?: number;
  /** True if node possesses a valid vector embedding */
  hasEmbedding: boolean;

  // Spatial Simulation Properties
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null; // Pinned X
  fy?: number | null; // Pinned Y
  radius: number;
  color: string;
}

export type StreamGraphEdgeType =
  | 'explicit'    // Native causal/contradiction/superseding edges from source
  | 'similarity'  // Inferred cosine nearest neighbor
  | 'temporal'    // Temporal sequence or evolution
  | 'retrieval'   // Recorded agent retrieval event co-occurrence
  | 'cluster';    // Membership link to cluster organization hub

export type EdgeProvenance = 'source' | 'computed' | 'inferred';

export interface StreamGraphEdge {
  /** Deterministic deduplication key */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Functional relationship type */
  type: StreamGraphEdgeType;
  /** Specific relation subtype (e.g. 'causes', 'contradicts', 'supersedes', 'references', 'knn') */
  relation?: string;
  /** Normalized connection weight / spring strength (0.0 to 1.0) */
  weight: number;
  /** Confidence score (0.0 to 1.0) */
  confidence?: number;
  /** Edge provenance source */
  provenance: EdgeProvenance;
  /** Whether the relationship is directed */
  directed: boolean;
}

export type DetailLevel = 'overview' | 'balanced' | 'detailed' | 'maximum';

export interface GraphBuildOptions {
  clusters?: ClusterInfo[];
  clusterMap?: Map<string, number>;
  detailLevel?: DetailLevel;
  similarityThreshold?: number; // 0.0 - 1.0, default 0.70
  maxNeighborsPerNode?: number; // default 3 for detailed, 5 for max
  activeEdgeTypes?: Set<StreamGraphEdgeType>;
  expandedClusterIds?: Set<number>;
  expandedMemoryIds?: Set<string>;
  searchQuery?: string;
  selectedCategory?: string;
  selectedClusterId?: number | null;
  minTimestamp?: string;
  maxTimestamp?: string;
}

export interface StreamGraphData {
  nodes: StreamGraphNode[];
  edges: StreamGraphEdge[];
  nodeMap: Map<string, StreamGraphNode>;
  recordToNodeId: Map<string, string>;
  stats: {
    totalRecords: number;
    recordsWithEmbeddings: number;
    recordsWithoutEmbeddings: number;
    totalClusters: number;
    visibleMemoryNodes: number;
    collapsedRecords: number;
    displayedEdges: number;
    explicitEdgesCount: number;
    similarityEdgesCount: number;
    temporalEdgesCount: number;
    retrievalEdgesCount: number;
    clusterEdgesCount: number;
  };
}
