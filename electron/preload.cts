import { contextBridge } from 'electron';

// Authored as .cts so it compiles to CommonJS (.cjs). A sandboxed preload cannot be an ES module,
// and the project's package.json `"type": "module"` would otherwise make the emitted .js ESM.
contextBridge.exposeInMainWorld('liveChordMonitor', {
  platform: process.platform,
});
