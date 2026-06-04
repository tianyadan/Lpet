import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('petDesktop', {
  hide: () => ipcRenderer.invoke('pet:hide'),
  quit: () => ipcRenderer.invoke('pet:quit'),
  openCodexPanel: () => ipcRenderer.invoke('codex-panel:open'),
  closeCodexPanel: () => ipcRenderer.invoke('codex-panel:close'),
  resizeCurrentWindow: (width: number, height: number) => ipcRenderer.invoke('window:resize-current', width, height),
  getWindowBounds: () => ipcRenderer.invoke('window:get-bounds') as Promise<{ x: number; y: number; width: number; height: number } | null>,
  setWindowPosition: (x: number, y: number) => ipcRenderer.invoke('window:set-position', x, y),
  checkCodexInstallations: () => ipcRenderer.invoke('codex:check-installations'),
  runCodex: (prompt: string, target: string, sessionId?: string | null, intent?: string) =>
    ipcRenderer.invoke('codex:run', prompt, target, sessionId, intent),
  cancelCodex: () => ipcRenderer.invoke('codex:cancel'),
  onCodexEvent: (callback: (event: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on('codex:event', listener);
    return () => ipcRenderer.off('codex:event', listener);
  },
});
