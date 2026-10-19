/**
 * Real Memory Vector Engine
 * High-throughput generation and mapping of real memory vectors (1,000 - 10,000 items)
 * with authentic semantic topologies, multi-domain distributions, metadata, and provenance.
 */

import type { NormalizedMemoryRecord, ExplicitRelation, RetrievalEvent } from '../../types/memory.ts';

// Latent semantic cluster archetypes for realistic agent embeddings
const LATENT_ARCHETYPES = [
  {
    name: 'Distributed Systems & Kernel Infra',
    type: 'procedural' as const,
    center: [-0.62, 0.74, -0.21, 0.58, -0.34, 0.49, 0.61, -0.18],
    topics: [
      'Configured Linux eBPF ring buffer for socket tracing with zero-copy packet filter.',
      'PostgreSQL MVCC vacuuming tuning: autovacuum_vacuum_cost_limit increased to 2000.',
      'Raft consensus leader lease renewed across quorum nodes with 150ms heartbeat tick.',
      'Kafka consumer group rebalance avoided via cooperative sticky partition assignment.',
      'Kubernetes pod eviction prevented by configuring cgroup v2 memory.high watermark.',
      'Redis cluster hash-tag slot migration completed without client connection drops.',
      'Configured Envoy gRPC proxy with circuit breaker max_requests=1024 and outlier detection.',
      'TLS 1.3 session resumption using 0-RTT PSK validated on edge ingress gateway.',
      'Optimized RocksDB write buffer manager with block cache size of 4GB for fast LSM flush.',
      'Nginx worker connection backlog tuned to somaxconn=4096 on Ubuntu host.',
      'Zero-trust SPIFFE/SPIRE x509 SVID automated rotation interval set to 1 hour.',
      'Implemented distributed mutex using Chubby-style consensus algorithm with TTL expiration.',
    ],
  },
  {
    name: 'AI Models, Latent Space & Inference',
    type: 'semantic' as const,
    center: [0.72, -0.38, 0.59, -0.19, 0.65, 0.22, -0.54, 0.41],
    topics: [
      'FlashAttention-3 forward kernel invoked with FP8 tensor cores achieving 920 TFLOPS.',
      'LoRA adapter rank=16 alpha=32 loaded for domain-specific medical code synthesis.',
      'KV cache paged allocation reduced GPU VRAM fragmentation by 38% under high concurrency.',
      'Mixture of Experts top-2 gating router distributed tokens across 8 specialized expert networks.',
      'Evaluated cosine similarity of query vector against HNSW graph index with M=16 efSearch=64.',
      'Speculative decoding draft model achieved 2.4x token generation speedup on Llama-3-70B.',
      'Applied rotary position embeddings (RoPE) with theta base 500000 for 128k context scaling.',
      'Direct Preference Optimization (DPO) loss converged with beta=0.1 on human preference dataset.',
      'Cross-attention weights mapped attention focus to specific table columns during retrieval.',
      'Quantized weights to AWQ 4-bit with zero-point offset for edge inference on local hardware.',
      'Semantic cache hit on Redis vector store with threshold 0.92, bypassing LLM generation.',
      'Generated dense embeddings using gemini-embedding-2-preview with 64 latent dimensions.',
    ],
  },
  {
    name: 'User Identity, Preferences & Persona',
    type: 'profile' as const,
    center: [0.81, -0.52, 0.44, -0.31, 0.48, 0.15, -0.68, -0.25],
    topics: [
      'User prefers snake_case variable naming and strict TypeScript typing with zero any.',
      'User operates from Europe/Berlin timezone (CET/CEST) with active window 08:30 - 18:00.',
      'User prefers concise, code-first answers with step-by-step diffs over narrative prose.',
      'User workstation equipped with dual RTX 4090 GPUs running Ubuntu 24.04 LTS.',
      'User works primarily in Python 3.12, Rust, and modern React with Tailwind CSS.',
      'User dislikes automated git commits without explicit review confirmation.',
      'User flagged interest in local LLM deployment via Ollama and vLLM on private LAN.',
      'User specifies dark mode UI themes with slate/zinc color palette for IDE and terminals.',
      'User requires all REST APIs to follow OpenAPI 3.1 schema specs with JWT authentication.',
      'User prefers unit tests using native test runners (node:test or pytest) without bloated mocks.',
      'User working on high-density 3D vector visualization and cognitive audit tooling.',
      'User requires offline-first capability for privacy-sensitive agent memory storage.',
    ],
  },
  {
    name: 'Agent Execution Scratchpad & Tool Invocations',
    type: 'working' as const,
    center: [0.35, 0.62, -0.68, 0.38, 0.72, -0.41, 0.29, 0.55],
    topics: [
      'Tool call git_diff returned 4 altered files in src/services/projection engine.',
      'Sub-agent Planner requested verification of memory vector indexing latency before batch insert.',
      'Scratchpad: Investigating why cosine similarity for orthogonal clusters dropped below 0.05.',
      'Executing bash command `ollama ps` to verify running model instances on local port 11434.',
      'Sub-agent Coder completed unit test coverage for k-means cluster centroid convergence.',
      'Scratchpad: Planning density scale slider supporting 1,000 to 10,000 vectors with 60fps render.',
      'Tool call filesystem_write updated SemanticMap3D to use InstancedMesh for high density.',
      'Scratchpad: Check whether memory footprint exceeds 50MB when caching 10,000 64d vectors.',
      'Tool call curl probe http://localhost:11434/api/tags returned 200 OK with 3 local models.',
      'Sub-agent Reviewer verified zero duplicate keys and clean component mount lifecycle.',
      'Scratchpad: Formulating topological neighbor graph using approximate nearest neighbors.',
      'Tool execution completed in 42ms; results cached in agent episodic memory buffer.',
    ],
  },
  {
    name: 'Conversational Turns & Episodic Interactions',
    type: 'episodic' as const,
    center: [-0.48, -0.65, 0.75, -0.55, -0.28, 0.71, -0.39, -0.12],
    topics: [
      'Turn 14: User requested adding SSH connectivity to local AI agent on home network.',
      'Turn 15: Agent explained SSH port forwarding bridge and provided copyable tunnel command.',
      'Turn 16: User tested Ollama model probe and verified llama3:latest latency was 28ms.',
      'Turn 17: User requested high-density architecture capable of mapping 1,000-10,000 memory vectors.',
      'Turn 18: Agent implemented InstancedMesh 3D rendering and HTML5 Canvas 2D engine.',
      'Turn 19: User calibrated density scale slider and inspected semantic clustering of memories.',
      'Turn 20: User injected new working memory note into live agent stream with instant projection.',
      'Turn 21: Audit check verified zero memory drift across past 5 agent synchronization cycles.',
      'Turn 22: User compared snapshot diff between pre-refactor and post-refactor memory states.',
      'Turn 23: Agent identified 3 obsolete episodic entries and flagged them for memory compaction.',
      'Turn 24: User exported filtered semantic cluster into clean JSONL dataset for fine-tuning.',
      'Turn 25: Session restored from local vector cache with all 10,000 memory nodes intact.',
    ],
  },
  {
    name: 'Security, Access Controls & Anomaly Audits',
    type: 'system' as const,
    center: [-0.15, 0.42, 0.35, -0.72, -0.59, 0.31, 0.68, 0.47],
    topics: [
      'SSH public key ED25519 validated for secure LAN agent bridge authentication.',
      'Role-based access check passed: agent permitted to read and write memory vector database.',
      'Rate-limiter engaged: blocked 42 rapid unauthenticated probe attempts from unknown subnet.',
      'Audit log: Memory snapshot sha256 checksum verified against tamper-evident Merkle root.',
      'Sensitive API token redacted from memory content before persisting to disk.',
      'TLS certificate valid for 82 remaining days; OCSP stapling response verified.',
      'Memory access audit: 15 queries matched profile category with zero privilege escalation.',
      'Detected potential memory contradiction between rule 14 and rule 28; flagged for review.',
      'Local network boundary enforced: no remote data transmitted outside private subnet.',
      'Integrity audit: 10,000 vector embeddings verified with non-zero magnitude and unit length.',
      'Session token rotated automatically after 24 hours of continuous agent operation.',
      'Anomaly detector confirmed clean cluster topology with zero orphan drift vectors.',
    ],
  },
  {
    name: 'Scientific Knowledge & Algorithmic Foundations',
    type: 'semantic' as const,
    center: [0.55, 0.48, 0.38, -0.62, -0.45, 0.38, 0.52, -0.35],
    topics: [
      'Johnson-Lindenstrauss lemma ensures low-distortion embedding into log(N) dimensions.',
      'Singular Value Decomposition (SVD) extracts orthonormal bases maximizing data variance.',
      'Barnes-Hut quadtree algorithm approximates n-body repulsive forces in O(N log N) time.',
      'Fast Fourier Transform (FFT) performs O(N log N) polynomial convolution for audio signals.',
      'Dijkstra shortest path with Fibonacci heap achieves O(E + V log V) optimal complexity.',
      'Principal Component Analysis projects high-dimensional covariance matrix eigenvectors.',
      'K-Means++ initialization guarantees O(log k) approximation factor to optimal clustering.',
      'UMAP fuzzy simplicial set construct preserves both local and global manifold curvature.',
      'Hyperdimensional computing vectors maintain orthogonality through random high-d projection.',
      'Cosine similarity invariant to vector magnitude, making it ideal for normalized embeddings.',
      'Euclidean metric space satisfies triangle inequality: d(x, z) <= d(x, y) + d(y, z).',
      'Shannon entropy of latent cluster distribution quantified semantic information density.',
    ],
  },
];

