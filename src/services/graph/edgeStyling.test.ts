import test from 'node:test';
import assert from 'node:assert/strict';
import { getEdgeStyle } from './edgeStyling.ts';
import type { StreamGraphEdge } from '../../types/streamGraph.ts';

test('edgeStyling: explicit edges receive distinct semantic colors and solid lines', () => {
  const causesEdge: StreamGraphEdge = {
    id: 'e1',
    source: 'n1',
    target: 'n2',
    type: 'explicit',
    relation: 'causes',
    weight: 0.9,
    provenance: 'source',
    directed: true,
  };
  const causesStyle = getEdgeStyle(causesEdge);
  assert.equal(causesStyle.strokeColor, '#10b981'); // Emerald
  assert.deepEqual(causesStyle.dashPattern, []);    // Solid
  assert.equal(causesStyle.directed, true);

  const contradictsEdge: StreamGraphEdge = {
    id: 'e2',
    source: 'n1',
    target: 'n2',
    type: 'explicit',
    relation: 'contradicts',
    weight: 0.8,
    provenance: 'source',
    directed: true,
  };
  const contradictsStyle = getEdgeStyle(contradictsEdge);
  assert.equal(contradictsStyle.strokeColor, '#ef4444'); // Red/Rose
});

test('edgeStyling: similarity edges have proportional width, dashed pattern, and undirected', () => {
  const simEdgeLow: StreamGraphEdge = {
    id: 'e_sim_low',
    source: 'n1',
    target: 'n2',
    type: 'similarity',
    weight: 0.7,
    provenance: 'computed',
    directed: false,
  };
  const simEdgeHigh: StreamGraphEdge = {
    id: 'e_sim_high',
    source: 'n1',
    target: 'n3',
    type: 'similarity',
    weight: 0.95,
    provenance: 'computed',
    directed: false,
  };

  const styleLow = getEdgeStyle(simEdgeLow);
  const styleHigh = getEdgeStyle(simEdgeHigh);

  assert.deepEqual(styleLow.dashPattern, [5, 4]);
  assert.equal(styleLow.directed, false);
  assert.ok(styleHigh.lineWidth > styleLow.lineWidth, 'Higher similarity has thicker stroke');
});

test('edgeStyling: temporal edges are directed and have dotted pattern', () => {
  const tempEdge: StreamGraphEdge = {
    id: 'e_temp',
    source: 'n1',
    target: 'n2',
    type: 'temporal',
    weight: 0.6,
    provenance: 'source',
    directed: true,
  };
  const style = getEdgeStyle(tempEdge);
  assert.equal(style.directed, true);
  assert.deepEqual(style.dashPattern, [2, 3]);
  assert.equal(style.strokeColor, '#06b6d4');
});
