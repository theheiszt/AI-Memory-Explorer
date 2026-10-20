# AI Memory Explorer — Stream Graph Mode Architecture & Design Specification

**Feature:** Stream Graph Mode (Additive Feature)  
**Version:** 1.0.0 Desktop Edition  
**Author:** AI Memory Explorer Engineering Team  
**Status:** Architecture Approved — Ready for Implementation  

---

## 1. Executive Summary & Mission

The **Stream Graph Mode** is an interactive, force-directed graph exploration environment integrated additively into the AI Memory Explorer Windows desktop application. It complements the existing 2D Semantic Landscape (UMAP/PCA manifold) and 3D Latent Space by explicitly exposing topological connectivity, causal lineage, temporal versions, retrieval associations, and semantic neighbor communities across the agent's memory universe.

### Core Tenets
1. **Additive & Non-Destructive:** Preserves all existing views (2D Map, 3D Space, Table Ledger, History & Diff, Cognitive Audit), data adapters, inspectors, and export mechanisms without regression.
2. **True Record Parity:** Every normalized memory record in the active dataset maps to a stable graph node. Zero synthetic nodes or fabricated links are introduced.
3. **Rigorous Edge Taxonomy & Provenance:** Explicit source relationships (`causes`, `contradicts`, `supersedes`) are strictly separated from inferred mathematical similarity (`cosine KNN`), temporal snapshot evolutions, and graph organizational clustering.
4. **Progressive Level-of-Detail (LOD):** Scales cleanly from 1,000 to 100,000 virtual records using cluster-aggregated overviews and on-demand micro-manifold expansion, preventing UI lockups and O(N²) edge explosion.
5. **Seamless Inspector Integration:** Selecting any graph node updates the existing sliding `<MemoryInspector>` panel with full stable ID, raw content, latent dimensions, and metadata.

---

## 2. Existing Architecture Audit & Reuse Opportunities

### 2.1 Technology Stack & Toolchain
- **Shell & Runtime:** Electron 44.9.0 with sandboxed `desktopBridge` (`contextIsolation: true`, `nodeIntegration: false`).
- **Frontend Framework:** React 19 with Vite 8 and TypeScript 7.
- **Styling:** Tailwind CSS 4 with custom dark slate palette (`#020617` base).
- **Backend Services:** Embedded loopback Express engine running on `127.0.0.1:<ephemeral-port>`.

### 2.2 Reusable Components & Engines
- **Data Model:** [`src/types/memory.ts`](../src/types/memory.ts) provides `NormalizedMemoryRecord`, `ExplicitRelation`, `RetrievalEvent`, and `ClusterInfo`.
- **Vector Math:** [`src/services/projection/vectorMath.ts`](../src/services/projection/vectorMath.ts) provides optimized `cosineSimilarity`, `euclideanDistance`, and `findNearestNeighbors`.
- **Clustering:** [`src/services/clustering/kmeans.ts`](../src/services/clustering/kmeans.ts) (`runKMeans`) and `dbscan.ts` (`runDBSCAN`).
- **Projections:** [`src/services/projection/pca.ts`](../src/services/projection/pca.ts) and `umap.ts` for spatial layout initialization hints.
- **Hierarchical LOD:** [`src/services/adapters/memoryExpansionEngine.ts`](../src/services/adapters/memoryExpansionEngine.ts) for sub-memory generation and virtual reach scaling.
- **Inspector Panel:** [`src/components/MemoryInspector.tsx`](../src/components/MemoryInspector.tsx) slides out from the right viewport margin upon record selection.

### 2.3 Identified Risks & Constraints
- **O(N²) Edge Proliferation:** An undirected graph of 10,000 nodes has ~50,000,000 possible pairs. The graph engine must enforce strict edge budgets (e.g., maximum K=3 to 5 nearest neighbors per node) and spatial/cluster thresholding.
- **Simulation Instability:** Selecting a node or hovering must **never** re-trigger the entire layout simulation or cause nodes to jump erratic distances.
- **Hardware Agnosticism:** Must remain 100% functional on machines without WebGL or DirectX acceleration. The primary layout and renderer will use high-performance HTML5 2D Canvas with sub-pixel rasterization.

