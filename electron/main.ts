import { app, BrowserWindow, Menu, MenuItemConstructorOptions, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { startServer } from '../server.ts';

// Ensure single instance on Windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// App identifier for Windows taskbar and notifications
app.setAppUserModelId('com.aimemory.explorer');

let mainWindow: BrowserWindow | null = null;
let activeServer: http.Server | null = null;
let serverPort = 3000;
let serverHost = '127.0.0.1';

// App Paths
const userDataPath = app.getPath('userData');
const storageDir = path.join(userDataPath, 'storage');
const logsDir = path.join(userDataPath, 'logs');
const storageFile = path.join(storageDir, 'app_state.json');
const settingsFile = path.join(storageDir, 'settings.json');

// Ensure necessary directories exist
try {
  fs.mkdirSync(storageDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
} catch (e) {
  console.error('Failed to create storage directories:', e);
}

function redactLogDetails(val: unknown): unknown {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(redactLogDetails);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (/key|secret|token|password|auth|credential|bearer/i.test(k)) {
      out[k] = '[REDACTED_SECRET]';
    } else if (typeof v === 'object' && v !== null) {
      out[k] = redactLogDetails(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function writeLog(level: 'INFO' | 'WARN' | 'ERROR', message: string, details?: unknown) {
  try {
    const timestamp = new Date().toISOString();
    const safeDetails = details ? redactLogDetails(details) : undefined;
    const line = `[${timestamp}] [${level}] ${message} ${safeDetails ? JSON.stringify(safeDetails) : ''}\n`;
    fs.appendFileSync(path.join(logsDir, 'desktop.log'), line, 'utf-8');
  } catch {}
}

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

async function initializeBackend(): Promise<number> {
  const distDir = isDev 
    ? path.resolve(process.cwd(), 'dist')
    : path.resolve(__dirname, '../dist');

  writeLog('INFO', `Starting internal backend server on loopback... Dist: ${distDir}`);

  try {
    const result = await startServer({
      port: 0, // Request dynamic ephemeral port to prevent port collisions
      host: '127.0.0.1',
      distPath: distDir,
      isProd: !isDev,
    });

    activeServer = result.server;
    serverPort = result.port;
    serverHost = result.host;

    writeLog('INFO', `Backend started successfully on http://${serverHost}:${serverPort}`);
    return serverPort;
  } catch (error) {
    writeLog('ERROR', 'Backend startup failure', error);
    dialog.showErrorBox(
      'AI Memory Explorer Backend Error',
      `Failed to initialize the local embedded data engine.\nError: ${(error as Error).message}\n\nPlease check the application logs at ${logsDir}`
    );
    throw error;
  }
}

function createMainWindow(port: number) {
  const iconPath = isDev
    ? path.resolve(process.cwd(), 'assets/icon.ico')
    : path.resolve(__dirname, '../assets/icon.ico');

  mainWindow = new BrowserWindow({
    title: 'AI Memory Explorer',
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#020617', // slate-950
    show: false, // Show once ready-to-show to prevent visual flicker
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  const appUrl = `http://127.0.0.1:${port}`;
  writeLog('INFO', `Loading application URL: ${appUrl}`);

  mainWindow.loadURL(appUrl);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    writeLog('ERROR', `Renderer failed to load: ${errorDescription} (${errorCode})`);
    if (errorCode !== -3) { // Ignore ABORTED
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(appUrl);
        }
      }, 1000);
    }
  });

  // Open external links in user's default browser instead of the app window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Prevent navigation away from the loopback application server
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.origin !== `http://${serverHost}:${serverPort}`) {
        event.preventDefault();
        if (navigationUrl.startsWith('http:') || navigationUrl.startsWith('https:')) {
          shell.openExternal(navigationUrl);
        }
      }
    } catch {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  buildApplicationMenu();
}

function buildApplicationMenu() {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '&File',
      submenu: [
        {
          label: '&Import Memory Data...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:action', 'open-import'),
        },
        {
          label: '&Export Current Dataset...',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:action', 'open-export'),
        },
        { type: 'separator' },
        {
          label: 'Connect &AI Agent Server...',
          accelerator: 'CmdOrCtrl+K',
          click: () => mainWindow?.webContents.send('menu:action', 'open-connect'),
        },
        {
          label: '&Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow?.webContents.send('menu:action', 'open-settings'),
        },
        { type: 'separator' },
        {
          label: 'E&xit',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '&View',
      submenu: [
        {
          label: '2D &Semantic Map',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow?.webContents.send('menu:action', 'view-map2d'),
        },
        {
          label: '3D &Latent Space',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow?.webContents.send('menu:action', 'view-map3d'),
        },
        {
          label: 'Stream &Graph',
          accelerator: 'CmdOrCtrl+3',
          click: () => mainWindow?.webContents.send('menu:action', 'view-graph'),
        },
        {
          label: '&Table Explorer',
          accelerator: 'CmdOrCtrl+4',
          click: () => mainWindow?.webContents.send('menu:action', 'view-table'),
        },
        {
          label: 'Snapshot &History',
          accelerator: 'CmdOrCtrl+5',
          click: () => mainWindow?.webContents.send('menu:action', 'view-history'),
        },
        {
          label: 'Cognitive &Audit',
          accelerator: 'CmdOrCtrl+6',
          click: () => mainWindow?.webContents.send('menu:action', 'view-audit'),
        },
        { type: 'separator' },
        {
          label: '&Recompute Projections',
          accelerator: 'F5',
          click: () => mainWindow?.webContents.send('menu:action', 'recompute'),
        },
        { role: 'togglefullscreen' },
        ...(isDev
          ? [
              { type: 'separator' as const },
              { role: 'toggleDevTools' as const },
            ]
          : []),
      ],
    },
    {
      label: '&Help',
      submenu: [
        {
          label: 'Open &Data Directory',
          click: () => shell.openPath(storageDir),
        },
        {
          label: 'Open &Logs Directory',
          click: () => shell.openPath(logsDir),
        },
        { type: 'separator' },
        {
          label: '&About AI Memory Explorer',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About AI Memory Explorer',
              message: 'AI Memory Explorer',
              detail: `Version: ${app.getVersion()}\n` +
                      `Electron: ${process.versions.electron}\n` +
                      `Node.js: ${process.versions.node}\n` +
                      `Chromium: ${process.versions.chrome}\n` +
                      `OS: ${os.type()} ${os.release()} (${os.arch()})\n\n` +
                      'A high-performance Windows desktop application for exploring, inspecting, and auditing AI agent memory graphs and latent representations.',
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('dialog:showOpenDialog', async (_event, options) => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  return dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('dialog:showSaveDialog', async (_event, options) => {
  if (!mainWindow) return { canceled: true };
  return dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('dialog:showMessageBox', async (_event, options) => {
  if (!mainWindow) return { response: 0 };
  return dialog.showMessageBox(mainWindow, options);
});

ipcMain.handle('storage:getPaths', () => {
  return {
    appData: userDataPath,
    storage: storageDir,
    logs: logsDir,
    documents: app.getPath('documents'),
  };
});

ipcMain.handle('storage:readLocalFile', async (_event, filePath: string) => {
  try {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('Invalid file path specified');
    }
    if (filePath.includes('\0')) {
      throw new Error('Null byte detected in file path');
    }
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File does not exist: ${resolvedPath}`);
    }
    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      throw new Error('Path does not point to a regular file');
    }
    if (stat.size > 100 * 1024 * 1024) {
      throw new Error('File exceeds maximum allowable size (100MB)');
    }
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    writeLog('WARN', 'Rejected local file read', { error: (error as Error).message });
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('storage:writeLocalFile', async (_event, filePath: string, content: string) => {
  try {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('Invalid file path specified');
    }
    if (filePath.includes('\0')) {
      throw new Error('Null byte detected in file path');
    }
    const resolvedPath = path.resolve(filePath);

    // Disallow writing executable files or scripts for security
    const ext = path.extname(resolvedPath).toLowerCase();
    const disallowedExts = ['.exe', '.bat', '.cmd', '.vbs', '.ps1', '.dll', '.com', '.scr', '.msi', '.pif'];
    if (disallowedExts.includes(ext)) {
      throw new Error(`Writing executable or script files (${ext}) is disallowed for security.`);
    }

    const parentDir = path.dirname(resolvedPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(resolvedPath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    writeLog('WARN', 'Rejected local file write', { error: (error as Error).message });
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('storage:saveAppState', async (_event, state: unknown) => {
  try {
    fs.writeFileSync(storageFile, JSON.stringify(state, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    writeLog('ERROR', 'Failed to save app state', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('storage:loadAppState', async () => {
  try {
    if (!fs.existsSync(storageFile)) {
      return { success: true, state: null };
    }
    const raw = fs.readFileSync(storageFile, 'utf-8');
    const state = JSON.parse(raw);
    return { success: true, state };
  } catch (error) {
    writeLog('WARN', 'Failed to read app state', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('settings:get', async () => {
  try {
    if (!fs.existsSync(settingsFile)) {
      return {
        defaultAlgorithm: 'umap',
        defaultDensityScale: 1.0,
        defaultVectorCount: 2500,
        theme: 'slate',
        storageDir: storageDir,
        geminiApiKeyConfigured: !!process.env.GEMINI_API_KEY,
      };
    }
    const raw = fs.readFileSync(settingsFile, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
});

ipcMain.handle('settings:save', async (_event, settings: unknown) => {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('app:getSystemInfo', () => {
  return {
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
    freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
    cpuModel: os.cpus()[0]?.model || 'Generic x64',
    cpuCount: os.cpus().length,
  };
});

// App lifecycle
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  writeLog('INFO', 'Electron application ready, initializing...');
  try {
    const port = await initializeBackend();
    createMainWindow(port);

    if (process.argv.includes('--test-lifecycle')) {
      writeLog('INFO', 'Test lifecycle mode detected. Verifying loopback health endpoint and window state...');
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      const data = await res.json();
      if (data.status === 'ok' && mainWindow) {
        const bounds = mainWindow.getBounds();
        console.log(`LIFECYCLE_VERIFICATION_PASS: port=${port}, loopback=127.0.0.1, winWidth=${bounds.width}, winHeight=${bounds.height}, storage=${storageDir}`);
        setTimeout(() => {
          app.quit();
        }, 500);
      } else {
        console.error('LIFECYCLE_VERIFICATION_FAIL: health status check did not return ok');
        app.exit(1);
      }
    }
  } catch (err) {
    writeLog('ERROR', 'Fatal initialization error', err);
    if (process.argv.includes('--test-lifecycle')) {
      app.exit(1);
    }
  }
});

app.on('window-all-closed', () => {
  writeLog('INFO', 'All windows closed, shutting down application...');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  writeLog('INFO', 'Application before-quit event triggered, cleaning up...');
  if (activeServer) {
    try {
      activeServer.close(() => {
        writeLog('INFO', 'Backend HTTP server closed cleanly.');
      });
    } catch (e) {
      writeLog('WARN', 'Error closing HTTP server:', e);
    }
    activeServer = null;
  }
});
