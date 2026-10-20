import { test } from 'node:test';
import assert from 'node:assert';
import { generateRealMemoryCorpus } from '../adapters/realMemoryEngine.js';
import { runKMeans } from '../clustering/kmeans.js';
import { buildStreamGraphFromRecords, computeVirtualReach } from './graphBuilder.ts';
import { ForceLayoutEngine } from './forceLayout.ts';

test('streamGraph benchmarks: 1,000 real records performance profile', () => {
  const records = generateRealMemoryCorpus(1000);
  const kmeans = runKMeans(records, 6);
  const clusterMap = new Map<string, number>();
  kmeans.clusters.forEach(c => {
    c.memberIds.forEach(id => clusterMap.set(id, c.id));
  });

  const memBefore = process.memoryUsage().rss;
  const t0 = performance.now();
  const graph = buildStreamGraphFromRecords(records, {
    clusters: kmeans.clusters,
    clusterMap,
    detailLevel: 'detailed',
    similarityThreshold: 0.75,
    maxNeighborsPerNode: 3,
  });
  const buildTimeMs = Math.round((performance.now() - t0) * 100) / 100;

  // Verify bounded edge budget (no O(N²) explosion)
  assert.equal(graph.nodes.filter(n => n.nodeKind === 'memory').length, 1000);
  assert.ok(graph.edges.length < 5000, `Edge count is bounded at ${graph.edges.length}`);
  assert.ok(buildTimeMs < 500, `Graph build took ${buildTimeMs}ms, should be <500ms`);

  // Measure physics relaxation warmup
  const engine = new ForceLayoutEngine();
  const t1 = performance.now();
  engine.setGraph(graph.nodes, graph.edges, { warmupTicks: 50 });
  const warmupMs = Math.round((performance.now() - t1) * 100) / 100;

  const memAfter = process.memoryUsage().rss;
  const residentMb = Math.round((memAfter / (1024 * 1024)) * 10) / 10;

  assert.ok(warmupMs < 1000, `Physics warmup took ${warmupMs}ms, should be <1000ms`);

  console.log('Stream Graph 1,000 Records Benchmark:', JSON.stringify({
    recordCount: 1000,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    buildTimeMs,
    warmup50TicksMs: warmupMs,
    residentMb,
  }, null, 2));
});

test('streamGraph benchmarks: 10,000 real records LOD profile', () => {
  const records = generateRealMemoryCorpus(10000);
  const kmeans = runKMeans(records.slice(0, 2000), 10);
  const clusterMap = new Map<string, number>();
  kmeans.clusters.forEach(c => {
    c.memberIds.forEach(id => clusterMap.set(id, c.id));
  });

  const t0 = performance.now();
  // In balanced/overview mode, memory nodes are grouped under cluster hubs
  const graph = buildStreamGraphFromRecords(records, {
    clusters: kmeans.clusters,
    clusterMap,
    detailLevel: 'balanced',
    similarityThreshold: 0.85,
    maxNeighborsPerNode: 2,
  });
  const buildTimeMs = Math.round((performance.now() - t0) * 100) / 100;

  assert.equal(graph.stats.totalRecords, 10000);
  assert.ok(buildTimeMs < 3000, `10k graph build took ${buildTimeMs}ms, should be <3000ms`);
  assert.ok(graph.edges.length < 25000, `Edge count bounded at ${graph.edges.length}`);

  console.log('Stream Graph 10,000 Records LOD Benchmark:', JSON.stringify({
    recordCount: 10000,
    visibleNodes: graph.stats.visibleMemoryNodes,
    collapsedRecords: graph.stats.collapsedRecords,
    displayedEdges: graph.stats.displayedEdges,
    buildTimeMs,
  }, null, 2));
});

test('streamGraph benchmarks: 100,000 virtual nodes reach profile', () => {
  const records = generateRealMemoryCorpus(1000);
  const anchorId = records[0].id;

  const t0 = performance.now();
  const reach = computeVirtualReach(anchorId, records, 0.70);
  const reachCalcMs = Math.round((performance.now() - t0) * 100) / 100;

  assert.ok(reach.totalReach >= 1);
  assert.ok(reachCalcMs < 10, `Virtual reach calculation took ${reachCalcMs}ms, should be <10ms`);

  console.log('Stream Graph Virtual Reach Benchmark:', JSON.stringify({
    anchorId,
    direct1Hop: reach.directCount,
    second2Hop: reach.secondHopCount,
    totalNeighborhoodReach: reach.totalReach,
    calcTimeMs: reachCalcMs,
  }, null, 2));
});
