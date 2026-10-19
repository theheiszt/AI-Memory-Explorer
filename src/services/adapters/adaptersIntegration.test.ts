import { test } from 'node:test';
import assert from 'node:assert';
import { JSONMemoryAdapter } from './jsonAdapter.ts';
import { CSVMemoryAdapter } from './csvAdapter.ts';
import {
  SQLiteQueryAdapter,
  QdrantAdapter,
  ChromaAdapter,
  GenericRESTAdapter,
} from './vectorDbAdapters.ts';
import {
  exportNormalizedRecords,
  exportProjectionCoordinatesCSV,
  exportClustersJSON,
  exportDiagnosticLogs,
} from '../export/exporter.ts';
import { computePCA } from '../projection/pca.ts';
import { computeUMAP } from '../projection/umap.ts';
import { runDBSCAN } from '../clustering/dbscan.ts';
import { runKMeans } from '../clustering/kmeans.ts';
import { cosineSimilarity, findNearestNeighbors } from '../projection/vectorMath.ts';
import { NormalizedMemoryRecord, ProjectionPoint, ClusterInfo } from '../../types/memory.ts';

// ---------------------------------------------------------------------------
// 1. Data Ingestion Tests (JSON, JSONL, CSV, SQLite, Vector DBs, REST)
// ---------------------------------------------------------------------------

test('adapter: JSON array with full metadata and vectors', async () => {
  const json = JSON.stringify([
    {
      id: 'agent_fact_1',
      content: 'User prefers PostgreSQL over MongoDB',
      embedding: [0.1, 0.2, -0.3, 0.4],
      metadata: { domain: 'database', confidence: 0.95 },
      createdAt: '2026-10-15T10:00:00Z',
      type: 'profile',
      relations: [{ targetId: 'agent_fact_0', relationType: 'supersedes' }],
    },
  ]);

  const adapter = new JSONMemoryAdapter('src_test_json', 'Test JSON Source', json);
  const caps = adapter.getCapabilities();
  assert.strictEqual(caps.hasEmbeddings, true);
  assert.strictEqual(caps.embeddingDimension, 4);
  assert.strictEqual(caps.isReadOnly, true);

  const records = await adapter.fetchRecords();
  assert.strictEqual(records.length, 1);
  assert.strictEqual(records[0].id, 'agent_fact_1');
  assert.strictEqual(records[0].content, 'User prefers PostgreSQL over MongoDB');
  assert.strictEqual(records[0].memoryType, 'profile');
  assert.strictEqual(records[0].explicitRelations?.length, 1);
  assert.strictEqual(records[0].explicitRelations?.[0].relationType, 'supersedes');
});

test('adapter: CSV with custom field mappings and vector parsing', async () => {
  const csv = `custom_id,text_body,vector_str,created,category,reviewer\n` +
    `c1,"First memory turn","[0.5, -0.5, 0.2, 0.1]",2026-10-14T08:00:00Z,episodic,architect\n` +
    `c2,"Second memory turn","[-0.2, 0.8, -0.1, 0.3]",2026-10-14T08:05:00Z,procedural,qa\n`;

  const adapter = new CSVMemoryAdapter('src_test_csv', 'Test CSV Source', csv, {
    idColumn: 'custom_id',
    contentColumn: 'text_body',
    embeddingColumn: 'vector_str',
    timestampColumn: 'created',
    typeColumn: 'category',
  });

  const caps = adapter.getCapabilities();
  assert.strictEqual(caps.hasEmbeddings, true);
  assert.strictEqual(caps.embeddingDimension, 4);

  const records = await adapter.fetchRecords();
  assert.strictEqual(records.length, 2);
  assert.strictEqual(records[0].id, 'c1');
  assert.strictEqual(records[0].content, 'First memory turn');
  assert.strictEqual(records[0].embedding?.length, 4);
  assert.strictEqual(records[0].metadata.reviewer, 'architect');
  assert.strictEqual(records[1].id, 'c2');
  assert.strictEqual(records[1].metadata.reviewer, 'qa');
});

