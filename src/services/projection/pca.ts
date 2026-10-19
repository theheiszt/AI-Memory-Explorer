/**
 * Principal Component Analysis (PCA) projection engine.
 * Computes deterministic orthogonal projections of high-dimensional vectors to 2D or 3D.
 * Highly optimized for 1,000 to 10,000 memory vectors with early convergence.
 */

import { meanVector, dotProduct, magnitude } from './vectorMath.ts';

export interface PCAResult {
  points: Array<{ id: string; x: number; y: number; z?: number }>;
  explainedVarianceRatio: number[];
}

export function computePCA(
  vectorsWithIds: Array<{ id: string; embedding: number[] }>,
  targetDims: 2 | 3 = 2,
  densityScale: number = 1.0
): PCAResult {
  const n = vectorsWithIds.length;
  if (n === 0) {
    return { points: [], explainedVarianceRatio: [] };
  }

  const d = vectorsWithIds[0].embedding.length;
  if (n < 2 || d < 2) {
    return {
      points: vectorsWithIds.map((item, idx) => ({
        id: item.id,
        x: idx * 10,
        y: 0,
        z: targetDims === 3 ? 0 : undefined,
      })),
      explainedVarianceRatio: [1.0],
    };
  }

  // 1. Center the data
  const rawVectors = vectorsWithIds.map(v => v.embedding);
  const mean = meanVector(rawVectors);
  const centered = rawVectors.map(v => v.map((val, i) => val - mean[i]));

  // 2. Power iteration to extract top targetDims principal components
  const components: number[][] = [];
  const variances: number[] = [];
  let residual = centered.map(row => row.slice());

  // Scale max iterations for speed: 12 iterations is plenty for power iteration convergence
  const MAX_ITER = n > 2000 ? 10 : 16;

  for (let c = 0; c < targetDims; c++) {
    // Initial seeded vector
    let v = new Array(d).fill(0).map((_, i) => Math.sin((i + 1) * (c + 1) * 7.9));
    let norm = magnitude(v);
    if (norm > 0) v = v.map(val => val / norm);

    for (let iter = 0; iter < MAX_ITER; iter++) {
      // Step A: projection onto v: p = X * v
      const p = new Array(n);
      for (let i = 0; i < n; i++) {
        p[i] = dotProduct(residual[i], v);
      }

      // Step B: back projection: X^T * p
      const vNext = new Array(d).fill(0);
      for (let j = 0; j < d; j++) {
        let sum = 0;
        for (let i = 0; i < n; i++) {
          sum += residual[i][j] * p[i];
        }
        vNext[j] = sum;
      }

      const nextNorm = magnitude(vNext);
      if (nextNorm === 0) break;
      const normalizedVNext = vNext.map(val => val / nextNorm);

      // Check early convergence
      const cosDiff = Math.abs(dotProduct(v, normalizedVNext));
      v = normalizedVNext;
      if (cosDiff > 0.9999) break;
    }

    components.push(v);

    // Compute variance explained by this component
    let varSum = 0;
    for (let i = 0; i < n; i++) {
      const proj = dotProduct(residual[i], v);
      varSum += proj * proj;
    }
    variances.push(varSum / n);

    // Deflate residual: X_new = X - (X * v) * v^T
    for (let i = 0; i < n; i++) {
      const proj = dotProduct(residual[i], v);
      for (let j = 0; j < d; j++) {
        residual[i][j] -= proj * v[j];
      }
    }
  }

  // 3. Project data onto principal components
  const projected = vectorsWithIds.map((item, i) => {
    const x = dotProduct(centered[i], components[0]);
    const y = components[1] ? dotProduct(centered[i], components[1]) : 0;
    const z = targetDims === 3 && components[2] ? dotProduct(centered[i], components[2]) : undefined;
    return {
      id: item.id,
      x,
      y,
      z,
    };
  });

  // 4. Normalize to [-100, 100] range scaled by densityScale
  let maxX = 0;
  let maxY = 0;
  let maxZ = 0;
  for (const pt of projected) {
    if (Math.abs(pt.x) > maxX) maxX = Math.abs(pt.x);
    if (Math.abs(pt.y) > maxY) maxY = Math.abs(pt.y);
    if (pt.z !== undefined && Math.abs(pt.z) > maxZ) maxZ = Math.abs(pt.z);
  }

  const effectiveScale = (80 / (Math.max(maxX, maxY, maxZ) || 1)) * Math.max(0.5, Math.min(2.5, densityScale));
  const normalizedPoints = projected.map(pt => ({
    id: pt.id,
    x: Math.round(pt.x * effectiveScale * 100) / 100,
    y: Math.round(pt.y * effectiveScale * 100) / 100,
    z: pt.z !== undefined ? Math.round(pt.z * effectiveScale * 100) / 100 : undefined,
  }));

  const totalVar = variances.reduce((acc, val) => acc + val, 0) || 1;
  const explainedVarianceRatio = variances.map(v => Math.round((v / totalVar) * 100) / 100);

  return {
    points: normalizedPoints,
    explainedVarianceRatio,
  };
}
