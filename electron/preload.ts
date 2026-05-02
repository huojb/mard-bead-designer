import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('beadAPI', {
  savePng: (dataUrl: string, defaultName: string) =>
    ipcRenderer.invoke('save-png', dataUrl, defaultName) as Promise<{ ok: boolean; filePath?: string }>,
  isElectron: true,
});
