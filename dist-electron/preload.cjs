"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('petDesktop', {
    hide: () => electron_1.ipcRenderer.invoke('pet:hide'),
    quit: () => electron_1.ipcRenderer.invoke('pet:quit'),
    openCodexPanel: () => electron_1.ipcRenderer.invoke('codex-panel:open'),
    closeCodexPanel: () => electron_1.ipcRenderer.invoke('codex-panel:close'),
    resizeCurrentWindow: (width, height) => electron_1.ipcRenderer.invoke('window:resize-current', width, height),
    checkCodexInstallations: () => electron_1.ipcRenderer.invoke('codex:check-installations'),
    runCodex: (prompt, target, sessionId, intent) => electron_1.ipcRenderer.invoke('codex:run', prompt, target, sessionId, intent),
    cancelCodex: () => electron_1.ipcRenderer.invoke('codex:cancel'),
    onCodexEvent: (callback) => {
        const listener = (_event, payload) => callback(payload);
        electron_1.ipcRenderer.on('codex:event', listener);
        return () => electron_1.ipcRenderer.off('codex:event', listener);
    },
});
