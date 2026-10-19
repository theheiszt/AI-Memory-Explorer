import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dotProduct,
  magnitude,
  cosineSimilarity,
  euclideanDistance,
  normalizeVector,
  findNearestNeighbors,
} from './vectorMath.ts';
import type { NormalizedMemoryRecord } from '../../types/memory.ts';

test('vectorMath: dotProduct computes accurate scalar product', () => {
  assert.equal(dotProduct([1, 2, 3], [4, 5, 6]), 32);
  assert.equal(dotProduct([1, 0], [0, 1]), 0);
});

test('vectorMath: magnitude computes euclidean norm', () => {
  assert.equal(magnitude([3, 4]), 5);
  assert.equal(magnitude([0, 0, 0]), 0);
});

test('vectorMath: cosineSimilarity returns 1 for identical and 0 for orthogonal vectors', () => {
  const v1 = [1, 2, 3];
  const v2 = [2, 4, 6];
  const orthogonal1 = [1, 0];
  const orthogonal2 = [0, 1];

  assert.ok(Math.abs(cosineSimilarity(v1, v2) - 1.0) < 1e-6);
  assert.ok(Math.abs(cosineSimilarity(orthogonal1, orthogonal2) - 0.0) < 1e-6);
});

test('vectorMath: euclideanDistance calculates spatial gap', () => {
  assert.equal(euclideanDistance([0, 0], [3, 4]), 5);
});

test('vectorMath: normalizeVector produces unit vector', () => {
  const normalized = normalizeVector([3, 4]);
  assert.ok(Math.abs(magnitude(normalized) - 1.0) < 1e-6);
  assert.ok(Math.abs(normalized[0] - 0.6) < 1e-6);
  assert.ok(Math.abs(normalized[1] - 0.8) < 1e-6);
});

test('vectorMath: findNearestNeighbors ranks closest memory records', () => {
  const records: NormalizedMemoryRecord[] = [
    {
      id: 'm1',
      sourceId: 's1',
      content: 'First memory',
      contentAvailable: true,
      embedding: [1, 0, 0],
      metadata: {},
    },
    {
      id: 'm2',
      sourceId: 's1',
      content: 'Second memory',
      contentAvailable: true,
      embedding: [0.95, 0.1, 0],
      metadata: {},
    },
    {
      id: 'm3',
      sourceId: 's1',
      content: 'Distant memory',
      contentAvailable: true,
      embedding: [0, 1, 0],
      metadata: {},
    },
  ];

  const target = [1, 0, 0];
  const neighbors = findNearestNeighbors(target, records, 2, 'm1');

  assert.equal(neighbors.length, 2);
  assert.equal(neighbors[0].record.id, 'm2');
  assert.ok(neighbors[0].similarity > neighbors[1].similarity);
});