---

## 3. Graph Data Model Specification

The graph model is completely decoupled from rendering logic and resides in [`src/types/streamGraph.ts`](../src/types/streamGraph.ts).

```
┌─────────────────────────────────────────────────────────────┐
│                      NormalizedMemoryRecord                 │
│   - id: "mem_101"                                           │
│   - sourceId: "source_real_10k"                             │
│   - memoryType: "episodic"                                  │
│   - content: "Configured Linux eBPF ring buffer..."        │
│   - embedding: [0.12, -0.45, ...]                           │
│   - explicitRelations: [{ targetId: "mem_102", ... }]       │
│   - retrievalEvents: [{ id: "ret_1", ... }]                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ Transforms into
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      StreamGraphNode                        │
│   - id: "node_mem_101"                                      │
│   - memoryId: "mem_101"                                     │
│   - nodeKind: "memory" | "cluster"                          │
│   - clusterId: 2                                            │
│   - isVisible: true                                         │
│   - isExpanded: false                                       │
│   - x: 420.5, y: 310.2                                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Connected by
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      StreamGraphEdge                        │
│   - id: "edge_mem_101_mem_102_explicit"                     │
│   - source: "node_mem_101"                                  │
│   - target: "node_mem_102"                                  │
│   - type: "explicit" | "similarity" | "temporal" | ...      │
│   - relation: "causes" | "contradicts" | "supersedes"       │
│   - weight: 0.95                                            │
│   - provenance: "source" | "computed" | "inferred"          │
│   - directed: true                                          │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Node Schema (`StreamGraphNode`)
```ts
export type StreamGraphNodeKind = 'memory' | 'cluster' | 'source' | 'event';

export interface StreamGraphNode {
  id: string; // Stable prefixed node ID, e.g. "node_" + record.id
  memoryId: string; // Resolves to NormalizedMemoryRecord.id
  sourceId: string;
  label: string; // Truncated preview (max 40 chars)
  category: string; // e.g. 'episodic', 'semantic', 'cluster_hub'
  timestamp?: string;
  updatedAt?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  clusterId?: number;
  metadata?: Record<string, unknown>;
  nodeKind: StreamGraphNodeKind;
  isVisible: boolean;
  isExpanded?: boolean;
  memberCount?: number; // For cluster nodes
  
  // Physical Simulation Coordinates
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null; // Fixed/pinned coordinate
  fy?: number | null;
  radius: number;
  color: string;
}
```

### 3.2 Edge Schema (`StreamGraphEdge`)
```ts
export type StreamGraphEdgeType =
  | 'explicit'    // Native causal/contradiction/superseding edges from source
  | 'similarity'  // Inferred cosine nearest neighbor
  | 'temporal'    // Version progression or temporal sequencing
  | 'retrieval'   // Recorded agent retrieval co-occurrence
  | 'cluster';    // Membership link to cluster hub

export type EdgeProvenance = 'source' | 'computed' | 'inferred';

