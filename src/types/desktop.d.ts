import type { DesktopBridge } from '../../electron/preload.ts';

declare global {
  interface Window {
    desktopBridge?: DesktopBridge;
  }
}

export {};
