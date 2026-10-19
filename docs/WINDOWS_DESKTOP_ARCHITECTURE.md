# Windows Desktop Architecture Decision & Technical Specification

**Project:** AI Memory Explorer — Windows Desktop Application Conversion  
**Document:** `docs/WINDOWS_DESKTOP_ARCHITECTURE.md`  
**Date:** 2026-10-19  
**Stage:** Stage 0 (Architecture Decision & Repository Baseline)

---

## 1. Executive Summary

AI Memory Explorer is an advanced cognitive memory exploration, inspection, and visualization platform designed to explore agent memory topologies, latent semantic projections (2D/3D), cluster graphs, diff histories, and cognitive health audits.

To convert this existing web application into an installable, standalone Windows desktop application without a ground-up rewrite, we evaluated three desktop architectures:
- **Option A — Tauri 2** (Rust + Windows WebView2)
- **Option B — PySide6 + Qt WebEngine** (Python + Qt6)
- **Option C — Electron** (Node.js + Chromium + Windows Native APIs)

**Selected Architecture:** **Option C — Electron** (Hardened Context Isolation with Local Loopback Backend Integration).

---

## 2. Framework Evaluation & Rationale

| Evaluation Criterion | Option A: Tauri 2 | Option B: PySide6 + Qt WebEngine | Option C: Electron (Selected) |
|---|---|---|---|
| **Underlying Codebase Compatibility** | Low to Medium. Existing codebase is 100% TypeScript (React 19 + Vite frontend, Express + `ssh2` + `@google/genai` backend). Moving to Tauri requires either rewriting backend in Rust or bundling external Node.js binary. | Low. No existing Python code in repository. Python 3.14 lacks pre-built PySide6/QtWebEngine wheels on Windows. Would require complete backend rewrite or separate process coordination. | **Very High.** Native execution of existing React 19 frontend and Node.js/TypeScript backend services without rewrite. |
| **Build & Toolchain Availability** | Blocked. Rust (`cargo`, `rustc`) and C++ build tools are not installed in the Windows environment. | Blocked. `PySide6` and `PyQt6.QtWebEngineWidgets` are not installed and not available for Python 3.14.7. | **Ready.** Node.js v24.14.1 and npm 11.11.0 are installed and verified. |
| **Preservation of Native Services** | Difficult. Native SSH tunnels (`ssh2`) and local AI agent probing would require reimplementation in Rust. | Medium. Requires Paramiko/Asyncio rewrite in Python. | **100% Preserved.** `ssh2`, `@google/genai`, Express, and deterministic vector projection utilities run directly. |
| **Offline Desktop Execution** | Supported via WebView2. | Supported via QtWebEngine. | **Supported natively.** Bundles static React assets (`dist/`) directly inside the package, with internal loopback bridge. |
| **Installer & Packaging** | WiX / NSIS via Cargo. | PyInstaller / Inno Setup. | **Standard NSIS Windows Installer (`.exe`) & Portable Executable** via `electron-builder`. |
| **Native Windows Capabilities** | WebView2 window controls, dialogs. | Qt6 widgets and dialogs. | Native window framing, Windows Taskbar integration, native Open/Save dialogs (`dialog.showOpenDialog`, `dialog.showSaveDialog`), Start Menu shortcut, AppData directory management. |

### Why Option C is Selected

1. **Zero Codebase Rewriting:** AI Memory Explorer already has a robust Express backend (`server.ts`) implementing LAN SSH connectivity via `ssh2`, streaming Gemini cognitive audits via `@google/genai`, and local emulator/simulation fallbacks. Electron preserves 100% of these capabilities without rewriting them in Rust or Python.
2. **Deterministic Toolchain:** Tauri 2 requires a working Rust compiler (`cargo`), C++ build tools, and WebView2 bootstrapper. Neither Rust nor PySide6 is available on the target environment. Electron relies strictly on the existing Node.js toolchain.
3. **Hardened Security Model:** Electron allows a secure-by-default architecture:
   - `contextIsolation: true`
   - `nodeIntegration: false`
   - Explicit preload bridge exposing only necessary file dialog, path, and lifecycle operations.
   - Internal backend bound strictly to loopback (`127.0.0.1`) on an ephemeral dynamic port, or integrated direct IPC.
   - External source requests remain strictly read-only.
