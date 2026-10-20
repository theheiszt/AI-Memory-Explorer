import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStreamGraphFromRecords, resolveRecordFromNode } from './graphBuilder.ts';
import type { NormalizedMemoryRecord, ClusterInfo } from '../../types/memory.ts';

test('graphBuilder: 1:1 mapping of memory records to graph nodes and safe resolution', () => {
  const records: NormalizedMemoryRecord[] = [
    {
      id: 'mem_1',
      sourceId: 'src_test',
      content: 'Alpha knowledge chunk',
      contentAvailable: true,
      memoryType: 'semantic',
      embedding: [1, 0, 0],
      createdAt: '2026-01-01T10:00:00Z',
    },
    {
      id: 'mem_2',
      sourceId: 'src_test',
      content: 'Beta observation',
      contentAvailable: true,
      memoryType: 'episodic',
      embedding: [0.95, 0.05, 0],
      createdAt: '2026-01-01T11:00:00Z',
    },
    {
      id: 'mem_no_vec',
      sourceId: 'src_test',
      content: 'Unembedded memory note',
      contentAvailable: true,
      memoryType: 'working',
      createdAt: '2026-01-01T12:00:00Z',
    },
  ];

  const graph = buildStreamGraphFromRecords(records);

  // Check 1:1 mapping for memory nodes
  const memoryNodes = graph.nodes.filter(n => n.nodeKind === 'memory');
  assert.equal(memoryNodes.length, 3);
  assert.equal(graph.stats.totalRecords, 3);
  assert.equal(graph.stats.recordsWithEmbeddings, 2);
  assert.equal(graph.stats.recordsWithoutEmbeddings, 1);

  // Check resolution back to original records
  const node1 = graph.nodeMap.get('node_mem_1')!;
  assert.ok(node1);
  assert.equal(node1.memoryId, 'mem_1');
  assert.equal(node1.hasEmbedding, true);
  assert.equal(node1.label, 'Alpha knowledge chunk');

  const resolved = resolveRecordFromNode(node1, records);
  assert.ok(resolved);
  assert.equal(resolved?.id, 'mem_1');
  assert.equal(resolved?.content, 'Alpha knowledge chunk');

  // Verify unembedded record was mapped safely
  const noVecNode = graph.nodeMap.get('node_mem_no_vec')!;
  assert.ok(noVecNode);
  assert.equal(noVecNode.hasEmbedding, false);
  assert.equal(noVecNode.embeddingDimension, undefined);
});

test('graphBuilder: preserves explicit relation direction, type, and source provenance', () => {
  const records: NormalizedMemoryRecord[] = [
    {
      id: 'premise_1',
      sourceId: 'test',
      content: 'Rule A applies',
      contentAvailable: true,
      explicitRelations: [
        {
          targetId: 'conclusion_1',
          relationType: 'causes',
          strength: 0.95,
        },
      ],
    },
    {
      id: 'conclusion_1',
      sourceId: 'test',
      content: 'System triggers action',
      contentAvailable: true,
      explicitRelations: [
        {
          targetId: 'counter_1',
          relationType: 'contradicts',
          strength: 0.8,
        },
      ],
    },
    {
      id: 'counter_1',
      sourceId: 'test',
      content: 'System remains idle',
      contentAvailable: true,
    },
  ];

  const graph = buildStreamGraphFromRecords(records);
  const explicitEdges = graph.edges.filter(e => e.type === 'explicit');

  assert.equal(explicitEdges.length, 2);

  const causesEdge = explicitEdges.find(e => e.relation === 'causes');
  assert.ok(causesEdge);
  assert.equal(causesEdge?.source, 'node_premise_1');
  assert.equal(causesEdge?.target, 'node_conclusion_1');
  assert.equal(causesEdge?.directed, true);
  assert.equal(causesEdge?.provenance, 'source');
  assert.equal(causesEdge?.weight, 0.95);

  const contradictsEdge = explicitEdges.find(e => e.relation === 'contradicts');
  assert.ok(contradictsEdge);
  assert.equal(contradictsEdge?.source, 'node_conclusion_1');
  assert.equal(contradictsEdge?.target, 'node_counter_1');
  assert.equal(contradictsEdge?.directed, true);
});

test('graphBuilder: deduplicates undirected similarity edges without duplicates', () => {
  const records: NormalizedMemoryRecord[] = [
    {
      id: 'rec_a',
      sourceId: 'test',
      content: 'Neural networks in deep learning',
      contentAvailable: true,
      embedding: [0.9, 0.1, 0],
    },
    {
      id: 'rec_b',
      sourceId: 'test',
      content: 'Deep learning artificial networks',
      contentAvailable: true,
      embedding: [0.89, 0.11, 0],
    },
  ];

  const graph = buildStreamGraphFromRecords(records, {
    similarityThreshold: 0.8,
  });

  const simEdges = graph.edges.filter(e => e.type === 'similarity');
  // Undirected similarity between A and B must appear exactly once
  assert.equal(simEdges.length, 1);
  assert.equal(simEdges[0].directed, false);
  assert.equal(simEdges[0].provenance, 'computed');
  assert.ok(simEdges[0].weight >= 0.8);
});

test('graphBuilder: cluster hubs and progressive detail levels', () => {
  const records: NormalizedMemoryRecord[] = [
    { id: 'm1', sourceId: 's', content: 'C1 item 1', contentAvailable: true, embedding: [1, 0] },
    { id: 'm2', sourceId: 's', content: 'C1 item 2', contentAvailable: true, embedding: [0.99, 0.01] },
    { id: 'm3', sourceId: 's', content: 'C2 item 1', contentAvailable: true, embedding: [0, 1] },
  ];

  const clusters: ClusterInfo[] = [
    { id: 1, label: 'Cluster Alpha', count: 2, color: '#3b82f6', representativeMemoryId: 'm1' },
    { id: 2, label: 'Cluster Beta', count: 1, color: '#10b981', representativeMemoryId: 'm3' },
  ];

  const clusterMap = new Map<string, number>([
    ['m1', 1],
    ['m2', 1],
    ['m3', 2],
  ]);

  // Test overview detail level: members hidden by default unless cluster expanded
  const overviewGraph = buildStreamGraphFromRecords(records, {
    clusters,
    clusterMap,
    detailLevel: 'overview',
    expandedClusterIds: new Set([1]), // Cluster 1 expanded, Cluster 2 collapsed
  });

  const c1Members = overviewGraph.nodes.filter(n => n.nodeKind === 'memory' && n.clusterId === 1);
  const c2Members = overviewGraph.nodes.filter(n => n.nodeKind === 'memory' && n.clusterId === 2);

  assert.equal(c1Members.every(n => n.isVisible), true);
  assert.equal(c2Members.every(n => !n.isVisible), true);

  // Cluster hub nodes present
  const clusterHubs = overviewGraph.nodes.filter(n => n.nodeKind === 'cluster');
  assert.equal(clusterHubs.length, 2);
});

test('graphBuilder: non-mutation of input source records', () => {
  const originalRecord: NormalizedMemoryRecord = {
    id: 'immutable_mem',
    sourceId: 's1',
    content: 'Pristine state',
    contentAvailable: true,
    metadata: { key: 'original_val' },
  };

  const copy = JSON.parse(JSON.stringify(originalRecord));
  buildStreamGraphFromRecords([originalRecord]);

  assert.deepEqual(originalRecord, copy);
});
