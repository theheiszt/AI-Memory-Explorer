# AI Memory Explorer — Windows Desktop Edition

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20(x64)-blue.svg)](#system-requirements)
[![Release](https://img.shields.io/badge/Release-v1.0.0-emerald.svg)](#distribution-packages)
[![Tests](https://img.shields.io/badge/Automated%20Tests-39%2F39%20Passing-brightgreen.svg)](#automated-testing)
[![Security](https://img.shields.io/badge/Security-Hardened%20%7C%20Read--Only-indigo.svg)](#security--privacy)

**AI Memory Explorer** is a provider-independent semantic inspection workspace and multidimensional vector landscape for AI agent memories. It converts high-dimensional latent memory spaces into interactive 2D and 3D topological manifolds, enabling developers, researchers, and operators to inspect agent recall, analyze semantic clustering, audit knowledge drift, and compare memory snapshots over time.

---

## Key Features

- **Interactive Semantic Manifold (2D & 3D):**
  - High-performance 2D Canvas rendering with smooth panning, zooming, hovering, and point inspection.
  - Optional 3D Latent Space exploration powered by Three.js with automatic graceful fallback to 2D when WebGL/hardware acceleration is unavailable.
  - Real-time PCA (Principal Component Analysis) and UMAP (Uniform Manifold Approximation and Projection) algorithms.
- **Provider-Independent Data Adapters (Read-Only):**
  - Direct import for JSON arrays, JSONL streams, and CSV files with custom field mapping.
  - Native query connectors for SQLite, Qdrant, ChromaDB, and Generic REST memory endpoints.
  - LAN Agent Bridge: Connect to Ollama, LM Studio, LangGraph, or custom agent daemons via HTTP or SSH LAN tunnels.
- **Precision Inspection & Vector Search:**
  - Lexical, vector (cosine nearest-neighbors), and hybrid search with adjustable similarity thresholds.
  - Memory inspector revealing stable IDs, memory types (semantic, episodic, procedural, working, profile), latent dimensions, and metadata.
  - Distinguishes explicit source relationships (causal edges, references) from inferred spatial KNN clusters.
- **Snapshot Diffing & Historical Evolution:**
  - Automated comparison between memory snapshots detecting additions, deletions, mutations, and cluster migrations.
- **Privacy & Security Hardened:**
  - 100% read-only external access; zero mutation of source files or remote databases.
  - Offline-first architecture: core projection, search, clustering, and export execute purely on-device without network access.
  - Cognitive Audit features an on-device local reasoning engine, with optional opt-in Gemini cloud synthesis.
  - Automatic PII and credential redaction (`[REDACTED_SECRET]`) in diagnostics and exports.

---

## Distribution Packages

The application is distributed as a self-contained Windows application requiring **no external runtimes** (no Node.js, Python, or npm required).

| Format | File | Description |
|---|---|---|
| **NSIS Installer** | `release/AI Memory Explorer Setup 1.0.0.exe` | Standard Windows setup wizard with desktop shortcut, Start Menu shortcut, and Add/Remove Programs integration. |
| **Portable Executable** | `release/AI Memory Explorer 1.0.0.exe` | Zero-install standalone executable that runs directly from any folder or USB drive. |

Download the latest executables from the `release/` directory or build them from source.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + O` | Import Memory Dataset (JSON, CSV, SQLite) |
| `Ctrl + S` | Export Current Dataset / Projections / Diagnostics |
| `Ctrl + K` | Connect Live AI Agent Server / LAN SSH Host |
| `Ctrl + ,` | Open Application Settings |
| `Ctrl + 1` | Switch to 2D Semantic Map |
| `Ctrl + 2` | Switch to 3D Latent Space |
| `Ctrl + 3` | Switch to Table Explorer |
| `Ctrl + 4` | Switch to Snapshot History Diff |
| `Ctrl + 5` | Switch to Cognitive Audit |
| `F5` | Recompute Projections & Clusters |
| `F11` | Toggle Fullscreen |
| `Alt + F4` | Exit Application |

---

## Building from Source

### Prerequisites
- Windows 10 or 11 (64-bit)
- Node.js 20 or higher
- npm (bundled with Node.js)

### Build Steps

1. **Clone the repository and install dependencies:**
   ```powershell
   git clone <repo-url>
   cd "AI Memory Explorer"
   $env:PATH = $env:PATH.Replace('"', '')
   npm install
   ```

2. **Run the desktop application in development mode:**
   ```powershell
   npm run build
   npx electron .
   ```

3. **Run the automated test suite:**
   ```powershell
   npm test
   ```

4. **Compile the production installer and portable executable:**
   ```powershell
   npm run package:win
   ```
   Artifacts are output to `release/`:
   - `AI Memory Explorer Setup 1.0.0.exe`
   - `AI Memory Explorer 1.0.0.exe`

---

## Troubleshooting Common Windows Issues

### 1. Port Collisions
- **Issue:** Another local service is using port 3000.
- **Resolution:** The desktop shell automatically requests an OS-assigned dynamic ephemeral port (port `0`) upon startup and binds strictly to `127.0.0.1`. Port collisions are mathematically avoided.

### 2. Graphics Driver / Hardware Acceleration
- **Issue:** 3D Latent Space fails to initialize or stutters on older hardware or virtual machines.
- **Resolution:** AI Memory Explorer includes a hardware-independent pure 2D HTML5 Canvas rendering engine. If WebGL or DirectX hardware acceleration is unavailable, switch to the 2D Semantic Map tab (`Ctrl+1`), which executes deterministically using software rasterization.

### 3. File Path Length Limits (MAX_PATH)
- **Issue:** Windows 260-character path limit errors during deep repository builds.
- **Resolution:** Enable long paths in Windows Registry (`LongPathsEnabled = 1` under `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem`) or install to standard user directory `%LOCALAPPDATA%\Programs\AI Memory Explorer`.

### 4. Stray Quotes in Windows PATH
- **Issue:** Subprocesses report `'D:\Program' is not recognized` or syntax errors during npm execution.
- **Resolution:** In PowerShell, sanitize PATH before running build tools:
  ```powershell
  $env:PATH = $env:PATH.Replace('"', '')
  ```

---

## Security & Privacy Architecture

- **Loopback Enforcement:** Internal HTTP server binds strictly to `127.0.0.1` and drops any non-loopback network packets with HTTP 403.
- **Renderer Isolation:** Electron BrowserWindow enforces `contextIsolation: true`, `nodeIntegration: false`, and `webSecurity: true`.
- **Bridge Protection:** IPC file operations validate inputs against null bytes, resolve canonical paths, and disallow writes to executable extensions (`.exe`, `.bat`, `.cmd`, `.ps1`, `.dll`, etc.).
- See [`docs/WINDOWS_DESKTOP_SECURITY.md`](docs/WINDOWS_DESKTOP_SECURITY.md) for full threat model and mitigation matrix.

---

## License

Copyright © 2026 AI Memory Explorer Team. Distributed under the MIT License.