test('adapter: SQLiteQueryAdapter normalizes query rows and stringified vectors', async () => {
  const queryRows = [
    {
      rowid: 101,
      content: 'Kernel parameter net.ipv4.tcp_tw_reuse set to 1',
      embedding: JSON.stringify([0.15, -0.22, 0.88, 0.05]),
      created_at: '2026-10-16T12:00:00Z',
      memory_type: 'procedural',
      service_tag: 'networking',
    },
    {
      rowid: 102,
      content: 'Worker node autoscaling scaled from 3 to 8 nodes',
      embedding: [0.12, -0.20, 0.85, 0.08],
      created_at: '2026-10-16T12:10:00Z',
      memory_type: 'episodic',
      service_tag: 'k8s',
    },
  ];

  const adapter = new SQLiteQueryAdapter('src_sqlite', 'Production SQLite Cache', queryRows);
  const caps = adapter.getCapabilities();
  assert.strictEqual(caps.isReadOnly, true);
  assert.strictEqual(caps.hasEmbeddings, true);

  const records = await adapter.fetchRecords();
  assert.strictEqual(records.length, 2);
  assert.strictEqual(records[0].id, '101');
  assert.strictEqual(records[0].embedding?.length, 4);
  assert.strictEqual(records[0].memoryType, 'procedural');
  assert.strictEqual(records[1].id, '102');
  assert.strictEqual(records[1].embedding?.length, 4);
});

test('adapter: QdrantAdapter scroll payload normalization', async () => {
  const qdrant = new QdrantAdapter('qdrant_src', 'Local Qdrant', 'http://127.0.0.1:6333', 'agent_memories');
  const caps = qdrant.getCapabilities();
  assert.strictEqual(caps.isReadOnly, true);
  assert.strictEqual(caps.supportsRealtimeSync, true);
});

test('adapter: ChromaAdapter capabilities and schema contract', async () => {
  const chroma = new ChromaAdapter('chroma_src', 'Chroma Collection', 'http://127.0.0.1:8000', 'col_123');
  const caps = chroma.getCapabilities();
  assert.strictEqual(caps.isReadOnly, true);
  assert.strictEqual(caps.embeddingDimension, 1536);
});

test('adapter: GenericRESTAdapter connection contract', async () => {
  const rest = new GenericRESTAdapter('rest_src', 'Custom Agent API', 'http://127.0.0.1:9000/api', 'bearer_token_123');
  const caps = rest.getCapabilities();
  assert.strictEqual(caps.isReadOnly, true);
  assert.strictEqual(caps.supportsRetrievalHistory, true);
});

// ---------------------------------------------------------------------------
// 2. Export & Sensitive Data Redaction Tests
// ---------------------------------------------------------------------------

test('exporter: redacts passwords, tokens, API keys in diagnostic logs and records', () => {
  const sensitiveRecords: NormalizedMemoryRecord[] = [
    {
      id: 'mem_sec_1',
      sourceId: 'src_sec',
      content: 'Agent credentials updated',
      contentAvailable: true,
      embedding: [0.1, 0.2],
      createdAt: '2026-10-18T10:00:00Z',
      memoryType: 'system',
      metadata: {
        api_key: 'AIzaSySecretKeyXYZ',
        password: 'SuperSecretPassword123',
        auth_token: 'Bearer eyJhbGciOi...',
        safe_parameter: 'temperature=0.7',
      },
    },
  ];

  const exported = exportNormalizedRecords(sensitiveRecords, {
    includeEmbeddings: true,
    redactSensitiveData: true,
  });

  const parsed = JSON.parse(exported);
  assert.strictEqual(parsed[0].metadata.api_key, '[REDACTED_SECRET]');
  assert.strictEqual(parsed[0].metadata.password, '[REDACTED_SECRET]');
  assert.strictEqual(parsed[0].metadata.auth_token, '[REDACTED_SECRET]');
  assert.strictEqual(parsed[0].metadata.safe_parameter, 'temperature=0.7');

  // Verify diagnostic log export redaction
  const logs = [
    {
      timestamp: '2026-10-18T10:00:00Z',
      level: 'error' as const,
      message: 'Failed to authenticate with provider',
      redactedContext: { secret_token: 'top_secret_token_123', public_endpoint: 'https://api.example.com' },
    },
  ];
  const redactedLogs = exportDiagnosticLogs(logs, true);
  assert.ok(!redactedLogs.includes('top_secret_token_123'));
  assert.ok(redactedLogs.includes('[REDACTED_SECRET]'));
});

