# AI Memory Explorer — Windows Desktop Security Architecture & Threat Model

**Version:** 1.0.0 Desktop Edition  
**Target Environment:** Windows 10 / 11 (x64)  
**Security Status:** Hardened & Verified  

---

## 1. Executive Summary

AI Memory Explorer processes potentially sensitive agent memories, conversational history, embedding vectors, and local/remote database connections. This document outlines the security boundaries, threat model, permission policies, and verified mitigations implemented in the Windows desktop application.

---

## 2. Threat Model & Security Boundaries

```
┌────────────────────────────────────────────────────────────────────────┐
│                        WINDOWS DESKTOP APPLICATION                     │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────┐       │
│   │                 Chromium Renderer (UI)                     │       │
│   │   - Context Isolation: ENABLED                             │       │
│   │   - Node Integration: DISABLED                             │       │
│   │   - Web Security: ENABLED                                  │       │
│   │   - Navigation: Restricted to Loopback Origin              │       │
│   └─────────────────────────────┬──────────────────────────────┘       │
│                                 │ Sandboxed IPC Channel                │
│                                 │ (desktopBridge via preload.cjs)      │
│   ┌─────────────────────────────▼──────────────────────────────┐       │
│   │             Node.js Main Process (Electron Shell)          │       │
│   │   - Path Traversal & Null Byte Sanitization                │       │
│   │   - Executable Extension Blacklist (.exe, .bat, .ps1, etc.)│       │
│   │   - Credential Redaction in Desktop Logs                   │       │
│   │   - Single Instance Lock                                   │       │
│   └─────────────────────────────┬──────────────────────────────┘       │
│                                 │ Spawns Loopback Server               │
│                                 │ Port: Ephemeral (Auto-allocated)     │
│   ┌─────────────────────────────▼──────────────────────────────┐       │
│   │            Embedded Express Engine (Data & AI Engine)      │       │
│   │   - Loopback Binding: 127.0.0.1 ONLY (Rejects External IPs)│       │
│   │   - HTTP Security Headers (nosniff, DENY, no-referrer)    │       │
│   │   - Read-Only Adapters (SQLite, Qdrant, Chroma, REST)      │       │
│   │   - Offline Local Cognitive Engine (Zero Cloud Leaks)      │       │
│   └────────────────────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Defense-in-Depth Mitigations

### 3.1 Read-Only External Source Access
- External database adapters (SQLite, Qdrant, Chroma, Generic REST) are strictly read-only.
- Mutation queries (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`) are prohibited in query adapters.
- All visualization, clustering, similarity search, projection, and export operations execute over immutable local in-memory representations without mutating source tables or remote collections.

### 3.2 Renderer Process Isolation
- **Context Isolation (`contextIsolation: true`):** Renderer JavaScript runs in an isolated context from Node.js APIs.
- **No Node.js in Web (`nodeIntegration: false`):** Prevents XSS or malicious memory payloads from invoking `child_process`, `fs`, or native Windows APIs.
- **Web Security (`webSecurity: true`):** Enforces standard same-origin policies and CSP boundaries.
- **External Link Interception:** Links clicked within the renderer trigger `shell.openExternal(url)` to open in the user's default browser. In-app navigation away from loopback is denied.

### 3.3 Bridge Input Validation & Path Traversal Prevention
- **Null Byte Rejection:** Path parameters containing `\0` are rejected immediately with security exceptions.
- **Canonical Resolution:** All paths are normalized and resolved via `path.resolve()`.
- **Executable Write Guard:** The native file write handler blocks writes to dangerous executable formats:
  `.exe`, `.bat`, `.cmd`, `.vbs`, `.ps1`, `.dll`, `.com`, `.scr`, `.msi`, `.pif`.
- **File Read Size Quota:** File reads via bridge are capped at 100MB to prevent memory exhaustion DoS.

### 3.4 Local Loopback Network Policy
- The internal HTTP server binds strictly to IPv4 loopback (`127.0.0.1`) on an OS-allocated dynamic ephemeral port.
- Incoming requests are validated against remote socket IPs (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`). Any request originating from external LAN/WAN interfaces is rejected with HTTP `403 Forbidden`.

### 3.5 Credential & Sensitive Token Redaction
- Diagnostic logs and exported datasets are automatically sanitized by `redactSensitiveObject`.
- Any field containing sensitive substrings (`key`, `token`, `secret`, `auth`, `password`, `credential`, `bearer`) is replaced with `[REDACTED_SECRET]`.
- Desktop logs (`%APPDATA%\AI Memory Explorer\logs\desktop.log`) automatically filter object parameters through `redactLogDetails` before writing to disk.

### 3.6 Cognitive Audit Security & Privacy Guardrails
- **Opt-In Execution:** No memory records are sent to external cloud models without explicit user initiation ("Run Cognitive Audit").
- **Offline Fallback:** If no Gemini API key is configured or the network is disconnected, the system automatically uses the on-device local cognitive reflection engine.
- **Zero Automatic Mutation:** Cognitive findings suggest actions (e.g., "supersedes", "contradicts"), but never automatically rewrite or delete memories.
- **Traceable Attribution:** Every finding references stable memory IDs (`involvedMemoryIds`) so evidence can be verified by the user.

---

## 4. Automated Verification Matrix

| Security Rule | Mechanism | Automated Test Reference | Status |
|---|---|---|---|
| Read-Only Adapters | No mutation endpoints in query/vector adapters | `src/services/adapters/adaptersIntegration.test.ts` | **PASS** |
| Bridge Path Sanitization | Null byte & traversal rejection | `src/services/desktop/security.test.ts` | **PASS** |
| Executable Write Guard | Blacklist of `.exe`, `.bat`, `.ps1`, etc. | `src/services/desktop/security.test.ts` | **PASS** |
| Secret Redaction | Deep redaction of tokens/passwords | `src/services/desktop/security.test.ts` | **PASS** |
| Loopback Verification | Strict remote IP filter (`127.0.0.1`) | `src/services/desktop/security.test.ts` | **PASS** |
| Process Cleanup | Zero orphaned background daemons on exit | `src/services/desktop/lifecycle.test.ts` | **PASS** |
| Context Isolation | Electron BrowserWindow isolation enabled | `electron/main.ts` | **PASS** |
| Navigation Guard | Intercept external URLs & deny foreign origins | `electron/main.ts` | **PASS** |
