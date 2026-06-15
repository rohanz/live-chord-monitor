import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('liveChordMonitor', {
  platform: process.platform,
});
