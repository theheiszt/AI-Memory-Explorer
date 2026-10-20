/**
 * Stream Graph Builder Service (Stage 1)
 * Transforms normalized memory records into a structured, typed, and deduplicated graph data model.
 */

import type { NormalizedMemoryRecord, ClusterInfo } from '../../types/memory.ts';
import type {
  StreamGraphNode,
  StreamGraphEdge,
  StreamGraphData,
  GraphBuildOptions,
  StreamGraphEdgeType,
} from '../../types/streamGraph.ts';
import { cosineSimilarity } from '../projection/vectorMath.ts';

const CATEGORY_COLORS: Record<string, string> = {
  episodic: '#3b82f6',   // Blue
  semantic: '#10b981',   // Emerald
  procedural: '#f59e0b', // Amber
  working: '#ec4899',    // Pink
  profile: '#8b5cf6',    // Purple
  system: '#64748b',     // Slate
  custom: '#06b6d4',     // Cyan
};

const DEFAULT_NODE_COLOR = '#6366f1'; // Indigo

/**
 * Build graph data model from normalized memory records and optional clustering context.
 */
export function buildStreamGraphFromRecords(
  records: NormalizedMemoryRecord[],
  options: GraphBuildOptions = {}
): StreamGraphData {
  const {
    clusters = [],
    clusterMap = new Map<string, number>(),
    detailLevel = 'detailed',
    similarityThreshold = 0.70,
    maxNeighborsPerNode = detailLevel === 'maximum' ? 5 : 3,
    activeEdgeTypes = new Set<StreamGraphEdgeType>(['explicit', 'similarity', 'temporal', 'retrieval', 'cluster']),
    expandedClusterIds = new Set<number>(),
    expandedMemoryIds = new Set<string>(),
    searchQuery = '',
    selectedCategory,
    selectedClusterId = null,
    minTimestamp,
    maxTimestamp,
  } = options;

  const nodeMap = new Map<string, StreamGraphNode>();
  const recordToNodeId = new Map<string, string>();
  const rawRecordMap = new Map<string, NormalizedMemoryRecord>();

  let recordsWithEmbeddings = 0;
  let recordsWithoutEmbeddings = 0;

  // 1. Create Memory Nodes
  for (const record of records) {
    rawRecordMap.set(record.id, record);
    const nodeId = `node_${record.id}`;
    recordToNodeId.set(record.id, nodeId);

    const hasEmbedding = !!(record.embedding && Array.isArray(record.embedding) && record.embedding.length > 0);
    if (hasEmbedding) {
      recordsWithEmbeddings++;
    } else {
      recordsWithoutEmbeddings++;
    }

    const assignedClusterId = clusterMap.get(record.id);

    // Compute preview label safely
    let label = (record.content || '').trim().replace(/\s+/g, ' ');
    if (label.length > 35) {
      label = label.slice(0, 32) + '...';
    }
    if (!label) {
      label = `[Memory ${record.id}]`;
    }

    // Determine category color or cluster color
    let color = DEFAULT_NODE_COLOR;
    if (record.memoryType && CATEGORY_COLORS[record.memoryType]) {
      color = CATEGORY_COLORS[record.memoryType];
    }
    if (assignedClusterId !== undefined && clusters.length > 0) {
      const c = clusters.find(cl => cl.id === assignedClusterId);
      if (c?.color) color = c.color;
    }

    // Determine initial visibility based on filters
    let isVisible = true;
    if (selectedCategory && record.memoryType !== selectedCategory) {
      isVisible = false;
    }
    if (selectedClusterId !== null && assignedClusterId !== selectedClusterId) {
      isVisible = false;
    }
    if (minTimestamp && record.createdAt && record.createdAt < minTimestamp) {
      isVisible = false;
    }
    if (maxTimestamp && record.createdAt && record.createdAt > maxTimestamp) {
      isVisible = false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const contentMatch = (record.content || '').toLowerCase().includes(q);
      const metaMatch = JSON.stringify(record.metadata || {}).toLowerCase().includes(q);
      const idMatch = record.id.toLowerCase().includes(q);
      if (!contentMatch && !metaMatch && !idMatch) {
        isVisible = false;
      }
    }

    // In 'overview' mode, collapse members of unexpanded clusters
    if (detailLevel === 'overview' && assignedClusterId !== undefined && !expandedClusterIds.has(assignedClusterId)) {
      isVisible = false;
    }

    const node: StreamGraphNode = {
      id: nodeId,
      memoryId: record.id,
      sourceId: record.sourceId,
      label,
      category: record.memoryType,
      timestamp: record.createdAt,
      updatedAt: record.updatedAt,
      embeddingModel: record.embeddingModel,
      embeddingDimension: record.embeddingDimension ?? (hasEmbedding ? record.embedding!.length : undefined),
      clusterId: assignedClusterId,
      metadata: record.metadata,
      nodeKind: 'memory',
      isVisible,
      isExpanded: expandedMemoryIds.has(record.id),
      hasEmbedding,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: hasEmbedding ? 6 : 4.5,
      color,
    };

    nodeMap.set(nodeId, node);
  }

  // 2. Create Cluster Hub Nodes (for overview & balanced detail modes)
  const clusterNodeMap = new Map<number, StreamGraphNode>();
  if (clusters.length > 0) {
    for (const cluster of clusters) {
      const clusterNodeId = `cluster_${cluster.id}`;
      const isExpanded = expandedClusterIds.has(cluster.id);

      const clusterNode: StreamGraphNode = {
        id: clusterNodeId,
        memoryId: cluster.representativeMemoryId || '',
        sourceId: 'cluster_organization',
        label: `${cluster.label} (${cluster.count})`,
        category: 'cluster_hub',
        clusterId: cluster.id,
        nodeKind: 'cluster',
        memberCount: cluster.count,
        isVisible: detailLevel === 'overview' || detailLevel === 'balanced' || isExpanded,
        isExpanded,
        hasEmbedding: true,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: Math.max(14, Math.min(28, 10 + Math.sqrt(cluster.count) * 2)),
        color: cluster.color || '#6366f1',
      };

      clusterNodeMap.set(cluster.id, clusterNode);
      nodeMap.set(clusterNodeId, clusterNode);
    }
  }

  // 3. Build & Deduplicate Edges
  const edgeMap = new Map<string, StreamGraphEdge>();

  const addEdge = (edge: StreamGraphEdge) => {
    // Only add if both source and target exist in nodeMap
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) return;
    if (edge.source === edge.target) return; // Prevent self-loops

    if (!edgeMap.has(edge.id)) {
      edgeMap.set(edge.id, edge);
    }
  };

  let explicitEdgesCount = 0;
  let similarityEdgesCount = 0;
  let temporalEdgesCount = 0;
  let retrievalEdgesCount = 0;
  let clusterEdgesCount = 0;

  // 3.1 Explicit Source Relationships
  if (activeEdgeTypes.has('explicit')) {
    for (const record of records) {
      const sourceNodeId = recordToNodeId.get(record.id);
      if (!sourceNodeId) continue;

      if (record.explicitRelations && Array.isArray(record.explicitRelations)) {
        for (const rel of record.explicitRelations) {
          const targetNodeId = recordToNodeId.get(rel.targetId);
          if (targetNodeId) {
            const edgeId = `edge_exp_${record.id}_${rel.targetId}_${rel.relationType}`;
            addEdge({
              id: edgeId,
              source: sourceNodeId,
              target: targetNodeId,
              type: 'explicit',
              relation: rel.relationType,
              weight: Math.max(0.2, Math.min(1.0, rel.strength ?? 0.85)),
              provenance: 'source',
              directed: true,
            });
            explicitEdgesCount++;
          }
        }
      }
    }
  }

  // 3.2 Semantic Similarity Edges (Bounded KNN)
  if (activeEdgeTypes.has('similarity') && recordsWithEmbeddings > 1) {
    const recordsWithVecs = records.filter(
      r => r.embedding && Array.isArray(r.embedding) && r.embedding.length > 0
    );

    // Group by cluster for fast localized neighbor candidate selection when dataset is large (> 500)
    const candidatesGrouped = new Map<number, NormalizedMemoryRecord[]>();
    if (recordsWithVecs.length > 500) {
      recordsWithVecs.forEach(r => {
        const cId = clusterMap.get(r.id) ?? 0;
        const list = candidatesGrouped.get(cId) || [];
        list.push(r);
        candidatesGrouped.set(cId, list);
      });
    }

    const n = recordsWithVecs.length;
    // Step size for high-density scalability
    const step = n > 3000 ? 3 : n > 1500 ? 2 : 1;

    for (let i = 0; i < n; i += step) {
      const r1 = recordsWithVecs[i];
      const sourceNodeId = recordToNodeId.get(r1.id)!;
      const v1 = r1.embedding!;

      // Identify candidates (intra-cluster or global)
      let candidates: NormalizedMemoryRecord[];
      const cId = clusterMap.get(r1.id);
      if (candidatesGrouped.size > 0 && cId !== undefined && candidatesGrouped.has(cId)) {
        candidates = candidatesGrouped.get(cId)!;
      } else {
        candidates = recordsWithVecs;
      }

      // Rank top neighbors
      const scored: Array<{ id: string; sim: number }> = [];
      const windowLimit = Math.min(candidates.length, 120);

      for (let j = 0; j < windowLimit; j++) {
        const r2 = candidates[j];
        if (r1.id === r2.id) continue;
        const sim = cosineSimilarity(v1, r2.embedding!);
        if (sim >= similarityThreshold) {
          scored.push({ id: r2.id, sim });
        }
      }

      scored.sort((a, b) => b.sim - a.sim);
      const topNeighbors = scored.slice(0, maxNeighborsPerNode);

      for (const neighbor of topNeighbors) {
        const targetNodeId = recordToNodeId.get(neighbor.id);
        if (!targetNodeId) continue;

        // Canonical sorted key to guarantee undirected deduplication
        const [minId, maxId] = [r1.id, neighbor.id].sort();
        const edgeId = `edge_sim_${minId}_${maxId}`;

        addEdge({
          id: edgeId,
          source: sourceNodeId,
          target: targetNodeId,
          type: 'similarity',
          relation: 'cosine_similarity',
          weight: neighbor.sim,
          confidence: neighbor.sim,
          provenance: 'computed',
          directed: false,
        });
        similarityEdgesCount++;
      }
    }
  }

  // 3.3 Historical Retrieval Edges
  if (activeEdgeTypes.has('retrieval')) {
    const retrievalIndex = new Map<string, string[]>(); // query -> recordIds[]

    for (const record of records) {
      if (record.retrievalEvents && Array.isArray(record.retrievalEvents)) {
        for (const ev of record.retrievalEvents) {
          const qKey = (ev.query || '').trim().toLowerCase();
          if (qKey) {
            const list = retrievalIndex.get(qKey) || [];
            list.push(record.id);
            retrievalIndex.set(qKey, list);
          }
        }
      }
    }

    retrievalIndex.forEach((rIds, query) => {
      if (rIds.length > 1) {
        for (let i = 0; i < rIds.length - 1; i++) {
          for (let j = i + 1; j < Math.min(rIds.length, i + 3); j++) {
            const [minId, maxId] = [rIds[i], rIds[j]].sort();
            const edgeId = `edge_ret_${minId}_${maxId}`;
            addEdge({
              id: edgeId,
              source: recordToNodeId.get(rIds[i])!,
              target: recordToNodeId.get(rIds[j])!,
              type: 'retrieval',
              relation: `co_retrieved: "${query.slice(0, 25)}"`,
              weight: 0.75,
              provenance: 'source',
              directed: false,
            });
            retrievalEdgesCount++;
          }
        }
      }
    });
  }

  // 3.4 Temporal Sequential Edges
  if (activeEdgeTypes.has('temporal')) {
    // Group records by provenance sessionId to find verified temporal sequences
    const sessionGroups = new Map<string, NormalizedMemoryRecord[]>();

    for (const record of records) {
      const sessId = record.provenance?.sessionId;
      if (sessId) {
        const list = sessionGroups.get(sessId) || [];
        list.push(record);
        sessionGroups.set(sessId, list);
      }
    }

    sessionGroups.forEach(sessRecords => {
      if (sessRecords.length > 1) {
        // Sort by conversation turn or timestamp
        sessRecords.sort((a, b) => {
          const turnA = a.provenance?.conversationTurn ?? 0;
          const turnB = b.provenance?.conversationTurn ?? 0;
          if (turnA !== turnB) return turnA - turnB;
          return (a.createdAt || '').localeCompare(b.createdAt || '');
        });

        for (let i = 0; i < sessRecords.length - 1; i++) {
          const r1 = sessRecords[i];
          const r2 = sessRecords[i + 1];
          const edgeId = `edge_temp_${r1.id}_${r2.id}`;
          addEdge({
            id: edgeId,
            source: recordToNodeId.get(r1.id)!,
            target: recordToNodeId.get(r2.id)!,
            type: 'temporal',
            relation: 'temporal_next',
            weight: 0.65,
            provenance: 'source',
            directed: true,
          });
          temporalEdgesCount++;
        }
      }
    });
  }

  // 3.5 Cluster Organizational Edges
  if (activeEdgeTypes.has('cluster') && clusters.length > 0) {
    for (const cluster of clusters) {
      const clusterHubId = `cluster_${cluster.id}`;

      // In overview mode, connect cluster hubs to each other
      if (detailLevel === 'overview') {
        for (const otherCluster of clusters) {
          if (cluster.id < otherCluster.id) {
            const edgeId = `edge_clust_inter_${cluster.id}_${otherCluster.id}`;
            addEdge({
              id: edgeId,
              source: clusterHubId,
              target: `cluster_${otherCluster.id}`,
              type: 'cluster',
              relation: 'cluster_bridge',
              weight: 0.35,
              provenance: 'inferred',
              directed: false,
            });
            clusterEdgesCount++;
          }
        }
      } else {
        // Connect cluster hub to a representative sample of its visible member nodes
        const members = records.filter(r => clusterMap.get(r.id) === cluster.id);
        const sampleStep = Math.max(1, Math.floor(members.length / 15));

        for (let i = 0; i < members.length; i += sampleStep) {
          const memberNodeId = recordToNodeId.get(members[i].id);
          if (memberNodeId) {
            const edgeId = `edge_clust_${cluster.id}_${members[i].id}`;
            addEdge({
              id: edgeId,
              source: clusterHubId,
              target: memberNodeId,
              type: 'cluster',
              relation: 'cluster_member',
              weight: 0.25,
              provenance: 'inferred',
              directed: false,
            });
            clusterEdgesCount++;
          }
        }
      }
    }
  }

  const allNodes = Array.from(nodeMap.values());
  const allEdges = Array.from(edgeMap.values());

  const visibleMemoryNodes = allNodes.filter(n => n.nodeKind === 'memory' && n.isVisible).length;
  const collapsedRecords = records.length - visibleMemoryNodes;

  return {
    nodes: allNodes,
    edges: allEdges,
    nodeMap,
    recordToNodeId,
    stats: {
      totalRecords: records.length,
      recordsWithEmbeddings,
      recordsWithoutEmbeddings,
      totalClusters: clusters.length,
      visibleMemoryNodes,
      collapsedRecords,
      displayedEdges: allEdges.length,
      explicitEdgesCount,
      similarityEdgesCount,
      temporalEdgesCount,
      retrievalEdgesCount,
      clusterEdgesCount,
    },
  };
}

/**
 * Resolves a StreamGraphNode back to its authoritative NormalizedMemoryRecord.
 */
export function resolveRecordFromNode(
  node: StreamGraphNode,
  recordSource: NormalizedMemoryRecord[] | Map<string, NormalizedMemoryRecord>
): NormalizedMemoryRecord | undefined {
  if (recordSource instanceof Map) {
    return recordSource.get(node.memoryId);
  }
  return recordSource.find(r => r.id === node.memoryId);
}
