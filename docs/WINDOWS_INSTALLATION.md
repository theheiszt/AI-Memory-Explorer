# AI Memory Explorer — Windows Installation & User Guide

**Target Audience:** End users, DevOps operators, AI researchers, and engineers.  
**Supported OS:** Windows 10 (64-bit Build 19041+) and Windows 11 (64-bit).  

---

## 1. System Requirements

| Specification | Minimum | Recommended |
|---|---|---|
| **Operating System** | Windows 10 (64-bit) | Windows 11 (64-bit) |
| **Processor** | Intel Core i3 / AMD Ryzen 3 (x64) | Intel Core i5 / AMD Ryzen 5 or higher |
| **RAM** | 4 GB | 8 GB or 16 GB |
| **Disk Space** | 350 MB free space | 1 GB free space (for caching large vector sets) |
| **Graphics** | DirectX 9 / OpenGL 2.0 (for 2D) | DirectX 11 / WebGL 2.0 (for 3D Latent Space) |
| **External Runtimes** | **NONE** (Self-contained) | **NONE** |

---

## 2. Installation Options

### Option A: Standard Windows Installer (Recommended)

1. **Download:** Obtain `AI Memory Explorer Setup 1.0.0.exe`.
2. **Execute:** Double-click the installer executable.
3. **Select Directory:** By default, the application installs to `%LOCALAPPDATA%\Programs\AI Memory Explorer`. You may customize the directory if desired.
4. **Shortcuts:** The installer automatically creates shortcuts on your **Desktop** and in the **Start Menu**.
5. **Launch:** Click **Finish** with "Launch AI Memory Explorer" checked, or open it from the Start Menu.

### Option B: Standalone Portable Executable

1. **Download:** Obtain `AI Memory Explorer 1.0.0.exe`.
2. **Move:** Place the executable in any convenient folder (e.g., `C:\Tools\AI Memory Explorer\` or an external USB drive).
3. **Execute:** Double-click `AI Memory Explorer 1.0.0.exe`.
4. **Zero Administrative Elevation:** The portable version runs entirely within standard user permissions without touching system directories.

---

## 3. First-Run Experience & Onboarding

When launched for the first time:

1. **Welcome Dataset:** The application automatically loads the built-in **10,000 Real Memory Vectors** benchmark dataset.
2. **2D Semantic Landscape:** The central viewport displays a 2D PCA/UMAP projection colored by semantic cluster (Distributed Systems, AI Latent Models, DevOps, Cloud Infrastructure, User Profiles).
3. **Inspect a Memory:** Click on any node in the landscape to open the **Memory Inspector** on the right sidepane. View its stable ID, content, latent vector dimensions, and explicit relationships.
4. **Adjust Density & Projections:** Use the toolbar sliders to adjust vector volume (1,000 to 10,000 nodes) and cluster dispersion scale (0.5x to 2.0x).
5. **Switch Views:**
   - Press `Ctrl+2` to view the **3D Latent Space**.
   - Press `Ctrl+3` to open the tabular **Table Explorer**.
   - Press `Ctrl+4` to view **Snapshot History & Diff Engine**.
   - Press `Ctrl+5` to run an on-device **Cognitive Audit**.

---

## 4. Application Data Directory & Backup

AI Memory Explorer persists application settings, imported source configurations, and offline cached memory records in your Windows AppData directory:

```
%APPDATA%\AI Memory Explorer\
├── storage\
│   ├── app_state.json      # Persisted sources, active dataset, and projection states
│   └── settings.json       # Projection defaults, target density, and credentials
└── logs\
    └── desktop.log         # Diagnostic runtime logs (PII/secrets redacted)
```

### Backing Up Data
To back up your saved memory collections and configurations:
1. Press `Win + R`, type `%APPDATA%\AI Memory Explorer`, and press Enter.
2. Copy the `storage` folder to your backup location.

### Resetting / Clearing Data
- **Via UI:** Open **Settings** (`Ctrl+,`) > select the **Storage & Data** tab > click **Clear Cache**.
- **Manual Reset:** Close the application and delete the `%APPDATA%\AI Memory Explorer\storage\app_state.json` file. The application will restore factory preset datasets upon next launch.

---

## 5. Connecting Live AI Agent Servers & LAN Daemons

AI Memory Explorer can bridge directly to local or remote AI agent servers:

1. Press `Ctrl + K` or click **Connect AI Server** in the top navigation bar.
2. Choose your server type:
   - **Ollama:** `http://localhost:11434`
   - **LM Studio / OpenAI Compatible:** `http://localhost:1234/v1`
   - **LangGraph / Mem0 / Custom REST:** Endpoint URL with optional bearer token.
   - **SSH LAN Tunnel:** Connect directly to remote GPU workstations on your local network (e.g., `username@192.168.1.50:22`).
3. Click **Connect & Fetch Memories**. The top bar will display a `Live Connected` cyan badge with real-time latency telemetry.

---

## 6. Configuring Optional Cloud Cognitive Engine

While AI Memory Explorer features a built-in on-device local cognitive reflection engine, you may optionally connect Google Gemini for cloud reasoning:

1. Press `Ctrl + ,` to open **Settings**.
2. Select the **AI & Cognitive Engine** tab.
3. Paste your Gemini API key (`AIzaSy...`) and click **Save Settings**.
4. The key is stored locally in `%APPDATA%\AI Memory Explorer\storage\settings.json`. It is never transmitted to third parties or logged in diagnostic files.
5. To revert to offline-only mode, click **Clear Key**.

---

## 7. Uninstallation

1. Open **Windows Settings > Apps > Installed apps** (or `appwiz.cpl`).
2. Search for **AI Memory Explorer**.
3. Click **Uninstall** and follow the prompts.
4. The uninstaller cleanly removes application binaries, desktop shortcuts, and Start Menu entries.
