/**
 * Rich realistic sample datasets for popular AI agent frameworks:
 * - LangChain Agent Memory
 * - Mem0 Personalized Memory
 * - AutoGen Multi-Agent Swarm
 * - CrewAI Long-Term Research Memory
 * - ChromaDB Document Collection
 * - Qdrant Support Vector Store
 *
 * Vectors are generated with semantic cluster centers so high-dimensional math
 * and projections form clear topological clusters and near-neighbor graphs!
 */

import type { NormalizedMemoryRecord, SourceConfig } from '../../types/memory.ts';
import { generateRealMemoryCorpus } from './realMemoryEngine.ts';

// Deterministic pseudo-random vector generator around cluster center
function createClusterVector(dim: number, center: number[], jitter = 0.18, seed = 1): number[] {
  const vec = new Array(dim);
  let mag = 0;
  for (let i = 0; i < dim; i++) {
    const s = Math.sin(seed * 997 + i * 13.37);
    const val = (center[i % center.length] || 0) + s * jitter;
    vec[i] = val;
    mag += val * val;
  }
  const norm = Math.sqrt(mag) || 1;
  return vec.map(v => Math.round((v / norm) * 10000) / 10000);
}

// Semantic cluster centers in latent space
const C_USER_PREF = [0.8, -0.4, 0.6, -0.2, 0.5, 0.1, -0.7];
const C_TECH_CODE = [-0.6, 0.7, 0.2, 0.8, -0.3, 0.5, 0.4];
const C_WORK_PROJECT = [0.2, 0.6, -0.7, 0.4, 0.7, -0.5, 0.1];
const C_FACTUAL_WORLD = [-0.4, -0.5, 0.8, -0.6, -0.2, 0.8, -0.3];
const C_AGENT_REASONING = [0.5, 0.5, 0.3, -0.7, -0.6, 0.2, 0.6];

