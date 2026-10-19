import test from 'node:test';
import assert from 'node:assert/strict';
import { JSONMemoryAdapter } from './jsonAdapter.ts';

test('jsonAdapter: parses JSON array and normalizes properties', async () => {
  const json = JSON.stringify([
    {
      id: 'mem_1',
      text: 'Remember to call user on Tuesday',
      vector: [0.1, 0.2, 0.3],
      metadata: { priority: 'high' },
    },
  ]);

  const adapter = new JSONMemoryAdapter('test_source', 'Test Source', json);
  const records = await adapter.fetchRecords();

  assert.equal(records.length, 1);
  assert.equal(records[0].id, 'mem_1');
  assert.equal(records[0].content, 'Remember to call user on Tuesday');
  assert.equal(records[0].embeddingDimension, 3);
  assert.equal(records[0].metadata.priority, 'high');
  assert.equal(adapter.getCapabilities().hasEmbeddings, true);
});

test('jsonAdapter: handles JSONL stream format', async () => {
  const jsonl = '{"id":"line1","content":"First line"}\n{"id":"line2","content":"Second line"}';
  const adapter = new JSONMemoryAdapter('jsonl_source', 'JSONL Source', jsonl);
  const records = await adapter.fetchRecords();

  assert.equal(records.length, 2);
  assert.equal(records[0].id, 'line1');
  assert.equal(records[1].id, 'line2');
});
