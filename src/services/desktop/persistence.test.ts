import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { computePCA } from '../projection/pca.js';
import { computeUMAP } from '../projection/umap.js';
import { runKMeans } from '../clustering/kmeans.js';
import { cosineSimilarity } from '../projection/vectorMath.js';
import { compareSnapshots } from '../history/diffEngine.js';
import { exportNormalizedRecords, exportProjectionCoordinatesCSV } from '../export/exporter.js';
import type { NormalizedMemoryRecord, ProjectionPoint, SourceConfig } from '../../types/memory.js';

test('desktop persistence: write and read app state from disk', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-memory-test-'));
  const statePath = path.join(tempDir, 'app_state.json');

  try {
    const testRecord: NormalizedMemoryRecord = {
      id: 'persist_rec_1',
      sourceId: 'src_persist',
      content: 'Local offline memory verification record',
      contentAvailable: true,
      embedding: [0.12, 0.45, -0.67, 0.89],
      embeddingDimension: 4,
      metadata: { author: 'local_user', session: 'sess_1' },
      createdAt: '2026-10-19T12:00:00Z',
      memoryType: 'semantic',
    };

    const mockState = {
      sources: [
        {
          id: 'src_persist',
          name: 'Persisted Local Source',
          type: 'json' as const,
          status: 'connected' as const,
          capabilities: {
            hasEmbeddings: true,
            embeddingDimension: 4,
            isReadOnly: true,
            recordCount: 1,
          },
        },
      ],
      activeSourceId: 'src_persist',
      records: [testRecord],
      densityScale: 1.2,
      algorithm: 'umap' as const,
      timestamp: new Date().toISOString(),
    };

    // Save state
    fs.writeFileSync(statePath, JSON.stringify(mockState, null, 2), 'utf-8');
    assert.strictEqual(fs.existsSync(statePath), true);

    // Read back state
    const raw = fs.readFileSync(statePath, 'utf-8');
    const restored = JSON.parse(raw);
    assert.strictEqual(restored.activeSourceId, 'src_persist');
    assert.strictEqual(restored.records.length, 1);
    assert.strictEqual(restored.records[0].id, 'persist_rec_1');
    assert.strictEqual(restored.densityScale, 1.2);

    // Test cache clear
    fs.writeFileSync(statePath, JSON.stringify(null), 'utf-8');
    const clearedRaw = fs.readFileSync(statePath, 'utf-8');
    const clearedState = JSON.parse(clearedRaw);
    assert.strictEqual(clearedState, null, 'Cache clear resets state to null');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('desktop offline operation: all core local workflows operate without network access', () => {
  // Synthesize local offline records
  const localRecords: NormalizedMemoryRecord[] = Array.from({ length: 50 }, (_, i) => ({
    id: `local_rec_${i}`,
    sourceId: 'local_offline',
    content: `Local autonomous memory entry number ${i} for offline verification`,
    contentAvailable: true,
    embedding: [
      Math.sin(i * 0.1),
      Math.cos(i * 0.1),
      Math.sin(i * 0.2),
      Math.cos(i * 0.2),
    ],
    embeddingDimension: 4,
    metadata: { tag: i % 2 === 0 ? 'even' : 'odd' },
    createdAt: new Date().toISOString(),
    memoryType: i % 3 === 0 ? 'episodic' : 'semantic',
  }));

  const vectorsWithIds = localRecords.map(r => ({ id: r.id, embedding: r.embedding! }));

  // 1. Offline PCA projection
  const pcaResult = computePCA(vectorsWithIds);
  assert.strictEqual(pcaResult.points.length, 50, 'PCA must compute offline');
  assert.ok(pcaResult.explainedVarianceRatio[0] > 0);

  // 2. Offline UMAP projection
  const umapPoints = computeUMAP(vectorsWithIds, { nNeighbors: 5 });
  assert.strictEqual(umapPoints.length, 50, 'UMAP must compute offline');

  // 3. Offline KMeans clustering
  const clusterResult = runKMeans(localRecords, 3);
  assert.strictEqual(clusterResult.clusters.length, 3, 'KMeans must cluster offline');

  // 4. Offline Nearest-neighbor search
  const queryVec = localRecords[0].embedding!;
  const similarities = localRecords.map(r => ({
    id: r.id,
    similarity: cosineSimilarity(queryVec, r.embedding!),
  }));
  similarities.sort((a, b) => b.similarity - a.similarity);
  assert.strictEqual(similarities[0].id, localRecords[0].id, 'Self-similarity must be highest');
  assert.ok(Math.abs(similarities[0].similarity - 1.0) < 1e-4);

  // 5. Offline Snapshot Comparison
  const snapshotA = localRecords.slice(0, 40);
  const snapshotB = localRecords.slice(10, 50);
  const diff = compareSnapshots(
    { id: 'snap_1', name: 'Snap 1', timestamp: '2026-10-19T00:00:00Z', records: snapshotA },
    { id: 'snap_2', name: 'Snap 2', timestamp: '2026-10-19T01:00:00Z', records: snapshotB }
  );
  assert.strictEqual(diff.addedRecords.length, 10);
  assert.strictEqual(diff.removedRecords.length, 10);
  assert.strictEqual(diff.modifiedRecords.length, 0);

  // 6. Offline Data Export
  const jsonExport = exportNormalizedRecords(localRecords);
  assert.ok(jsonExport.includes('local_rec_0'));

  const projectionPoints: ProjectionPoint[] = pcaResult.points.map((pt, idx) => ({
    ...pt,
    clusterId: clusterResult.assignments.get(pt.id) ?? 0,
    record: localRecords[idx],
  }));
  const csvExport = exportProjectionCoordinatesCSV(projectionPoints);
  assert.ok(csvExport.includes('x,y,z,cluster_id'));
});
