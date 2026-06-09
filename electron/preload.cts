import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('petDesktop', {
  hide: () => ipcRenderer.invoke('pet:hide'),
  quit: () => ipcRenderer.invoke('pet:quit'),
  setMousePassthrough: (ignore: boolean) => ipcRenderer.invoke('pet:set-mouse-passthrough', ignore),
  openCodexPanel: () => ipcRenderer.invoke('codex-panel:open'),
  closeCodexPanel: () => ipcRenderer.invoke('codex-panel:close'),
  resizeCurrentWindow: (width: number, height: number) => ipcRenderer.invoke('window:resize-current', width, height),
  getWindowBounds: () => ipcRenderer.invoke('window:get-bounds') as Promise<{ x: number; y: number; width: number; height: number } | null>,
  setWindowPosition: (x: number, y: number) => ipcRenderer.invoke('window:set-position', x, y),
  setPetAnchorPosition: (anchorX: number, anchorY: number, scale?: number) =>
    ipcRenderer.invoke('window:set-pet-anchor-position', anchorX, anchorY, scale),
  setWindowSizeKeepBottomRight: (width: number, height: number) =>
    ipcRenderer.invoke('window:set-size-keep-bottom-right', width, height),
  checkCodexInstallations: () => ipcRenderer.invoke('codex:check-installations'),
  listLocalSkills: () => ipcRenderer.invoke('skills:list'),
  listImportedPetSkins: () => ipcRenderer.invoke('pet-skins:list-imported'),
  importPetSkinFolder: () => ipcRenderer.invoke('pet-skins:import-folder'),
  getPetIdentity: () => ipcRenderer.invoke('pet-identity:get'),
  savePetIdentity: (identity: unknown) => ipcRenderer.invoke('pet-identity:save', identity),
  listModelProviderConfigs: () => ipcRenderer.invoke('model-providers:list'),
  saveModelProviderConfig: (config: unknown) => ipcRenderer.invoke('model-providers:save', config),
  testModelProviderConnection: (config: unknown) => ipcRenderer.invoke('model-providers:test', config),
  chatWithModelProvider: (input: unknown) => ipcRenderer.invoke('model-providers:chat', input),
  analyzeImageWithVisionModel: (input: unknown) => ipcRenderer.invoke('model-providers:analyze-image', input),
  getReminder: (id: string) => ipcRenderer.invoke('reminders:get', id),
  listActiveReminders: () => ipcRenderer.invoke('reminders:list-active'),
  updateReminder: (input: unknown) => ipcRenderer.invoke('reminders:update', input),
  cancelReminder: (id: string) => ipcRenderer.invoke('reminders:cancel', id),
  completeReminder: (id: string) => ipcRenderer.invoke('reminders:complete', id),
  snoozeReminder: (id: string, hours: number, minutes: number) => ipcRenderer.invoke('reminders:snooze', id, hours, minutes),
  closeReminder: (id: string) => ipcRenderer.invoke('reminders:close', id),
  getTranslationConfig: () => ipcRenderer.invoke('translation:get-config'),
  saveTranslationConfig: (config: unknown) => ipcRenderer.invoke('translation:save-config', config),
  runCodex: (prompt: string, target: string, sessionId?: string | null, intent?: string, elevated?: boolean) =>
    ipcRenderer.invoke('codex:run', prompt, target, sessionId, intent, elevated),
  cancelCodex: () => ipcRenderer.invoke('codex:cancel'),
  onCodexEvent: (callback: (event: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on('codex:event', listener);
    return () => ipcRenderer.off('codex:event', listener);
  },
});
