import test from 'node:test';
import assert from 'node:assert';
import {
  expandMemoryRecord,
  calculateGlobalConnections,
  computeVirtualReach,
} from './memoryExpansionEngine.ts';
import type { NormalizedMemoryRecord, ProjectionPoint } from '../../types/memory.ts';

test('memoryExpansionEngine: expands a memory vector into 16 constituent sub-memories', () => {
  const dummyRecord: NormalizedMemoryRecord = {
    id: 'mem_test_001',
    sourceId: 'test_source',
    content: 'Testing Linux eBPF kernel socket filter performance.',
    contentAvailable: true,
    embedding: [0.5, -0.3, 0.8, -0.1],
    memoryType: 'procedural',
    metadata: {},
  };

  const subNodes = expandMemoryRecord(dummyRecord, 16);
  assert.strictEqual(subNodes.length, 16);
  assert.strictEqual(subNodes[0].parentId, 'mem_test_001');
  assert.strictEqual(subNodes[0].embedding.length, 4);
  assert(subNodes[0].similarityToParent > 0.8);
  assert(subNodes[0].attentionWeight > 0.4);
});

test('memoryExpansionEngine: computes virtual reach reaching 1,000,000 without rendering a million objects', () => {
  const reach = computeVirtualReach(10000, 5, 100);
  assert.strictEqual(reach.totalVirtualReach, 1000000);
  assert.strictEqual(reach.expandedParentCount, 5);
  assert.strictEqual(reach.materializedSubCount, 80);
  assert.strictEqual(reach.activeDisplayCount, 10080);
});

test('memoryExpansionEngine: calculates global synaptic connections for network view', () => {
  const dummyPoints: ProjectionPoint[] = [
    {
      id: 'p1',
      x: 10,
      y: 10,
      z: 0,
      clusterId: 1,
      record: {
        id: 'p1',
        sourceId: 's',
        content: 'c1',
        contentAvailable: true,
        embedding: [1, 0],
        metadata: {},
        explicitRelations: [{ targetId: 'p2', relationType: 'causes', strength: 0.9 }],
      },
    },
    {
      id: 'p2',
      x: 15,
      y: 12,
      z: 0,
      clusterId: 1,
      record: {
        id: 'p2',
        sourceId: 's',
        content: 'c2',
        contentAvailable: true,
        embedding: [0.9, 0.1],
        metadata: {},
      },
    },
  ];

  const connections = calculateGlobalConnections(dummyPoints, 'all', { spatialThreshold: 50 });
  assert(connections.length >= 1);
  assert(connections.some(c => c.connectionType === 'explicit'));
});