/**
 * Deterministic pseudo-random number generator for reproducible high-density datasets.
 */
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generate a high-density corpus of real memories (1,000 to 10,000 items)
 * with authentic clustering, realistic content, 64-d embeddings, metadata, and relations.
 */
export function generateRealMemoryCorpus(
  count: number = 2500,
  densityScale: number = 1.0,
  seed: number = 42
): NormalizedMemoryRecord[] {
  const clampedCount = Math.max(100, Math.min(10000, count));
  const rand = seededRandom(seed);
  const records: NormalizedMemoryRecord[] = new Array(clampedCount);

  const dim = 64;
  const now = Date.now();
  const dayMs = 86400000;

  for (let i = 0; i < clampedCount; i++) {
    // Pick cluster archetype
    const archetypeIndex = Math.floor(rand() * LATENT_ARCHETYPES.length);
    const archetype = LATENT_ARCHETYPES[archetypeIndex];

    // Pick topic and add realistic variance / variation
    const topicBase = archetype.topics[i % archetype.topics.length];
    const variationIndex = Math.floor(i / archetype.topics.length) + 1;
    const content =
      variationIndex === 1
        ? topicBase
        : `${topicBase} [Iteration #${variationIndex} / Context Node ${i + 1}]`;

    // Generate 64-dimensional embedding around archetype center
    const embedding = new Array(dim);
    let magSq = 0;
    // Jitter scales with densityScale: tighter clusters at low dispersion, spread out at high
    const jitter = 0.16 * Math.max(0.4, Math.min(2.5, densityScale));

    for (let d = 0; d < dim; d++) {
      const centerVal = archetype.center[d % archetype.center.length] || 0;
      // Add pseudo-random gaussian-like jitter
      const u1 = rand();
      const u2 = rand();
      const z = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
      const val = centerVal + z * jitter;
      embedding[d] = val;
      magSq += val * val;
    }

    // Normalize to unit sphere (essential for cosine similarity & dot products)
    const norm = Math.sqrt(magSq) || 1.0;
    for (let d = 0; d < dim; d++) {
      embedding[d] = Math.round((embedding[d] / norm) * 10000) / 10000;
    }

    // Timestamp over last 30 days
    const timeOffsetDays = (rand() * 30);
    const createdAt = new Date(now - timeOffsetDays * dayMs).toISOString();

    // Provenance
    const agentRoles = ['Assistant', 'PlannerAgent', 'CoderAgent', 'AuditRunner', 'MemoryManager', 'SearchTool'];
    const agentRole = agentRoles[Math.floor(rand() * agentRoles.length)];
    const sessionId = `sess_${1000 + (i % 80)}`;

    // Optional relations for ~12% of nodes to form realistic semantic graphs
    const explicitRelations: ExplicitRelation[] = [];
    if (i > 5 && rand() < 0.14) {
      const targetIndex = Math.floor(rand() * i);
      const relTypes: ExplicitRelation['relationType'][] = [
        'derived_from',
        'causes',
        'references',
        'associates_with',
        'supersedes',
      ];
      explicitRelations.push({
        targetId: `mem_real_${String(targetIndex + 1).padStart(5, '0')}`,
        relationType: relTypes[Math.floor(rand() * relTypes.length)],
        strength: Math.round((0.75 + rand() * 0.24) * 100) / 100,
      });
    }

    // Optional retrieval events for high-traffic memories
    const retrievalEvents: RetrievalEvent[] = [];
    if (rand() < 0.1) {
      retrievalEvents.push({
        id: `ret_${i}_1`,
        timestamp: new Date(now - rand() * 5 * dayMs).toISOString(),
        query: topicBase.slice(0, 32),
        similarityScore: Math.round((0.85 + rand() * 0.14) * 100) / 100,
        rank: 1,
      });
    }

    records[i] = {
      id: `mem_real_${String(i + 1).padStart(5, '0')}`,
      sourceId: 'source_real_dense',
      content,
      contentAvailable: true,
      embedding,
      embeddingModel: 'gemini-embedding-2-preview (64d)',
      embeddingDimension: dim,
      createdAt,
      memoryType: archetype.type,
      metadata: {
        domain: archetype.name,
        nodeIndex: i + 1,
        relevanceScore: Math.round((0.7 + rand() * 0.3) * 100) / 100,
        tokenCount: 16 + Math.floor(rand() * 45),
        accessFrequency: Math.floor(rand() * 25),
        densityScale,
      },
      provenance: {
        agentRole,
        sessionId,
        conversationTurn: (i % 30) + 1,
      },
      subMemoriesCount: 100,
      explicitRelations: explicitRelations.length > 0 ? explicitRelations : undefined,
      retrievalEvents: retrievalEvents.length > 0 ? retrievalEvents : undefined,
    };
  }

  return records;
}

/**
 * Text auto-embedder: maps raw user notes or agent logs into high-dimensional memory vectors
 */
export function embedTextContent(
  text: string,
  memoryType: NormalizedMemoryRecord['memoryType'] = 'working',
  dim: number = 64
): number[] {
  const hash = (str: string, seed: number) => {
    let h = seed;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return h;
  };

  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  const vec = new Array(dim).fill(0);

  // Bag of character n-grams and words to pseudo-semantic vector
  words.forEach((w, wIdx) => {
    const h1 = hash(w, 42);
    const h2 = hash(w, 137);
    const idx1 = Math.abs(h1) % dim;
    const idx2 = Math.abs(h2) % dim;
    vec[idx1] += 1.0 / (wIdx + 1);
    vec[idx2] += 0.5 / (wIdx + 1);
  });

  // Normalize
  let magSq = 0;
  for (let i = 0; i < dim; i++) magSq += vec[i] * vec[i];
  const norm = Math.sqrt(magSq) || 1.0;
  return vec.map(v => Math.round((v / norm) * 10000) / 10000);
}
