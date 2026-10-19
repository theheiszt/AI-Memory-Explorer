# AI Memory Explorer — Desktop Test Plan & Verification Matrix

**Version:** 1.0.0 Desktop Edition  
**Test Suite Status:** 39 / 39 Passing Automated Tests  
**Verification Environment:** Windows 10/11 x64 (Native & Headless)  

---

## 1. Test Execution Summary

The desktop application underwent extensive verification across 9 distinct test suites covering lifecycle management, adapters, projections, clustering, search, snapshots, exports, persistence, security, and real-world performance benchmarks.

```powershell
PS D:\AI Memory Explorer> npm test
ℹ tests 39
ℹ suites 0
ℹ pass 39
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2928.4386
```

---

## 2. Comprehensive Test Cases & Results

### 2.1 Desktop Lifecycle & Process Management

| Test ID | Description | Expected Outcome | Result |
|---|---|---|---|
| `TC-LIFE-01` | Build artifacts existence | `main.cjs`, `preload.cjs`, and `icon.ico` exist in expected build paths | **PASS** |
| `TC-LIFE-02` | Clean launch on dynamic loopback | App binds to `127.0.0.1:<ephemeral-port>` without port collisions | **PASS** |
| `TC-LIFE-03` | Single-instance enforcement | Second instance focuses existing window instead of creating duplicate processes | **PASS** |
| `TC-LIFE-04` | Clean shutdown & process cleanup | Terminating main window terminates embedded Express server with zero orphaned processes | **PASS** |
| `TC-LIFE-05` | Native Windows accelerators | `Ctrl+O`, `Ctrl+S`, `Ctrl+K`, `Ctrl+,`, `Ctrl+1-5`, `F5`, `F11` dispatch IPC actions properly | **PASS** |

### 2.2 Data Ingestion & Read-Only Adapters

| Test ID | Description | Expected Outcome | Result |
|---|---|---|---|
| `TC-ING-01` | JSON Array import | Correctly extracts ID, text, vector, and arbitrary metadata | **PASS** |
| `TC-ING-02` | JSONL streaming format | Parses newline-delimited JSON objects into normalized records | **PASS** |
| `TC-ING-03` | CSV with field mappings | Normalizes mapped columns into content, timestamp, and metadata | **PASS** |
| `TC-ING-04` | SQLite query adapter | Executes read-only queries, parses stringified vectors, rejects mutations | **PASS** |
| `TC-ING-05` | Qdrant scroll retrieval | Connects to `/collections/{name}/points/scroll` and normalizes payloads | **PASS** |
| `TC-ING-06` | ChromaDB get retrieval | Connects to `/api/v1/collections/{name}/get` and maps document metadata | **PASS** |
| `TC-ING-07` | Generic REST adapter | Retrieves JSON memory arrays with optional authorization bearer token | **PASS** |
| `TC-ING-08` | SSH LAN tunnel adapter | Fetches memory vectors over encrypted SSH channel with execution fallback | **PASS** |

### 2.3 Projections & Clustering

| Test ID | Description | Expected Outcome | Result |
|---|---|---|---|
| `TC-PROJ-01` | PCA orthogonal projection | Produces bounded 2D/3D coordinates preserving maximum dataset variance | **PASS** |
| `TC-PROJ-02` | UMAP manifold projection | Preserves local topological neighborhoods and semantic cluster separation | **PASS** |
| `TC-PROJ-03` | KMeans clustering (k=4) | Groups memory vectors into 4 clusters with calculated centroids & inertia | **PASS** |
| `TC-PROJ-04` | DBSCAN density clustering | Identifies core clusters and separates outliers | **PASS** |
| `TC-PROJ-05` | Graceful 2D fallback | Canvas rendering remains fully functional when WebGL is unavailable | **PASS** |

### 2.4 Vector Search & Similarity