4. **Reliable Windows Distribution:** Produces a single, self-contained Windows Installer (`.exe`) and portable executable targeting Windows 10/11 x64 that requires no external Node.js or development server on end-user machines.

---

## 3. Existing Components to Preserve

1. **Frontend UI & Visualization (`src/`):**
   - Interactive 2D semantic landscape with canvas fallback and WebGL acceleration (`src/components/SemanticMap2D.tsx`).
   - 3D latent space visualizer with Three.js orbit controls (`src/components/SemanticMap3D.tsx`).
   - Memory Inspector with cosine nearest neighbors and stable ID tracking (`src/components/MemoryInspector.tsx`).
   - High-performance Table Explorer (`src/components/TableExplorer.tsx`).
   - History & Snapshot Diff Engine (`src/components/HistoryView.tsx` & `src/services/history/diffEngine.ts`).
   - Cognitive Audit Engine with local reasoning trace fallback (`src/components/CognitiveAuditView.tsx`).
   - Modal interfaces for Import, Export, AI Server Connection, and SSH LAN bridge.
2. **Core Algorithms & Engines:**
   - Dimensionality reduction: PCA (`src/services/projection/pca.ts`) and UMAP (`src/services/projection/umap.ts`).
   - Unsupervised clustering: K-Means (`src/services/clustering/kmeans.ts`) and DBSCAN (`src/services/clustering/dbscan.ts`).
   - Vector math & cosine distance calculations (`src/services/projection/vectorMath.ts`).
   - Memory expansion engine supporting virtual reach up to 1,000,000 nodes (`src/services/adapters/memoryExpansionEngine.ts`).
   - Real memory generator generating 1,000 to 10,000 unit-norm vectors (`src/services/adapters/realMemoryEngine.ts`).
3. **Data Adapters (`src/services/adapters/`):**
   - JSON & JSONL streaming adapter (`jsonAdapter.ts`).
   - CSV adapter with custom column mapping (`csvAdapter.ts`).
   - SQLite query adapter (`vectorDbAdapters.ts`).
   - Qdrant collection adapter (`vectorDbAdapters.ts`).
   - Chroma collection adapter (`vectorDbAdapters.ts`).
   - Generic REST adapter (`vectorDbAdapters.ts`).
   - AI Agent Server & SSH LAN Bridge adapter (`aiServerAdapter.ts`).
   - Preset sample datasets (`sampleDatasets.ts`).
4. **Backend Services (`server.ts`):**
   - AI agent server probe and fetch endpoints (`/api/ai-server/probe`, `/api/ai-server/fetch`, `/api/ai-server/add-memory`).
   - SSH LAN tunnel and remote command executor (`/api/ai-server/ssh/*`).
   - Gemini memory audit and query reasoning (`/api/gemini/audit-memories`, `/api/gemini/query-reasoning`) with offline cognitive trace engine.

---

## 4. Components Requiring Modification

1. **Desktop Main Process & Window Lifecycle (`electron/main.ts`):**
   - Manage application lifecycle: create browser window with native Windows controls, frame, icon, and minimum dimensions (1024x700).
   - Embedded loopback service management: launch local backend automatically on loopback (`127.0.0.1`), using an ephemeral or isolated port, without showing any console window.
   - Proper shutdown: terminate all child processes, SSH connections, and background timers on window close. Prevent orphaned processes.
