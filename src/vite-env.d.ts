/// <reference types="vite/client" />

interface Window {
  beadAPI: {
    savePng: (dataUrl: string, defaultName: string) => Promise<{ ok: boolean; filePath?: string }>;
    isElectron: boolean;
  };
}