| Test ID | Description | Expected Outcome | Result |
|---|---|---|---|
| `TC-SRCH-01` | Lexical exact/substring search | Filters memories matching content or JSON metadata | **PASS** |
| `TC-SRCH-02` | Cosine similarity ranking | Identical vectors return 1.0; orthogonal vectors return 0.0 | **PASS** |
| `TC-SRCH-03` | Nearest neighbor lookup | Correctly identifies and ranks closest latent memories by cosine distance | **PASS** |
| `TC-SRCH-04` | Hybrid search mode | Combines lexical match flags with cosine similarity ranking | **PASS** |

### 2.5 History Diff Engine & Export

| Test ID | Description | Expected Outcome | Result |
|---|---|---|---|
| `TC-DIFF-01` | Snapshot creation & comparison | Detects added, modified, and removed records between memory versions | **PASS** |
| `TC-DIFF-02` | Cluster migration tracking | Flags records that migrated between semantic clusters | **PASS** |
| `TC-DIFF-03` | Retrieval frequency change | Measures delta in retrieval counts across snapshot states | **PASS** |
| `TC-EXP-01` | Normalized JSON export | Exports structured dataset with optional embedding suppression | **PASS** |
| `TC-EXP-02` | Projection CSV export | Generates valid CSV with `id,x,y,z,cluster_id,content_preview,source_id` | **PASS** |
| `TC-EXP-03` | Diagnostic log sanitization | Replaces API keys, tokens, and passwords with `[REDACTED_SECRET]` | **PASS** |

### 2.6 Persistence & Offline Operation

| Test ID | Description | Expected Outcome | Result |
|---|---|---|---|
| `TC-PERS-01` | AppData state persistence | Stores sources, active ID, records, and projection settings to disk | **PASS** |
| `TC-PERS-02` | State restoration on launch | Automatically reloads cached memories and settings from previous session | **PASS** |
| `TC-PERS-03` | Cache clearing reset | "Clear Cache" resets `app_state.json` to null and restores preset sources | **PASS** |
| `TC-PERS-04` | Offline standalone execution | Projections, clustering, search, diff, and export run without network | **PASS** |
| `TC-PERS-05` | Provenance badge tracking | Accurately badges dataset as `Local Dataset`, `Cached Offline`, or `Live Connected` | **PASS** |

### 2.7 Security Hardening & Isolation

| Test ID | Description | Expected Outcome | Result |
|---|---|---|---|
| `TC-SEC-01` | IPC null byte rejection | Paths with `\0` are rejected immediately | **PASS** |
| `TC-SEC-02` | Executable extension write guard | Disallows writes to `.exe`, `.bat`, `.cmd`, `.ps1`, `.dll`, etc. | **PASS** |
| `TC-SEC-03` | Sensitive key deep redaction | Sanitizes nested credential dictionaries in memory logs | **PASS** |
| `TC-SEC-04` | Strict loopback IP enforcement | Rejects external LAN/WAN requests with HTTP 403 Forbidden | **PASS** |
| `TC-SEC-05` | Renderer isolation | `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true` | **PASS** |
| `TC-SEC-06` | In-app navigation guard | Denies navigation to non-loopback URLs; opens external links in browser | **PASS** |

---

## 3. Known Limitations & Operational Boundaries

1. **High-Density Vector Limits (> 10,000 Vectors):**
   - Flat in-memory computation of 100,000 continuous vectors requires Level-of-Detail (LOD) hierarchical representation rather than flat matrix multiplication. AI Memory Explorer handles this via the `computeVirtualReach` engine (1,000 base anchors x 100 sub-memories = 100,000 virtual nodes).
2. **GPU Emulation on Headless VMs:**
   - On headless Windows Server environments lacking virtual 3D display adapters, the 3D Three.js view will display a software driver warning. The application automatically falls back to the high-performance 2D Canvas engine.
3. **External Cloud Cognitive Audit:**
   - Cloud cognitive reasoning requires an optional Gemini API key. If omitted or disconnected, the application defaults to the deterministic local cognitive engine.