export interface StreamGraphEdge {
  id: string; // Deterministic composite key: `${source}_${target}_${type}`
  source: string; // Source node ID
  target: string; // Target node ID
  type: StreamGraphEdgeType;
  relation?: string; // e.g. 'causes', 'contradicts', 'supersedes', 'knn'
  weight: number; // Normalized 0.0 - 1.0 (controls spring stiffness)
  confidence?: number;
  provenance: EdgeProvenance;
  directed: boolean;
}
```

### 3.3 Strict Edge Provenance Rules
1. **Explicit Source Relationships:** Retain native `relationType` (`causes`, `contradicts`, `supersedes`) with `directed = true` and `provenance = 'source'`.
2. **Semantic Similarity Edges:** Generated using `cosineSimilarity` above user-defined threshold with `directed = false`, `provenance = 'computed'`.
3. **Temporal Edges:** Derived strictly from recorded timestamps or snapshot diffs (`provenance = 'source'` or `'computed'`). Never fabricated.
4. **Retrieval Edges:** Generated only when `record.retrievalEvents` contains historical logs (`provenance = 'source'`).
5. **Cluster Edges:** Organizational hierarchy only (`provenance = 'inferred'`). Never conflated with semantic causality.

---

## 4. Force-Directed Layout Engine Architecture

### 4.1 Physics Simulation Model
The layout engine operates via a discrete Verlet/Euler integrator with four distinct force components:
1. **N-Body Node Repulsion:** Coulomb-style repulsive force between nodes ($F_{rep} = \frac{-k_{rep}}{d^2}$), preventing overlapping clutter.
2. **Hookean Edge Spring Attraction:** Edges pull connected nodes toward an equilibrium spring distance ($F_{att} = k_{spring} \cdot (d - d_0) \cdot weight$).
3. **Cluster Centroid Gravity:** Nodes belonging to the same cluster experience weak cohesive attraction toward their dynamic cluster center ($F_{clust} = k_{clust} \cdot (C_{xy} - P_{xy})$).
4. **Spatial Collision Avoidance:** Hard disc constraint preventing nodes from overlapping within $r_1 + r_2 + padding$.

### 4.2 Simulation Damping & Kinetic Cooling
- Velocity damping factor: $v_{t+1} = (v_t + a \cdot \Delta t) \cdot 0.85$.
- Alpha cooling schedule: Temperature decreases from $\alpha_{init} = 1.0$ down to $\alpha_{min} = 0.005$ over $120$ iterations.
- **Stabilization Threshold:** When total kinetic velocity drops below $\epsilon = 0.02$, simulation automatically enters `PAUSED` state to conserve CPU cycles (0% idle utilization).

### 4.3 Position Stability & Incremental Updates
- Selecting, hovering, or filtering a node **preserves cached positions**.
- Nodes can be pinned in place (`fx`, `fy`) by dragging.
- Expanding a cluster node places child nodes in a small radial orbit around the cluster center and allows localized relaxation without perturbing distant clusters.

---

## 5. Progressive Expansion & Level-of-Detail (LOD)

### 5.1 Detail Modes

| Detail Mode | Cluster Representation | Edge Budget per Node | Label Policy | Intended Scale |
|---|---|---|---|---|
| **Overview** | All clusters collapsed into summary hubs with member badges | Cluster inter-links only | Cluster names & counts | Up to 100,000 records |
| **Balanced** | Active/focused clusters expanded, others collapsed | K=2 KNN + Explicit | Cluster hubs + Selected node | Up to 25,000 records |
| **Detailed (Default)** | Individual memory nodes with cluster envelopes | K=3 KNN + Explicit + Retrieval | Selected + Direct 1-hop neighbors | Up to 10,000 records |
| **Maximum** | Full uncollapsed memory network | K=5 KNN + All available edges | Selected + 2-hop neighborhood + Pinned | Up to 5,000 records |

### 5.2 Progressive Expansion Actions
- **Expand Cluster:** Expands selected cluster hub into its constituent memory nodes.
- **Collapse Cluster:** Collapses expanded cluster nodes back into a single hub.
- **Expand 1-Hop Neighborhood:** Fetches all immediate neighbors (explicit and similarity) of the selected node and brings them into visible layout.
- **Fit-to-View:** Centers and bounds the graph camera to encompass all visible nodes.
- **Center-on-Selection:** Smooth pan to center the active memory record.

---

## 6. Rendering Strategy & Visual Taxonomy

### 6.1 High-DPI Canvas 2D Engine
- **Canvas Resolution:** Scaled by `Math.min(window.devicePixelRatio || 1, 2)`.
- **Software Fallback:** Runs reliably in headless, VM, or low-end graphics environments without WebGL crashes.
- **Smooth Interaction:** Transform matrix support for infinite panning and mouse-wheel zoom ($0.15\times$ to $5.0\times$).

### 6.2 Visual Edge Taxonomy (Multimodal Distinguishability)

| Relationship Type | Color | Stroke Style | Arrowhead | Width |
|---|---|---|---|---|
| **Explicit: causes** | `#10b981` (Emerald) | Solid Line | Directed filled arrow | 2.0 px |
| **Explicit: contradicts** | `#f43f5e` (Rose) | Dashed (`6, 4`) | Dual bidirectional bars | 2.5 px |
| **Explicit: supersedes** | `#f59e0b` (Amber) | Solid Line | Directed hollow triangle | 2.0 px |
| **Explicit: references** | `#6366f1` (Indigo) | Solid Line | Directed open chevron | 1.5 px |
| **Semantic Similarity** | `#06b6d4` (Cyan) | Dotted (`2, 3`) | None (Undirected) | Scaled by cosine score (1–3 px) |
| **Temporal Version** | `#a855f7` (Purple) | Dash-dot (`8, 3, 2, 3`) | Directed arrow | 1.5 px |
| **Retrieval Event** | `#eab308` (Yellow) | Solid Line | Circle end-marker | 2.0 px |
| **Cluster Organization** | `#334155` (Slate) | Fine Solid | None | 0.8 px (Low opacity) |

