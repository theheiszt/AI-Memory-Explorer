# AI Memory Explorer — Feature Parity Matrix

**Document:** `docs/FEATURE_PARITY_MATRIX.md`  
**Date:** 2026-10-19  
**Stage:** Stage 2 (Preserve and Integrate Existing Features)  
**Status:** All Features Verified & Operational in Desktop Shell

---

## Feature Parity Matrix

| Category | Feature Description | Original Web Status | Windows Desktop Status | Verification & Test Evidence | Outstanding Defects |
|---|---|---|---|---|---|
| **Data Ingestion** | JSON Import (Arrays & Objects) | Supported via web paste | Preserved + Native Windows Open Dialog (`dialog:showOpenDialog`) | `adaptersIntegration.test.ts` (passing); tested with single/multi record JSON | None |
| **Data Ingestion** | JSONL Streaming Import | Supported via web paste | Preserved + Native File Stream | `jsonAdapter.test.ts` (passing); verified line-by-line streaming parser | None |
| **Data Ingestion** | CSV with Field Mapping | Supported via textarea | Preserved + Native Open Dialog + Dynamic Header Detection | `adaptersIntegration.test.ts` (passing); custom ID, content, embedding column mapping verified | None |
| **Data Ingestion** | SQLite Source Connection | Supported via query JSON | Preserved + Read-Only Query Row Ingestion | `adaptersIntegration.test.ts` (passing); parses rowid, stringified JSON vectors, metadata | None |
| **Data Ingestion** | Qdrant Vector DB Adapter | Supported via REST scroll | Preserved + Read-Only Scroll API | `vectorDbAdapters.ts`, `adaptersIntegration.test.ts`; read-only contract enforced | None |
| **Data Ingestion** | Chroma Vector DB Adapter | Supported via REST get | Preserved + Read-Only Collection API | `vectorDbAdapters.ts`, `adaptersIntegration.test.ts`; verified document/embedding extraction | None |
| **Data Ingestion** | Generic REST Adapter | Supported via REST endpoint | Preserved + Read-Only Health & Memory Fetch | `vectorDbAdapters.ts`, `adaptersIntegration.test.ts`; auth bearer support verified | None |
| **Data Ingestion** | Sample Memory Datasets | Supported (1k to 10k vectors) | Preserved 100% Offline | `realMemoryEngine.test.ts` (passing); unit-norm vectors with seed stability | None |
| **Visualization** | Interactive 2D Semantic Landscape | Supported (Canvas 2D) | Preserved with Software Rendering Support | `SemanticMap2D.tsx`; Canvas 2D runs with or without GPU acceleration | None |
| **Visualization** | UMAP & PCA Projection Modes | Supported | Preserved with Dynamic Density Scaling | `adaptersIntegration.test.ts`, `pca.ts`, `umap.ts`; outputs bounded 2D/3D coordinates | None |
| **Visualization** | Pan, Zoom, Hover, Selection | Supported | Preserved with Native Keyboard / Mousewheel | Interactive Canvas events; tested with high-density point picking | None |
| **Visualization** | Cluster Visualization & Hulls | Supported (KMeans / DBSCAN) | Preserved | `kmeans.test.ts`, `adaptersIntegration.test.ts`; verified centroid calculation | None |
| **Visualization** | Relation Edges | Supported | Preserved + Mode Toggle (All / Relations / KNN) | `SemanticMap2D.tsx`, `memoryExpansionEngine.test.ts`; verified synaptic ray generation | None |
| **Visualization** | 3D Latent Space Visualizer | Supported (Three.js WebGL) | Preserved + WebGL Fallback Error Boundary | `SemanticMap3D.tsx`; graceful fallback when WebGL disabled | None |
| **Inspection & Search** | Stable Memory IDs | Supported | Preserved across imports and transforms | `types/memory.ts`, normalized schema contract verified | None |
| **Inspection & Search** | Original Content & Metadata View | Supported | Preserved | `MemoryInspector.tsx`; displays raw payload, tags, and timestamps | None |
| **Inspection & Search** | Embedding Preview & Dimensions | Supported | Preserved (Dimension & Vector preview) | `MemoryInspector.tsx`; verified dimension badge and sparkline preview | None |
| **Inspection & Search** | Cosine Nearest Neighbors (KNN) | Supported | Preserved | `vectorMath.test.ts`, `adaptersIntegration.test.ts`; ranks closest memory records | None |
| **Inspection & Search** | Lexical, Vector & Hybrid Search | Supported | Preserved | `App.tsx`, `SimilaritySearch.tsx`; filters by query, threshold, and category | None |
| **Inspection & Search** | Explicit vs Inferred Relations | Supported | Preserved | Explicit source edges strictly separated from inferred cosine similarity edges | None |
| **Inspection & Search** | Retrieval Frequency & Logs | Supported | Preserved | Tested with episodic retrieval event traces | None |
| **History & Diff** | Memory Snapshot Creation | Supported in-memory | Preserved + Persistent AppData Storage | `diffEngine.test.ts`; snapshot comparison engine passing | None |
| **History & Diff** | Added/Modified/Removed Detection | Supported | Preserved | `diffEngine.test.ts` (passing); verified diff ledger output | None |
| **History & Diff** | Cluster Migration Tracking | Supported | Preserved | `HistoryView.tsx`; tracks cluster membership drift across snapshot versions | None |
| **Export** | Normalized JSON Export | Browser blob download | Preserved + Native Windows Save Dialog (`dialog:showSaveDialog`) | `adaptersIntegration.test.ts`; tested with formatted JSON output | None |
| **Export** | Projection Coordinates CSV | Browser blob download | Preserved + Native Windows Save Dialog | `adaptersIntegration.test.ts`; verified CSV column structure | None |
| **Export** | Cluster Map JSON Export | Browser blob download | Preserved + Native Windows Save Dialog | `adaptersIntegration.test.ts`; verified cluster label and centroid export | None |
| **Export** | Diagnostic Logs with PII Redaction | Browser blob download | Preserved + Redaction Bug Resolved | `exporter.ts`, `adaptersIntegration.test.ts`; fixed leak of unredacted spread context | None (Fixed) |
| **Desktop Shell** | Native Window & Controls | N/A (Web Browser) | Windows Titlebar, Frame, Icon, Min/Max | `electron/main.ts`, `lifecycle.test.ts`; verified bounds and lifecycle | None |
| **Desktop Shell** | Native Application Menu & Shortcuts | N/A (Web Browser) | File, Edit, View, Help menus with Ctrl+O/S/K/,, F5, F11 | `electron/main.ts`, `preload.ts`, `App.tsx`; verified menu event dispatch | None |
| **Desktop Shell** | Settings Screen | N/A (Web Browser) | Integrated Settings Modal (`SettingsModal.tsx`) | Allows configuring algorithm, density, Gemini key, and storage directory | None |
