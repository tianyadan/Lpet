import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('petDesktop', {
    hide: () => ipcRenderer.invoke('pet:hide'),
    quit: () => ipcRenderer.invoke('pet:quit'),
    checkCodexInstallations: () => ipcRenderer.invoke('codex:check-installations'),
    runCodex: (prompt, target) => ipcRenderer.invoke('codex:run', prompt, target),
    cancelCodex: () => ipcRenderer.invoke('codex:cancel'),
    onCodexEvent: (callback) => {
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on('codex:event', listener);
        return () => ipcRenderer.off('codex:event', listener);
    },
});