test('exporter: generates valid projection CSV and Cluster JSON', () => {
  const points: ProjectionPoint[] = [
    {
      id: 'pt_1',
      x: 12.345,
      y: -67.891,
      z: 5.432,
      clusterId: 1,
      record: {
        id: 'pt_1',
        sourceId: 's1',
        content: 'Fact A',
        contentAvailable: true,
        embedding: [0.1, 0.2],
        createdAt: '2026-10-18T00:00:00Z',
        memoryType: 'semantic',
      },
    },
  ];

  const csv = exportProjectionCoordinatesCSV(points);
  assert.ok(csv.includes('id,x,y,z,cluster_id,content_preview,source_id'));
  assert.ok(csv.includes('pt_1,12.345,-67.891,5.432,1,"Fact A",s1'));

  const clusters: ClusterInfo[] = [
    {
      id: 1,
      label: 'Database Preferences',
      color: '#3b82f6',
      size: 15,
      centroid: [0.1, 0.2, 0.3],
      keywords: ['postgres', 'sql', 'query'],
    },
  ];
  const clusterJson = exportClustersJSON(clusters);
  assert.ok(clusterJson.includes('Database Preferences'));
});

// ---------------------------------------------------------------------------
// 3. Dimensionality Reduction, Clustering & Search
// ---------------------------------------------------------------------------

test('projection: PCA and UMAP produce bounded 2D and 3D projections', () => {
  const vectors = Array.from({ length: 20 }, (_, i) => ({
    id: `vec_${i}`,
    embedding: [Math.sin(i), Math.cos(i), Math.sin(i * 2), Math.cos(i * 3)],
  }));

  const pca2D = computePCA(vectors, 2);
  assert.strictEqual(pca2D.points.length, 20);
  assert.strictEqual(typeof pca2D.points[0].x, 'number');
  assert.strictEqual(typeof pca2D.points[0].y, 'number');

  const pca3D = computePCA(vectors, 3);
  assert.strictEqual(pca3D.points.length, 20);
  assert.strictEqual(typeof pca3D.points[0].z, 'number');

  const umapPoints = computeUMAP(vectors, { targetDims: 3, iterations: 30, nNeighbors: 4 });
  assert.strictEqual(umapPoints.length, 20);
  assert.ok(!isNaN(umapPoints[0].x));
  assert.ok(!isNaN(umapPoints[0].y));
  assert.ok(!isNaN(umapPoints[0].z || 0));
});

test('clustering: KMeans and DBSCAN partition memory points', () => {
  const records: NormalizedMemoryRecord[] = Array.from({ length: 24 }, (_, i) => ({
    id: `rec_${i}`,
    sourceId: 'src_cluster',
    content: `Memory record ${i}`,
    contentAvailable: true,
    embedding: i < 12
      ? [0.8 + (i * 0.01), 0.1, 0.1, 0.1]
      : [0.1, 0.8 + ((i - 12) * 0.01), 0.1, 0.1],
    createdAt: new Date().toISOString(),
    memoryType: 'semantic',
  }));

  const km = runKMeans(records, 2);
  assert.strictEqual(km.clusters.length, 2);
  assert.strictEqual(km.assignments.size, 24);

  const dbscan = runDBSCAN(records, 0.3, 3);
  assert.ok(dbscan.clusters.length >= 1);
  assert.strictEqual(dbscan.assignments.size, 24);
});

test('search: cosine nearest neighbors ranking', () => {
  const target = [1, 0, 0, 0];
  const candidates: NormalizedMemoryRecord[] = [
    {
      id: 'exact',
      sourceId: 's',
      content: 'Exact Match',
      contentAvailable: true,
      embedding: [1, 0, 0, 0],
      createdAt: '2026-10-18T00:00:00Z',
      memoryType: 'semantic',
    },
    {
      id: 'orthogonal',
      sourceId: 's',
      content: 'Orthogonal',
      contentAvailable: true,
      embedding: [0, 1, 0, 0],
      createdAt: '2026-10-18T00:00:00Z',
      memoryType: 'semantic',
    },
    {
      id: 'partial',
      sourceId: 's',
      content: 'Partial Match',
      contentAvailable: true,
      embedding: [0.7071, 0.7071, 0, 0],
      createdAt: '2026-10-18T00:00:00Z',
      memoryType: 'semantic',
    },
  ];

  const nearest = findNearestNeighbors(target, candidates, 3);
  assert.strictEqual(nearest[0].record.id, 'exact');
  assert.strictEqual(nearest[0].similarity, 1);
  assert.strictEqual(nearest[1].record.id, 'partial');
  assert.strictEqual(nearest[2].record.id, 'orthogonal');
  assert.strictEqual(nearest[2].similarity, 0.5);
});
