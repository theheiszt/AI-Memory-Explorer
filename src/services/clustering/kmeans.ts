/**
 * K-Means clustering algorithm for high-dimensional memory embeddings.
 * Features k-means++ initialization, centroid calculation, and representative record extraction.
 */

import type { NormalizedMemoryRecord, ClusterInfo } from '../../types/memory.ts';
import { euclideanDistance, cosineSimilarity } from '../projection/vectorMath.ts';

const PALETTE = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#14b8a6', // Teal
  '#f43f5e', // Rose
  '#3b82f6', // Blue
  '#eab308', // Yellow
];

export interface KMeansResult {
  clusters: ClusterInfo[];
  assignments: Map<string, number>;
  inertia: number;
}

export function runKMeans(
  records: NormalizedMemoryRecord[],
  k = 4,
  maxIterations = 25
): KMeansResult {
  const validRecords = records.filter(r => r.embedding && r.embedding.length > 0);
  const n = validRecords.length;

  if (n === 0) {
    return { clusters: [], assignments: new Map(), inertia: 0 };
  }

  const effectiveK = Math.min(k, n);
  const dim = validRecords[0].embedding!.length;

  // 1. K-Means++ initialization (accelerated with representative subsampling when n > 500)
  const initSample = n > 500 ? validRecords.filter((_, idx) => idx % Math.ceil(n / 350) === 0) : validRecords;
  const centroids: number[][] = [];
  centroids.push(initSample[0].embedding!.slice());

  while (centroids.length < effectiveK) {
    const distSqList: number[] = [];
    let sumDistSq = 0;

    for (const r of initSample) {
      let minDistSq = Infinity;
      for (const c of centroids) {
        const d = euclideanDistance(r.embedding!, c);
        const dSq = d * d;
        if (dSq < minDistSq) minDistSq = dSq;
      }
      distSqList.push(minDistSq);
      sumDistSq += minDistSq;
    }

    // Roulette wheel selection based on distance squared
    let rVal = Math.random() * (sumDistSq || 1);
    let chosenIdx = 0;
    for (let i = 0; i < distSqList.length; i++) {
      rVal -= distSqList[i];
      if (rVal <= 0) {
        chosenIdx = i;
        break;
      }
    }
    centroids.push(initSample[chosenIdx].embedding!.slice());
  }

  // 2. Lloyd's iteration
  let assignments = new Array(n).fill(0);
  let inertia = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    inertia = 0;

    // Assignment step
    for (let i = 0; i < n; i++) {
      const emb = validRecords[i].embedding!;
      let bestCluster = 0;
      let minDistance = Infinity;

      for (let c = 0; c < effectiveK; c++) {
        const dist = euclideanDistance(emb, centroids[c]);
        if (dist < minDistance) {
          minDistance = dist;
          bestCluster = c;
        }
      }

      inertia += minDistance * minDistance;
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    if (!changed && iter > 0) break;

    // Update step
    const counts = new Array(effectiveK).fill(0);
    const newCentroids = Array.from({ length: effectiveK }, () => new Array(dim).fill(0));

    for (let i = 0; i < n; i++) {
      const cluster = assignments[i];
      counts[cluster]++;
      const emb = validRecords[i].embedding!;
      for (let d = 0; d < dim; d++) {
        newCentroids[cluster][d] += emb[d];
      }
    }

    for (let c = 0; c < effectiveK; c++) {
      if (counts[c] > 0) {
        for (let d = 0; d < dim; d++) {
          centroids[c][d] = newCentroids[c][d] / counts[c];
        }
      }
    }
  }

  // 3. Synthesize ClusterInfo
  const assignmentMap = new Map<string, number>();
  const clusterMembers: string[][] = Array.from({ length: effectiveK }, () => []);

  for (let i = 0; i < n; i++) {
    const r = validRecords[i];
    const cId = assignments[i];
    assignmentMap.set(r.id, cId);
    clusterMembers[cId].push(r.id);
  }

  const clusters: ClusterInfo[] = [];

  for (let c = 0; c < effectiveK; c++) {
    const memberIds = clusterMembers[c];
    if (memberIds.length === 0) continue;

    // Find representative memory (closest to centroid)
    let repId = memberIds[0];
    let maxSim = -Infinity;

    for (const mId of memberIds) {
      const rec = validRecords.find(r => r.id === mId)!;
      const sim = cosineSimilarity(rec.embedding!, centroids[c]);
      if (sim > maxSim) {
        maxSim = sim;
        repId = mId;
      }
    }

    const repRecord = validRecords.find(r => r.id === repId);
    const rawLabel = repRecord ? repRecord.content.slice(0, 32) + '...' : `Cluster ${c + 1}`;

    clusters.push({
      id: c,
      label: `Cluster ${c + 1}: ${rawLabel}`,
      color: PALETTE[c % PALETTE.length],
      count: memberIds.length,
      memberIds,
      centroid: [0, 0], // Will be updated to 2D projection centroid in UI mapping
      representativeMemoryId: repId,
      isInferred: true,
    });
  }

  return {
    clusters,
    assignments: assignmentMap,
    inertia,
  };
}
