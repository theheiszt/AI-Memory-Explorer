import test from 'node:test';
import assert from 'node:assert';
import { generateRealMemoryCorpus, embedTextContent } from './realMemoryEngine.ts';

test('realMemoryEngine: generates 1,000 real memory records with normalized schema', () => {
  const records = generateRealMemoryCorpus(1000, 1.0, 123);
  assert.strictEqual(records.length, 1000);

  const first = records[0];
  assert.ok(first.id.startsWith('mem_real_'));
  assert.strictEqual(first.embedding?.length, 64);
  assert.ok(first.content.length > 10);
  assert.ok(first.memoryType);
  assert.ok(first.metadata);
  assert.ok(first.provenance);

  // Check unique IDs
  const idSet = new Set(records.map(r => r.id));
  assert.strictEqual(idSet.size, 1000);
});

test('realMemoryEngine: generates up to 10,000 memory vectors with valid unit norm embeddings', () => {
  const records = generateRealMemoryCorpus(10000, 1.5, 999);
  assert.strictEqual(records.length, 10000);

  // Sample 20 random records to verify vector unit magnitude
  for (let i = 0; i < 20; i++) {
    const idx = Math.floor(Math.random() * 10000);
    const emb = records[idx].embedding!;
    assert.strictEqual(emb.length, 64);
    let magSq = 0;
    for (let d = 0; d < emb.length; d++) {
      magSq += emb[d] * emb[d];
    }
    const mag = Math.sqrt(magSq);
    assert.ok(Math.abs(mag - 1.0) < 0.05, `Vector magnitude ${mag} should be ~1.0`);
  }
});

test('realMemoryEngine: embedTextContent produces normalized vectors for custom memories', () => {
  const vec1 = embedTextContent('PostgreSQL index optimization and connection pooling');
  assert.strictEqual(vec1.length, 64);
  let magSq = 0;
  for (let d = 0; d < vec1.length; d++) magSq += vec1[d] * vec1[d];
  assert.ok(Math.abs(Math.sqrt(magSq) - 1.0) < 0.05);
});
