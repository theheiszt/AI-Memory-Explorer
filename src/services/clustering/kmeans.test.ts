import test from 'node:test';
import assert from 'node:assert/strict';
import { runKMeans } from './kmeans.ts';
import type { NormalizedMemoryRecord } from '../../types/memory.ts';

test('kmeans: partitions points into requested k clusters', () => {
  const records: NormalizedMemoryRecord[] = [
    { id: 'a1', sourceId: 's1', content: 'Cluster A point 1', contentAvailable: true, embedding: [10, 10], metadata: {} },
    { id: 'a2', sourceId: 's1', content: 'Cluster A point 2', contentAvailable: true, embedding: [10.5, 9.8], metadata: {} },
    { id: 'b1', sourceId: 's1', content: 'Cluster B point 1', contentAvailable: true, embedding: [-10, -10], metadata: {} },
    { id: 'b2', sourceId: 's1', content: 'Cluster B point 2', contentAvailable: true, embedding: [-9.7, -10.2], metadata: {} },
  ];

  const result = runKMeans(records, 2);

  assert.equal(result.clusters.length, 2);
  assert.equal(result.assignments.size, 4);

  // a1 and a2 must share cluster, b1 and b2 must share cluster
  const clusterA = result.assignments.get('a1');
  const clusterA2 = result.assignments.get('a2');
  const clusterB = result.assignments.get('b1');
  const clusterB2 = result.assignments.get('b2');

  assert.equal(clusterA, clusterA2);
  assert.equal(clusterB, clusterB2);
  assert.notEqual(clusterA, clusterB);
});
