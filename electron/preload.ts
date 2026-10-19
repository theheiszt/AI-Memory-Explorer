import { contextBridge, ipcRenderer } from 'electron';

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  title?: string;
  message: string;
  detail?: string;
  buttons?: string[];
  defaultId?: number;
  cancelId?: number;
}

const desktopBridge = {
  isDesktop: true as const,
  platform: process.platform,
  
  // Native File Dialogs
  showOpenDialog: (options: OpenDialogOptions) => 
    ipcRenderer.invoke('dialog:showOpenDialog', options),

  showSaveDialog: (options: SaveDialogOptions) => 
    ipcRenderer.invoke('dialog:showSaveDialog', options),

  showMessageBox: (options: MessageBoxOptions) => 
    ipcRenderer.invoke('dialog:showMessageBox', options),

  // Storage and Path Management
  getAppPaths: () => 
    ipcRenderer.invoke('storage:getPaths'),

  readLocalFile: (filePath: string) => 
    ipcRenderer.invoke('storage:readLocalFile', filePath),

  writeLocalFile: (filePath: string, content: string) => 
    ipcRenderer.invoke('storage:writeLocalFile', filePath, content),

  saveAppState: (state: unknown) => 
    ipcRenderer.invoke('storage:saveAppState', state),

  loadAppState: () => 
    ipcRenderer.invoke('storage:loadAppState'),

  // Application Settings
  getSettings: () => 
    ipcRenderer.invoke('settings:get'),

  saveSettings: (settings: unknown) => 
    ipcRenderer.invoke('settings:save', settings),

  getSystemInfo: () =>
    ipcRenderer.invoke('app:getSystemInfo'),

  // Native Menu Listeners
  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_event: unknown, action: string) => callback(action);
    ipcRenderer.on('menu:action', handler);
    return () => {
      ipcRenderer.removeListener('menu:action', handler);
    };
  },
};

export type DesktopBridge = typeof desktopBridge;

contextBridge.exposeInMainWorld('desktopBridge', desktopBridge);
