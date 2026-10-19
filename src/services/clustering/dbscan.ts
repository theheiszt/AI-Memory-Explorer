/**
 * Density-Based Spatial Clustering (DBSCAN / HDBSCAN approximation)
 * Discovers clusters of arbitrary shape and isolates noise points without requiring fixed K.
 */

import type { NormalizedMemoryRecord, ClusterInfo } from '../../types/memory.ts';
import { cosineSimilarity } from '../projection/vectorMath.ts';

const PALETTE = [
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#f97316', // Orange
];

export interface DBSCANResult {
  clusters: ClusterInfo[];
  assignments: Map<string, number>;
  noiseCount: number;
}

export function runDBSCAN(
  records: NormalizedMemoryRecord[],
  epsCosine = 0.35, // Distance threshold (1 - cosineSimilarity)
  minPts = 3
): DBSCANResult {
  const validRecords = records.filter(r => r.embedding && r.embedding.length > 0);
  const n = validRecords.length;

  if (n === 0) {
    return { clusters: [], assignments: new Map(), noiseCount: 0 };
  }

  // Precompute pairwise distances: dist = 1 - ((cos + 1)/2)
  const distMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const cos = (cosineSimilarity(validRecords[i].embedding!, validRecords[j].embedding!) + 1) / 2;
      const dist = 1 - cos;
      distMatrix[i][j] = dist;
      distMatrix[j][i] = dist;
    }
  }

  const UNVISITED = -2;
  const NOISE = -1;
  const labels = new Array(n).fill(UNVISITED);
  let clusterCount = 0;

  function regionQuery(pIdx: number): number[] {
    const neighbors: number[] = [];
    for (let i = 0; i < n; i++) {
      if (distMatrix[pIdx][i] <= epsCosine) {
        neighbors.push(i);
      }
    }
    return neighbors;
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== UNVISITED) continue;

    const neighbors = regionQuery(i);
    if (neighbors.length < minPts) {
      labels[i] = NOISE;
    } else {
      labels[i] = clusterCount;
      const queue = [...neighbors];

      let qHead = 0;
      while (qHead < queue.length) {
        const qIdx = queue[qHead++];
        if (labels[qIdx] === NOISE) {
          labels[qIdx] = clusterCount;
        }
        if (labels[qIdx] !== UNVISITED) continue;

        labels[qIdx] = clusterCount;
        const qNeighbors = regionQuery(qIdx);
        if (qNeighbors.length >= minPts) {
          for (const nb of qNeighbors) {
            if (!queue.includes(nb)) {
              queue.push(nb);
            }
          }
        }
      }
      clusterCount++;
    }
  }

  // Formulate ClusterInfo objects
  const assignmentMap = new Map<string, number>();
  const clusterMemberIds: string[][] = Array.from({ length: clusterCount }, () => []);
  let noiseCount = 0;

  for (let i = 0; i < n; i++) {
    const r = validRecords[i];
    const cId = labels[i];
    assignmentMap.set(r.id, cId);
    if (cId === NOISE) {
      noiseCount++;
    } else {
      clusterMemberIds[cId].push(r.id);
    }
  }

  const clusters: ClusterInfo[] = [];

  for (let c = 0; c < clusterCount; c++) {
    const memberIds = clusterMemberIds[c];
    if (memberIds.length === 0) continue;

    // Representative memory: central member
    const repId = memberIds[0];
    const repRecord = validRecords.find(r => r.id === repId);
    const rawLabel = repRecord ? repRecord.content.slice(0, 30) + '...' : `Dense Cluster ${c + 1}`;

    clusters.push({
      id: c,
      label: `Density Cluster ${c + 1}: ${rawLabel}`,
      color: PALETTE[c % PALETTE.length],
      count: memberIds.length,
      memberIds,
      centroid: [0, 0],
      representativeMemoryId: repId,
      isInferred: true,
    });
  }

  return {
    clusters,
    assignments: assignmentMap,
    noiseCount,
  };
}