2. **Preload & Desktop Bridge (`electron/preload.ts`):**
   - Expose secure, sandboxed IPC bridge (`window.desktopBridge`):
     - `showOpenDialog`: Select files (JSON, JSONL, CSV, SQLite) via native Windows File Explorer dialog.
     - `showSaveDialog`: Save exported files (JSON, CSV) via native Windows Save dialog.
     - `getAppPaths`: Retrieve user data directory (`%APPDATA%\AI Memory Explorer`), documents path, and logs path.
     - `readLocalFile` / `writeLocalFile`: Safely read and persist local datasets and configuration within the sandboxed app data directory.
     - `platformInfo`: Identify Windows version, architecture, and desktop mode.
3. **Native File Dialog Integration in UI:**
   - Update `ImportModal.tsx` and `ExportModal.tsx` to utilize native file dialogs when running in desktop mode, while preserving browser fallback for web testing.
4. **Local Data Persistence Layer:**
   - Implement persistent storage in the user application data directory (`%APPDATA%\AI Memory Explorer\storage`):
     - Saved sources and connections.
     - Imported dataset caches.
     - Snapshot history and comparison states.
     - User preferences (density scale, color scheme, algorithm settings).
5. **Production Build Configuration:**
   - Vite production build configuration emitting clean client bundle into `dist/`.
   - TypeScript compilation for Electron main and preload processes into `dist-electron/`.
   - `electron-builder` configuration targeting Windows NSIS installer and portable executable.

---

## 5. Security Boundaries & Guardrails

1. **Context Isolation:**
   - Renderer runs with `contextIsolation: true` and `nodeIntegration: false`.
   - No direct `child_process`, `fs`, or Node.js internal access from the UI.
2. **Local Loopback Only:**
   - Express server binds strictly to `127.0.0.1` (never `0.0.0.0`).
   - All internal endpoints validate an ephemeral session token generated at startup by the desktop main process.
3. **Read-Only External Sources:**
   - External adapters (Qdrant, Chroma, SQLite, REST) remain strictly read-only. No write or delete queries are permitted to external vector stores.
4. **Path Traversal & Execution Protection:**
   - All file operations from the desktop bridge restrict paths to validated absolute paths selected explicitly by the user or located in the application data folder.
   - Imported content is never evaluated as JavaScript (`eval`, `new Function`, or raw script execution are strictly prohibited).
5. **Credential Safety:**
   - Passwords and SSH keys entered into the connection modal are kept in memory only and never serialized into diagnostic logs, crash reports, or exports.

---

## 6. Packaging & Distribution Plan

- **Target Platforms:** Windows 10 (Build 19041+) and Windows 11, x64 architecture.
- **Distribution Formats:**
  1. **NSIS Installer (`.exe`):**
     - Installs to `%LOCALAPPDATA%\Programs\AI Memory Explorer`.
     - Creates Start Menu shortcut and Desktop shortcut (optional).
     - Registers Windows Add/Remove Programs entry with clean uninstaller.
     - Preserves user data in `%APPDATA%\AI Memory Explorer` across upgrades and uninstalls.
  2. **Portable Executable (`.exe`):**
     - Single standalone executable running without installation.
- **Prerequisites:** None. All Chromium, Node.js, and application assets are bundled self-contained into the executable.

---

## 7. Trade-offs & Mitigations

| Trade-off | Impact | Mitigation |
|---|---|---|
| **Binary Size** | Electron runtime adds ~60–80 MB to distribution package compared to Tauri. | Acceptable trade-off on modern Windows systems (download size ~90 MB). Eliminates dependency on external runtimes and guarantees identical Chromium/V8 execution. |
| **Memory Footprint** | Chromium engine uses ~120–180 MB RAM for renderer and main process. | Optimized by disposing unused Three.js geometries, canvas batching, virtualization in Table Explorer, and lazy loading of 3D views. |
| **Webview vs Direct Node Process** | Managing both main process and local API server. | Express server can run inside the Electron main process as an internal HTTP loopback or direct IPC module, eliminating separate process orchestration. |
