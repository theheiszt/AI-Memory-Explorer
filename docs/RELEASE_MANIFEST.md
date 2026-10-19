# AI Memory Explorer — Windows Desktop Release Manifest

**Release Version:** 1.0.0  
**Build Date:** 2026-10-19  
**Target Operating System:** Microsoft Windows 10 (Build 19041+) / Windows 11 (64-bit)  
**Target Architecture:** x86_64 (`x64`)  
**Package Manager & Toolchain:** Electron v44.9.0 / Electron Builder v26.15.3 / Node.js 22  

---

## 1. Distribution Artifacts & Checksums

| Artifact File | Size | Format | SHA-256 Checksum |
|---|---|---|---|
| `AI Memory Explorer Setup 1.0.0.exe` | 135,143,374 bytes (~128 MB) | NSIS Windows Installer | `8033F6EC86EACD4CB802D3171B65CC0E8FA4AA1087828B20C68E8ACB7002F749` |
| `AI Memory Explorer 1.0.0.exe` | 134,881,440 bytes (~128 MB) | Standalone Portable Executable | `E62504D038C699B67DE214CC85C050780CE547B599409A97D61F16A8D117EBFF` |

---

## 2. Prerequisites & Runtime Requirements

- **External Runtimes Required:** **NONE**. (Node.js, Python, and npm are **NOT** required for the end user).
- **Network Requirement:** **NONE** for core local data workflows (offline local vector projections, clustering, nearest-neighbor search, and JSON/CSV exports function completely on-device).
- **Hardware Acceleration:** Hardware GPU acceleration is supported via Chromium/DirectX for 3D latent space exploration, with an automatic pure 2D Canvas fallback when WebGL/DirectX is unavailable.
- **Memory Requirements:** Minimum 4 GB RAM (8 GB recommended for 10,000+ vector spaces).

---

## 3. Installation & Uninstallation Details

### NSIS Installer (`AI Memory Explorer Setup 1.0.0.exe`)
- Standard Windows wizard allowing user to select installation directory.
- Installs to `%LOCALAPPDATA%\Programs\AI Memory Explorer` (per-user, no administrative elevation required).
- Creates Start Menu shortcut: `Start Menu\Programs\AI Memory Explorer`.
- Creates Desktop shortcut: `Desktop\AI Memory Explorer.lnk`.
- Registers entry in Windows **Settings > Apps > Installed apps** (Add or Remove Programs).
- Uninstaller (`Uninstall AI Memory Explorer.exe`) removes application binaries, shortcuts, and registry keys cleanly. User data directory (`%APPDATA%\AI Memory Explorer`) is preserved by default to protect local memory stores.

### Portable Executable (`AI Memory Explorer 1.0.0.exe`)
- Runs directly from any user folder or USB drive.
- Requires no installation or administrative privileges.
- Uses standard user AppData directory (`%APPDATA%\AI Memory Explorer`) for local settings and caches.

---

## 4. Packaging Verification Evidence

```powershell
PS D:\AI Memory Explorer> & "release\win-unpacked\AI Memory Explorer.exe" --test-lifecycle
Exit Code: 0
Backend Binding: http://127.0.0.1:64611
Orphaned Processes: 0
```
