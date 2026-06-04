"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('petDesktop', {
    hide: () => electron_1.ipcRenderer.invoke('pet:hide'),
    quit: () => electron_1.ipcRenderer.invoke('pet:quit'),
    setMousePassthrough: (ignore) => electron_1.ipcRenderer.invoke('pet:set-mouse-passthrough', ignore),
    openCodexPanel: () => electron_1.ipcRenderer.invoke('codex-panel:open'),
    closeCodexPanel: () => electron_1.ipcRenderer.invoke('codex-panel:close'),
    resizeCurrentWindow: (width, height) => electron_1.ipcRenderer.invoke('window:resize-current', width, height),
    getWindowBounds: () => electron_1.ipcRenderer.invoke('window:get-bounds'),
    setWindowPosition: (x, y) => electron_1.ipcRenderer.invoke('window:set-position', x, y),
    setPetAnchorPosition: (anchorX, anchorY, scale) => electron_1.ipcRenderer.invoke('window:set-pet-anchor-position', anchorX, anchorY, scale),
    setWindowSizeKeepBottomRight: (width, height) => electron_1.ipcRenderer.invoke('window:set-size-keep-bottom-right', width, height),
    checkCodexInstallations: () => electron_1.ipcRenderer.invoke('codex:check-installations'),
    runCodex: (prompt, target, sessionId, intent) => electron_1.ipcRenderer.invoke('codex:run', prompt, target, sessionId, intent),
    cancelCodex: () => electron_1.ipcRenderer.invoke('codex:cancel'),
    onCodexEvent: (callback) => {
        const listener = (_event, payload) => callback(payload);
        electron_1.ipcRenderer.on('codex:event', listener);
        return () => electron_1.ipcRenderer.off('codex:event', listener);
    },
});
