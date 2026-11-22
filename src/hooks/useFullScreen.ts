import { useCallback, useEffect, useState } from 'react';

/**
 * Full-screen state plus a toggle.
 *
 * In Electron this goes through the preload bridge to `BrowserWindow.setFullScreen`, so it tracks
 * the native macOS full-screen space no matter what entered it (this toggle, the green traffic
 * light, Ctrl+Cmd+F). In a plain browser (Vite dev, tests) it falls back to the DOM Fullscreen API.
 */
export function useFullScreen() {
  const bridge = typeof window === 'undefined' ? undefined : window.liveChordMonitor;
  const native = Boolean(bridge?.toggleFullScreen && bridge.onFullScreenChange);
  const [isFullScreen, setIsFullScreen] = useState(() => (
    !native && typeof document !== 'undefined' && Boolean(document.fullscreenElement)
  ));

  useEffect(() => {
    if (native && bridge?.onFullScreenChange) {
      let cancelled = false;
      void bridge.isFullScreen?.().then((value) => {
        if (!cancelled) setIsFullScreen(value);
      });
      const unsubscribe = bridge.onFullScreenChange(setIsFullScreen);
      return () => {
        cancelled = true;
        unsubscribe();
      };
    }

    const sync = () => setIsFullScreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [bridge, native]);

  const toggleFullScreen = useCallback(() => {
    if (native && bridge?.toggleFullScreen) {
      void bridge.toggleFullScreen();
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  }, [bridge, native]);

  const supported = native || (typeof document !== 'undefined' && Boolean(document.fullscreenEnabled));

  return { isFullScreen, toggleFullScreen, supported };
}
