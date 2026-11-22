import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

// Authored as .cts so it compiles to CommonJS (.cjs). A sandboxed preload cannot be an ES module,
// and the project's package.json `"type": "module"` would otherwise make the emitted .js ESM.
//
// Full screen goes through the main process (BrowserWindow.setFullScreen) rather than the DOM
// Fullscreen API, so the in-app button, the green traffic-light button and Ctrl+Cmd+F all drive the
// SAME native macOS full-screen space and the renderer always learns the real state.
contextBridge.exposeInMainWorld('liveChordMonitor', {
  platform: process.platform,
  toggleFullScreen: (): Promise<boolean> => ipcRenderer.invoke('lcm:toggle-full-screen'),
  isFullScreen: (): Promise<boolean> => ipcRenderer.invoke('lcm:is-full-screen'),
  onFullScreenChange: (callback: (isFullScreen: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, isFullScreen: boolean) => callback(isFullScreen);
    ipcRenderer.on('lcm:full-screen-changed', listener);
    return () => {
      ipcRenderer.removeListener('lcm:full-screen-changed', listener);
    };
  },
});
