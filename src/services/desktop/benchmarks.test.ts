import { test } from 'node:test';
import assert from 'node:assert';
import { generateRealMemoryCorpus } from '../adapters/realMemoryEngine.js';
import { computePCA } from '../projection/pca.js';
import { computeUMAP } from '../projection/umap.js';
import { runKMeans } from '../clustering/kmeans.js';
import { cosineSimilarity } from '../projection/vectorMath.js';
import { computeVirtualReach, expandMemoryRecord } from '../adapters/memoryExpansionEngine.js';

export interface BenchmarkMetrics {
  recordCount: number;
  projectionPcaMs: number;
  projectionUmapMs: number;
  clusteringKMeansMs: number;
  lexicalSearchMs: number;
  cosineKnnMs: number;
  residentMemoryMb: number;
}

export function runBenchmarkSuite(count: number): BenchmarkMetrics {
  const memBefore = process.memoryUsage().rss;

  // 1. Generate real memory dataset
  const records = generateRealMemoryCorpus(count);
  const vectors = records.map(r => ({ id: r.id, embedding: r.embedding! }));

  // 2. Measure PCA
  const t0 = performance.now();
  const pcaResult = computePCA(vectors, 2, 1.0);
  const projectionPcaMs = Math.round((performance.now() - t0) * 100) / 100;

  // 3. Measure UMAP
  const t1 = performance.now();
  const umapResult = computeUMAP(vectors, { nNeighbors: 15, targetDims: 2 });
  const projectionUmapMs = Math.round((performance.now() - t1) * 100) / 100;

  // 4. Measure KMeans (k=4)
  const t2 = performance.now();
  const kmeansResult = runKMeans(records, 4);
  const clusteringKMeansMs = Math.round((performance.now() - t2) * 100) / 100;

  // 5. Measure Lexical Search
  const query = 'kernel';
  const t3 = performance.now();
  const matches = records.filter(r => r.content.toLowerCase().includes(query));
  const lexicalSearchMs = Math.round((performance.now() - t3) * 100) / 100;

  // 6. Measure Cosine Nearest Neighbor
  const queryVec = records[0].embedding!;
  const t4 = performance.now();
  let maxSim = -1;
  let bestId = '';
  for (let i = 1; i < records.length; i++) {
    const sim = cosineSimilarity(queryVec, records[i].embedding!);
    if (sim > maxSim) {
      maxSim = sim;
      bestId = records[i].id;
    }
  }
  const cosineKnnMs = Math.round((performance.now() - t4) * 100) / 100;

  const memAfter = process.memoryUsage().rss;
  const residentMemoryMb = Math.round(((memAfter) / (1024 * 1024)) * 10) / 10;

  assert.strictEqual(pcaResult.points.length, count);
  assert.strictEqual(umapResult.length, count);
  assert.strictEqual(kmeansResult.clusters.length, 4);
  assert.ok(matches.length > 0);
  assert.ok(bestId.length > 0);

  return {
    recordCount: count,
    projectionPcaMs,
    projectionUmapMs,
    clusteringKMeansMs,
    lexicalSearchMs,
    cosineKnnMs,
    residentMemoryMb,
  };
}

test('benchmarks: 1,000 real records performance profile', () => {
  const metrics = runBenchmarkSuite(1000);
  console.log('1,000 Record Benchmark Metrics:', JSON.stringify(metrics, null, 2));

  // Assertions for realistic desktop performance
  assert.ok(metrics.projectionPcaMs < 1000, `PCA took ${metrics.projectionPcaMs}ms, should be <1000ms`);
  assert.ok(metrics.clusteringKMeansMs < 1000, `KMeans took ${metrics.clusteringKMeansMs}ms, should be <1000ms`);
  assert.ok(metrics.lexicalSearchMs < 50, `Search took ${metrics.lexicalSearchMs}ms, should be <50ms`);
  assert.ok(metrics.cosineKnnMs < 50, `KNN took ${metrics.cosineKnnMs}ms, should be <50ms`);
});

test('benchmarks: 10,000 real records performance profile', () => {
  const metrics = runBenchmarkSuite(10000);
  console.log('10,000 Record Benchmark Metrics:', JSON.stringify(metrics, null, 2));

  // Assertions for 10k desktop scale
  assert.ok(metrics.projectionPcaMs < 5000, `PCA took ${metrics.projectionPcaMs}ms, should be <5000ms`);
  assert.ok(metrics.clusteringKMeansMs < 5000, `KMeans took ${metrics.clusteringKMeansMs}ms, should be <5000ms`);
  assert.ok(metrics.lexicalSearchMs < 100, `Search took ${metrics.lexicalSearchMs}ms, should be <100ms`);
  assert.ok(metrics.cosineKnnMs < 150, `KNN took ${metrics.cosineKnnMs}ms, should be <150ms`);
});

test('benchmarks: 100,000 virtual records scaling and LOD virtual reach profile', () => {
  const baseCount = 1000;
  const subPerRecord = 100;
  const totalVirtualUniverse = baseCount * subPerRecord; // 100,000 virtual records

  // Measure virtual reach calculation
  const t0 = performance.now();
  const reach = computeVirtualReach(baseCount, 10, subPerRecord);
  const reachCalcMs = Math.round((performance.now() - t0) * 100) / 100;

  assert.strictEqual(reach.totalVirtualReach, totalVirtualUniverse);
  assert.strictEqual(reach.materializedSubCount, 10 * 16); // 16 constituent sub-memories per expanded anchor

  // Measure on-demand sub-memory expansion for selected node
  const records = generateRealMemoryCorpus(10);
  const t1 = performance.now();
  const subNodes = expandMemoryRecord(records[0], 16);
  const expansionMs = Math.round((performance.now() - t1) * 100) / 100;

  assert.strictEqual(subNodes.length, 16);
  assert.ok(expansionMs < 10, `LOD expansion took ${expansionMs}ms, should be <10ms`);

  console.log('100,000 Virtual Record Reach Metrics:', JSON.stringify({
    totalVirtualReach: reach.totalVirtualReach,
    baseAnchors: baseCount,
    subNodesPerAnchor: subPerRecord,
    reachCalcMs,
    expansionMs,
  }, null, 2));
});