---

## 7. Search, Filtering, and Inspector Integration

### 7.1 Unified Filter Pipeline
The Stream Graph inherits the global filter state:
- Search query (lexical substring and metadata).
- Category / Memory Type (episodic, semantic, procedural, working, profile).
- Semantic Similarity Threshold (slider: $50\%$ to $99\%$).
- Cluster selector (all or specific cluster).
- Relationship type toggles (checkboxes for explicit, similarity, temporal, retrieval, cluster).

### 7.2 Search Navigation & Auto-Reveal
When a search query matches a record currently inside a collapsed cluster:
1. The containing cluster hub is highlighted with a pulsing halo.
2. If the user double-clicks or triggers "Reveal in Graph", the cluster automatically expands.
3. The camera pans smoothly to center the matched node and selects it in the inspector.

---

## 8. Performance Targets & Benchmark Gates

| Metric | Target (1,000 Nodes) | Target (10,000 Nodes) | Target (100,000 Virtual Nodes) |
|---|---|---|---|
| **Graph Construction Time** | < 25 ms | < 250 ms | < 500 ms (Cluster-aggregated) |
| **Layout Stabilization** | < 150 ms | < 2,000 ms | < 500 ms (Hub layout) |
| **Selection to Inspector** | < 10 ms | < 50 ms | < 50 ms |
| **Pan / Zoom FPS** | 60 FPS | 60 FPS | 60 FPS |
| **Memory Overhead** | < 40 MB | < 120 MB | < 200 MB |

---

## 9. Implementation Roadmap & Status

All stages have been implemented, tested, and verified:

- [x] **Stage 0: Audit & Architecture Design** (`docs/STREAM_GRAPH_DESIGN.md`)
- [x] **Stage 1: Graph Data Model** (`src/types/streamGraph.ts`, `src/services/graph/graphBuilder.ts`, `graphBuilder.test.ts`)
- [x] **Stage 2: Force-Directed Layout Simulation** (`src/services/graph/forceLayout.ts`, `forceLayout.test.ts`)
- [x] **Stage 3: Progressive Expansion & Level-of-Detail Engine** (Cluster hubs, 1-hop neighborhood reveal, `computeVirtualReach`)
- [x] **Stage 4: Relationship Engine & Visual Edge Taxonomy** (`src/services/graph/edgeStyling.ts`, `edgeStyling.test.ts`)
- [x] **Stage 5: High-DPI 2D Canvas Viewport & Inspector Integration** (`src/components/StreamGraphView.tsx`)
- [x] **Stage 6: Search, Filters & Time Range Controls** (Integrated HUD and shared similarity query bar)
- [x] **Stage 7: Windows Desktop Shell Integration & View Navigation** (`Ctrl+3` accelerator in `electron/main.ts`, header navigation tab)
- [x] **Stage 8: Performance Benchmarks & Validation** (`src/services/graph/graphBenchmarks.test.ts`, `docs/PERFORMANCE_BENCHMARKS.md`)
- [x] **Stage 9: Automated Test Suite** (All 51 unit and benchmark tests passing)
- [x] **Stage 10: Documentation & Review** (`README.md`, `PROJECT_STATUS.md`, `STREAM_GRAPH_DESIGN.md`)
