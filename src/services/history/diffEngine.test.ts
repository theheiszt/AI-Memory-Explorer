import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSnapshots } from './diffEngine.ts';
import type { NormalizedMemoryRecord } from '../../types/memory.ts';

test('diffEngine: correctly detects additions, modifications, and removals', () => {
  const snapA: NormalizedMemoryRecord[] = [
    { id: '1', sourceId: 's', content: 'Original content', contentAvailable: true, embedding: [1, 2], metadata: {}, retrievalEvents: [] },
    { id: '2', sourceId: 's', content: 'To be removed', contentAvailable: true, embedding: [3, 4], metadata: {} },
  ];

  const snapB: NormalizedMemoryRecord[] = [
    {
      id: '1',
      sourceId: 's',
      content: 'Updated content!',
      contentAvailable: true,
      embedding: [1, 2],
      metadata: {},
      retrievalEvents: [{ id: 'ret1', timestamp: '2026-10-17T00:00:00Z', query: 'q', similarityScore: 0.9 }],
    },
    { id: '3', sourceId: 's', content: 'Brand new record', contentAvailable: true, embedding: [5, 6], metadata: {} },
  ];

  const diff = compareSnapshots(
    { id: 'snap_a', name: 'Snapshot A', timestamp: '2026-10-15', records: snapA },
    { id: 'snap_b', name: 'Snapshot B', timestamp: '2026-10-17', records: snapB }
  );

  assert.equal(diff.addedRecords.length, 1);
  assert.equal(diff.addedRecords[0].id, '3');

  assert.equal(diff.removedRecords.length, 1);
  assert.equal(diff.removedRecords[0].id, '2');

  assert.equal(diff.modifiedRecords.length, 1);
  assert.equal(diff.modifiedRecords[0].before.id, '1');
  assert.ok(diff.modifiedRecords[0].changes.includes('content'));

  assert.equal(diff.retrievalFrequencyChanges.length, 1);
  assert.equal(diff.retrievalFrequencyChanges[0].delta, 1);
});
