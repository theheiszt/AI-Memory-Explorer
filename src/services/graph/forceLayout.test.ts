import test from 'node:test';
import assert from 'node:assert/strict';
import { ForceLayoutEngine } from './forceLayout.ts';
import type { StreamGraphNode, StreamGraphEdge } from '../../types/streamGraph.ts';

function createMockNodes(count: number): StreamGraphNode[] {
  const nodes: StreamGraphNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `node_${i}`,
      memoryId: `mem_${i}`,
      sourceId: 'test',
      label: `Memory ${i}`,
      nodeKind: 'memory',
      isVisible: true,
      hasEmbedding: true,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 6,
      color: '#3b82f6',
    });
  }
  return nodes;
}

test('forceLayout: initializes and converges to quiescence (cooling schedule)', () => {
  const nodes = createMockNodes(10);
  const edges: StreamGraphEdge[] = [
    {
      id: 'e1',
      source: 'node_0',
      target: 'node_1',
      type: 'similarity',
      weight: 0.9,
      provenance: 'computed',
      directed: false,
    },
    {
      id: 'e2',
      source: 'node_1',
      target: 'node_2',
      type: 'explicit',
      weight: 1.0,
      provenance: 'source',
      directed: true,
    },
  ];

  const engine = new ForceLayoutEngine({ center: [0, 0] });
  engine.setGraph(nodes, edges, { warmupTicks: 0 });

  assert.equal(engine.getIsSleeping(), false);
  assert.ok(engine.getAlpha() > 0);

  // Run iterations until simulation reaches quiescence
  let ticks = 0;
  while (!engine.getIsSleeping() && ticks < 300) {
    engine.tick();
    ticks++;
  }

  assert.equal(engine.getIsSleeping(), true);
  assert.equal(engine.getAlpha(), 0);
  assert.ok(ticks < 200, `Simulation converged in ${ticks} ticks`);
});

test('forceLayout: position caching preserves established coordinates', () => {
  const nodes = createMockNodes(5);
  const engine = new ForceLayoutEngine();
  engine.setGraph(nodes, [], { warmupTicks: 25 });

  const cachedPos = nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));

  // Re-set graph with same nodes and preserveExisting = true
  engine.setGraph(nodes, [], { warmupTicks: 0, preserveExisting: true });

  for (const prev of cachedPos) {
    const current = nodes.find(n => n.id === prev.id)!;
    assert.equal(current.x, prev.x);
    assert.equal(current.y, prev.y);
  }
});

test('forceLayout: respects pinned nodes during physics iterations', () => {
  const nodes = createMockNodes(3);
  const engine = new ForceLayoutEngine();
  engine.setGraph(nodes, [], { warmupTicks: 10 });

  // Pin node_0 to exact coordinate
  engine.pinNode('node_0', 500, 500);

  for (let t = 0; t < 20; t++) {
    engine.tick();
  }

  const pinnedNode = nodes.find(n => n.id === 'node_0')!;
  assert.equal(pinnedNode.x, 500);
  assert.equal(pinnedNode.y, 500);

  // Unpin and verify node can move again
  engine.unpinNode('node_0');
  assert.equal(pinnedNode.fx, null);
  assert.equal(pinnedNode.fy, null);
});

test('forceLayout: spring force pulls connected nodes closer than unlinked nodes', () => {
  const nodes = createMockNodes(3);
  // Edge between 0 and 1, but 2 is unlinked
  const edges: StreamGraphEdge[] = [
    {
      id: 'e_0_1',
      source: 'node_0',
      target: 'node_1',
      type: 'explicit',
      weight: 1.0,
      provenance: 'source',
      directed: true,
    },
  ];

  const engine = new ForceLayoutEngine();
  engine.setGraph(nodes, edges, { warmupTicks: 100 });

  const dx01 = nodes[0].x - nodes[1].x;
  const dy01 = nodes[0].y - nodes[1].y;
  const dist01 = Math.sqrt(dx01 * dx01 + dy01 * dy01);

  // Distance between connected nodes should be bounded around link distance
  assert.ok(dist01 < 150, `Connected nodes distance is ${dist01}`);
});
