/**
 * Pure vector mathematics utilities for embeddings and nearest neighbor calculation.
 * Decoupled from UI components for high performance and fast unit testing.
 */

import type { NormalizedMemoryRecord } from '../../types/memory.ts';

export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

export function magnitude(v: number[]): number {
  let sumSquares = 0;
  for (let i = 0; i < v.length; i++) {
    sumSquares += v[i] * v[i];
  }
  return Math.sqrt(sumSquares);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  const dot = dotProduct(a, b);
  const cos = dot / (magA * magB);
  // Guard against float precision drift beyond [-1, 1]
  return Math.max(-1, Math.min(1, cos));
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function normalizeVector(v: number[]): number[] {
  const mag = magnitude(v);
  if (mag === 0) return v.slice();
  return v.map(val => val / mag);
}

export function meanVector(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const mean = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      mean[i] += v[i];
    }
  }
  return mean.map(val => val / vectors.length);
}

export interface NeighborResult {
  record: NormalizedMemoryRecord;
  similarity: number; // 0 to 1
  distance: number;
}

export function findNearestNeighbors(
  targetVector: number[],
  records: NormalizedMemoryRecord[],
  topK = 5,
  excludeRecordId?: string
): NeighborResult[] {
  const validRecords = records.filter(
    r => r.embedding && r.embedding.length === targetVector.length && r.id !== excludeRecordId
  );

  const scored = validRecords.map(r => {
    const sim = cosineSimilarity(targetVector, r.embedding!);
    const dist = euclideanDistance(targetVector, r.embedding!);
    return {
      record: r,
      similarity: (sim + 1) / 2, // Normalize cosine [-1, 1] to [0, 1]
      distance: dist,
    };
  });

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}