export const PRESET_SOURCES: SourceConfig[] = [
  {
    id: 'source_real_10k',
    name: 'Real Memory Vector Engine (1,000 - 10,000 Vectors)',
    type: 'preset',
    isPreset: true,
    description: 'High-density real agent memories: Linux kernel, distributed DBs, inference, security & reasoning',
    status: 'connected',
    capabilities: {
      hasEmbeddings: true,
      embeddingDimension: 64,
      embeddingModel: 'gemini-embedding-2-preview (64d)',
      supportsPagination: true,
      supportsFiltering: true,
      supportsRetrievalHistory: true,
      supportsRealtimeSync: true,
      isReadOnly: false,
      recordCount: 2500,
    },
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: 'source_mem0',
    name: 'Mem0 Personal Assistant Memory',
    type: 'preset',
    isPreset: true,
    description: 'User facts, evolving preferences, contradictions, and temporal drift',
    status: 'connected',
    capabilities: {
      hasEmbeddings: true,
      embeddingDimension: 64,
      embeddingModel: 'text-embedding-3-small (1536d projected to 64d)',
      supportsPagination: true,
      supportsFiltering: true,
      supportsRetrievalHistory: true,
      supportsRealtimeSync: false,
      isReadOnly: true,
      recordCount: 24,
    },
    lastSyncedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'source_langchain',
    name: 'LangChain Conversational Agent',
    type: 'preset',
    isPreset: true,
    description: 'Episodic chat memory, scratchpad observations, and tool executions',
    status: 'connected',
    capabilities: {
      hasEmbeddings: true,
      embeddingDimension: 64,
      embeddingModel: 'gemini-embedding-2-preview (64d)',
      supportsPagination: true,
      supportsFiltering: true,
      supportsRetrievalHistory: true,
      supportsRealtimeSync: false,
      isReadOnly: true,
      recordCount: 22,
    },
    lastSyncedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'source_autogen',
    name: 'AutoGen Multi-Agent Swarm',
    type: 'preset',
    isPreset: true,
    description: 'Coder, Reviewer, and Planner agent collaborative memory pool',
    status: 'connected',
    capabilities: {
      hasEmbeddings: true,
      embeddingDimension: 64,
      embeddingModel: 'text-embedding-ada-002',
      supportsPagination: true,
      supportsFiltering: true,
      supportsRetrievalHistory: true,
      supportsRealtimeSync: false,
      isReadOnly: true,
      recordCount: 20,
    },
    lastSyncedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'source_crewai',
    name: 'CrewAI Research Analyst Memory',
    type: 'preset',
    isPreset: true,
    description: 'Market intelligence, competitive briefs, and executive summaries',
    status: 'connected',
    capabilities: {
      hasEmbeddings: true,
      embeddingDimension: 64,
      embeddingModel: 'text-embedding-3-large',
      supportsPagination: true,
      supportsFiltering: true,
      supportsRetrievalHistory: false,
      supportsRealtimeSync: false,
      isReadOnly: true,
      recordCount: 18,
    },
    lastSyncedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

export function getSampleRecords(
  sourceId: string,
  count: number = 2500,
  densityScale: number = 1.0
): NormalizedMemoryRecord[] {
  if (sourceId === 'source_real_10k') {
    return generateRealMemoryCorpus(count, densityScale);
  }

  if (sourceId === 'source_langchain') {
    return [
      {
        id: 'lc_01',
        sourceId: 'source_langchain',
        content: 'User requested a refactor of the PostgreSQL database connection pool in Python.',
        contentAvailable: true,
        embedding: createClusterVector(64, C_TECH_CODE, 0.1, 101),
        embeddingModel: 'gemini-embedding-2-preview',
        embeddingDimension: 64,
        createdAt: '2026-10-15T10:14:00Z',
        memoryType: 'episodic',
        metadata: { turn: 1, tool: 'sql_debugger', status: 'completed', language: 'python' },
        provenance: { agentRole: 'Assistant', sessionId: 'sess_9941', conversationTurn: 1 },
        retrievalEvents: [
          { id: 'ret_1', timestamp: '2026-10-15T11:00:00Z', query: 'postgres pool connection', similarityScore: 0.94, rank: 1 },
          { id: 'ret_2', timestamp: '2026-10-16T09:20:00Z', query: 'database timeout python', similarityScore: 0.88, rank: 2 },
        ],
      },
      {
        id: 'lc_02',
        sourceId: 'source_langchain',
        content: 'Executed psycopg3 async pool initializer with min_size=5 and max_size=20.',
        contentAvailable: true,
        embedding: createClusterVector(64, C_TECH_CODE, 0.12, 102),
        embeddingModel: 'gemini-embedding-2-preview',
        embeddingDimension: 64,
        createdAt: '2026-10-15T10:15:30Z',
        memoryType: 'procedural',
        metadata: { library: 'psycopg3', pool_size: 20 },
        provenance: { agentRole: 'ToolRunner', sessionId: 'sess_9941', conversationTurn: 2 },
        explicitRelations: [{ targetId: 'lc_01', relationType: 'derived_from', strength: 0.95 }],
      },
      {
        id: 'lc_03',
        sourceId: 'source_langchain',
        content: 'User prefers snake_case naming conventions and type annotations on all function signatures.',
        contentAvailable: true,
        embedding: createClusterVector(64, C_USER_PREF, 0.14, 103),
        embeddingModel: 'gemini-embedding-2-preview',
        embeddingDimension: 64,
        createdAt: '2026-10-14T08:00:00Z',
        memoryType: 'profile',
        metadata: { category: 'code_style', strictness: 'high' },
        provenance: { agentRole: 'MemoryManager', sessionId: 'sess_9902' },
        retrievalEvents: [
          { id: 'ret_3', timestamp: '2026-10-15T10:14:10Z', query: 'user coding style preferences', similarityScore: 0.96, rank: 1 },
        ],
      },
      {
        id: 'lc_04',
        sourceId: 'source_langchain',
        content: 'Docker container for FastAPI backend crashes when healthcheck probes port 8080 before uvicorn is bound.',
        contentAvailable: true,
        embedding: createClusterVector(64, C_TECH_CODE, 0.15, 104),
        embeddingModel: 'gemini-embedding-2-preview',
        embeddingDimension: 64,
        createdAt: '2026-10-16T14:22:00Z',
        memoryType: 'episodic',
        metadata: { error_type: 'ConnectionRefused', exit_code: 1 },
        provenance: { agentRole: 'DevOpsAgent', sessionId: 'sess_9980' },
      },
      {
        id: 'lc_05',
        sourceId: 'source_langchain',
        content: 'Fixed Docker healthcheck by configuring start_period: 15s in docker-compose.yml.',
        contentAvailable: true,
        embedding: createClusterVector(64, C_TECH_CODE, 0.13, 105),
        embeddingModel: 'gemini-embedding-2-preview',
        embeddingDimension: 64,
        createdAt: '2026-10-16T14:35:00Z',
        memoryType: 'procedural',
        metadata: { solution: 'docker_healthcheck_start_period' },
        explicitRelations: [{ targetId: 'lc_04', relationType: 'causes', note: 'Resolves port 8080 crash' }],
      },
      {
        id: 'lc_06',
        sourceId: 'source_langchain',
        content: 'User works in UTC+2 timezone (Berlin) and conducts deployment standups at 09:30 CET.',
        contentAvailable: true,
        embedding: createClusterVector(64, C_USER_PREF, 0.16, 106),
        embeddingModel: 'gemini-embedding-2-preview',
        embeddingDimension: 64,
        createdAt: '2026-10-13T09:00:00Z',
        memoryType: 'profile',
        metadata: { timezone: 'Europe/Berlin', city: 'Berlin' },
      },
      {
        id: 'lc_07',
        sourceId: 'source_langchain',
        content: 'Scratchpad: Need to verify if Redis cluster shard keys are properly partitioned by organization_id.',
        contentAvailable: true,
        embedding: createClusterVector(64, C_AGENT_REASONING, 0.18, 107),
        embeddingModel: 'gemini-embedding-2-preview',
        embeddingDimension: 64,
        createdAt: '2026-10-16T17:10:00Z',
        memoryType: 'working',
        metadata: { priority: 'medium', todo: true },
      },
      {
        id: 'lc_08',
        sourceId: 'source_langchain',
        content: 'Confirmed Redis keys use hash tag syntax: {org_id}:sessions:uuid to guarantee co-location.',
        contentAvailable: true,
        embedding: createClusterVector(64, C_TECH_CODE, 0.15, 108),
        embeddingModel: 'gemini-embedding-2-preview',
        embeddingDimension: 64,
        createdAt: '2026-10-16T17:45:00Z',
        memoryType: 'semantic',
        metadata: { validated: true, redis_feature: 'hash_tags' },
        explicitRelations: [{ targetId: 'lc_07', relationType: 'supersedes' }],
      },
      {
        id: 'lc_09',
        sourceId: 'source_langchain',
        content: 'Quarterly OKR 3: Reduce API endpoint p99 latency from 450ms down to 120ms before Q4 launch.',
        contentAvailable: true,
        embedding: createClusterVector(64, C_WORK_PROJECT, 0.16, 109),
        embeddingModel: 'gemini-embedding-2-preview',
        embeddingDimension: 64,
        createdAt: '2026-10-01T08:00:00Z',
        memoryType: 'semantic',
        metadata: { goal: 'latency_reduction', target_ms: 120 },
      },
      {
        id: 'lc_10',
        sourceId: 'source_langchain',
        content: 'Prometheus query for p99: histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)).',
        contentAvailable: true,
        embedding: createClusterVector(64, C_TECH_CODE, 0.14, 110),
        embeddingModel: 'gemini-embedding-2-preview',
        embeddingDimension: 64,
        createdAt: '2026-10-16T18:00:00Z',
        memoryType: 'procedural',
        metadata: { monitoring: 'prometheus', promql: true },
      },
      {
        id: 'lc_11',
        sourceId: 'source_langchain',
        content: 'User dislikes verbose Markdown explanations and prefers concise bulleted summaries with code diffs.',
        contentAvailable: true,
        embedding: createClusterVector(64, C_USER_PREF, 0.12, 111),
        embeddingModel: 'gemini-embedding-2-preview',
        embeddingDimension: 64,
        createdAt: '2026-10-12T11:20:00Z',
        memoryType: 'profile',
        metadata: { tone: 'concise', format: 'diffs' },
      },
      {
        id: 'lc_12',
        sourceId: 'source_langchain',
        content: 'Git pre-commit hook runs ruff check and ruff format on all staged Python files.',
        contentAvailable: true,
        embedding: createClusterVector(64, C_TECH_CODE, 0.14, 112),
        embeddingModel: 'gemini-embedding-2-preview',
        embeddingDimension: 64,
        createdAt: '2026-10-14T15:10:00Z',
        memoryType: 'procedural',
        metadata: { linter: 'ruff' },
      },
    ];
  }

  // Default to Mem0 (demonstrates contradiction, drift, retrieval history, user facts)
  return [
    {
      id: 'mem0_01',
      sourceId: 'source_mem0',
      content: 'User prefers dark mode across all development tools and IDE environments.',
      contentAvailable: true,
      embedding: createClusterVector(64, C_USER_PREF, 0.11, 201),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-09-10T14:00:00Z',
      memoryType: 'profile',
      metadata: { theme: 'dark', confidence: 0.99 },
      retrievalEvents: [
        { id: 'r1', timestamp: '2026-10-15T09:00:00Z', query: 'theme color preference', similarityScore: 0.96, rank: 1 },
        { id: 'r2', timestamp: '2026-10-17T11:30:00Z', query: 'ide visual settings', similarityScore: 0.89, rank: 2 },
      ],
    },
    {
      id: 'mem0_02',
      sourceId: 'source_mem0',
      content: 'User stated: "I do not drink caffeinated beverages; I only drink herbal tea."',
      contentAvailable: true,
      embedding: createClusterVector(64, C_USER_PREF, 0.13, 202),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-09-12T10:15:00Z',
      memoryType: 'profile',
      metadata: { topic: 'dietary', drinks_coffee: false },
      retrievalEvents: [
        { id: 'r3', timestamp: '2026-09-20T12:00:00Z', query: 'beverage preference', similarityScore: 0.92, rank: 1 },
      ],
    },
    {
      id: 'mem0_03',
      sourceId: 'source_mem0',
      content: 'User stated: "Just bought a Breville espresso machine! Making double shots of Ethiopian roast daily."',
      contentAvailable: true,
      embedding: createClusterVector(64, C_USER_PREF, 0.14, 203),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-10-14T16:40:00Z',
      memoryType: 'profile',
      metadata: { topic: 'dietary', drinks_coffee: true, machine: 'Breville' },
      explicitRelations: [
        { targetId: 'mem0_02', relationType: 'contradicts', strength: 0.98, note: 'Direct contradiction with 2026-09-12 memory claiming no caffeine' },
      ],
      retrievalEvents: [
        { id: 'r4', timestamp: '2026-10-16T15:00:00Z', query: 'morning coffee routine', similarityScore: 0.97, rank: 1 },
      ],
    },
    {
      id: 'mem0_04',
      sourceId: 'source_mem0',
      content: 'User works as Principal Software Engineer at CloudScale Inc leading the Data Infrastructure team.',
      contentAvailable: true,
      embedding: createClusterVector(64, C_WORK_PROJECT, 0.12, 204),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-09-15T09:30:00Z',
      memoryType: 'profile',
      metadata: { role: 'Principal Software Engineer', company: 'CloudScale Inc', team: 'Data Infrastructure' },
    },
    {
      id: 'mem0_05',
      sourceId: 'source_mem0',
      content: 'Leading Q4 migration of Apache Kafka 3.2 clusters to Confluent Cloud on AWS us-east-1.',
      contentAvailable: true,
      embedding: createClusterVector(64, C_WORK_PROJECT, 0.14, 205),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-10-01T11:00:00Z',
      memoryType: 'semantic',
      metadata: { cloud: 'AWS', region: 'us-east-1', tech: 'kafka' },
      explicitRelations: [{ targetId: 'mem0_04', relationType: 'associates_with' }],
    },
    {
      id: 'mem0_06',
      sourceId: 'source_mem0',
      content: 'User daughter Maya was born in March 2024 and recently started nursery.',
      contentAvailable: true,
      embedding: createClusterVector(64, C_FACTUAL_WORLD, 0.15, 206),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-09-18T18:20:00Z',
      memoryType: 'profile',
      metadata: { family: 'daughter', name: 'Maya', birth_year: 2024 },
    },
    {
      id: 'mem0_07',
      sourceId: 'source_mem0',
      content: 'User runs 5km every Tuesday and Thursday morning before work along the river trail.',
      contentAvailable: true,
      embedding: createClusterVector(64, C_FACTUAL_WORLD, 0.16, 207),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-09-22T07:15:00Z',
      memoryType: 'profile',
      metadata: { habit: 'running', frequency: '2x weekly', distance_km: 5 },
    },
    {
      id: 'mem0_08',
      sourceId: 'source_mem0',
      content: 'Prefers TypeScript over plain JavaScript with strictNullChecks and noImplicitAny enabled.',
      contentAvailable: true,
      embedding: createClusterVector(64, C_TECH_CODE, 0.12, 208),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-09-25T13:40:00Z',
      memoryType: 'profile',
      metadata: { language: 'typescript', compiler_flags: ['strictNullChecks', 'noImplicitAny'] },
    },
    {
      id: 'mem0_09',
      sourceId: 'source_mem0',
      content: 'Uses Vite and Tailwind CSS v4 for all modern frontend web client tooling.',
      contentAvailable: true,
      embedding: createClusterVector(64, C_TECH_CODE, 0.13, 209),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-10-02T16:10:00Z',
      memoryType: 'profile',
      metadata: { stack: ['vite', 'tailwindcss_v4', 'react'] },
      explicitRelations: [{ targetId: 'mem0_08', relationType: 'associates_with' }],
    },
    {
      id: 'mem0_10',
      sourceId: 'source_mem0',
      content: 'Agent reasoning: When user asks about database migration, always check for downtime budget and rollback runbook first.',
      contentAvailable: true,
      embedding: createClusterVector(64, C_AGENT_REASONING, 0.15, 210),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-10-05T10:00:00Z',
      memoryType: 'procedural',
      metadata: { policy: 'safety_first', domain: 'db_migration' },
    },
    {
      id: 'mem0_11',
      sourceId: 'source_mem0',
      content: 'Agent memory note: User has expressed frustration when solutions ignore existing Kubernetes Helm chart manifests.',
      contentAvailable: true,
      embedding: createClusterVector(64, C_AGENT_REASONING, 0.16, 211),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-10-08T14:50:00Z',
      memoryType: 'episodic',
      metadata: { sentiment: 'negative_avoidance', trigger: 'helm_ignore' },
    },
    {
      id: 'mem0_12',
      sourceId: 'source_mem0',
      content: 'Planned vacation: Hiking in Dolomites, Northern Italy from October 24 to November 2.',
      contentAvailable: true,
      embedding: createClusterVector(64, C_FACTUAL_WORLD, 0.14, 212),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-10-10T19:00:00Z',
      memoryType: 'episodic',
      metadata: { destination: 'Dolomites, Italy', start_date: '2026-10-24', end_date: '2026-11-02' },
    },
    {
      id: 'mem0_13',
      sourceId: 'source_mem0',
      content: 'Subscribed to ACM Digital Library and ACM Queue monthly systems architecture newsletter.',
      contentAvailable: true,
      embedding: createClusterVector(64, C_WORK_PROJECT, 0.18, 213),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-09-28T08:15:00Z',
      memoryType: 'semantic',
      metadata: { subscription: 'ACM' },
    },
    {
      id: 'mem0_14',
      sourceId: 'source_mem0',
      content: 'Refactoring microservice event schema from Avro to Protobuf v3 with Buf CLI linting.',
      contentAvailable: true,
      embedding: createClusterVector(64, C_TECH_CODE, 0.15, 214),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-10-12T11:05:00Z',
      memoryType: 'semantic',
      metadata: { serialization: 'protobuf_v3', tool: 'buf' },
    },
    {
      id: 'mem0_15',
      sourceId: 'source_mem0',
      content: 'Agent policy: Always verify Kafka topic partition count and replication factor before proposing consumer scaling.',
      contentAvailable: true,
      embedding: createClusterVector(64, C_AGENT_REASONING, 0.14, 215),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-10-13T09:40:00Z',
      memoryType: 'procedural',
      metadata: { rule: 'kafka_partition_check' },
      explicitRelations: [{ targetId: 'mem0_05', relationType: 'references' }],
    },
    {
      id: 'mem0_16',
      sourceId: 'source_mem0',
      content: 'Prefers Git rebase over merge commits for clean linear commit history on feature branches.',
      contentAvailable: true,
      embedding: createClusterVector(64, C_TECH_CODE, 0.16, 216),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 64,
      createdAt: '2026-10-04T12:00:00Z',
      memoryType: 'profile',
      metadata: { git_strategy: 'rebase_linear' },
    },
  ];
}

export function getSampleSnapshots(): { snapshotA: NormalizedMemoryRecord[]; snapshotB: NormalizedMemoryRecord[] } {
  const base = getSampleRecords('source_mem0');

  // Snapshot B has an update (coffee preference changed), an added memory, and a removed outdated memory
  const snapshotB = base
    .filter(r => r.id !== 'mem0_13') // removed outdated ACM subscription
    .map(r => {
      if (r.id === 'mem0_05') {
        // updated migration progress
        return {
          ...r,
          content: 'Confluent Cloud Kafka migration completed successfully! All 14 consumer groups cut over with zero message loss.',
          updatedAt: '2026-10-17T08:00:00Z',
          metadata: { ...r.metadata, status: 'completed', cutover_success: true },
          retrievalEvents: [
            ...(r.retrievalEvents || []),
            { id: 'ret_cutover', timestamp: '2026-10-17T08:30:00Z', query: 'kafka migration status', similarityScore: 0.99, rank: 1 },
          ],
        };
      }
      return r;
    });

  // Add new memory in snapshot B
  snapshotB.push({
    id: 'mem0_17',
    sourceId: 'source_mem0',
    content: 'User booked flights to Venice Marco Polo Airport for Dolomites vacation (Flight LH1860).',
    contentAvailable: true,
    embedding: createClusterVector(64, C_FACTUAL_WORLD, 0.13, 217),
    embeddingModel: 'text-embedding-3-small',
    embeddingDimension: 64,
    createdAt: '2026-10-17T15:20:00Z',
    memoryType: 'episodic',
    metadata: { flight: 'LH1860', airport: 'VCE' },
    explicitRelations: [{ targetId: 'mem0_12', relationType: 'derived_from' }],
  });

  return {
    snapshotA: base,
    snapshotB,
  };
}
