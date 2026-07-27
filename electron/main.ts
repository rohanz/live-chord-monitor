import { app, BrowserWindow, protocol, session, shell } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const rendererDist = path.join(__dirname, '../dist');
const APP_ORIGIN = 'app://bundle';
const DEV_ORIGIN = 'http://localhost:5173';

// Web MIDI ships in Chromium by default; this switch is belt-and-suspenders and needs no
// experimental web-platform features.
app.commandLine.appendSwitch('enable-features', 'WebMidi');

// Defense-in-depth CSP for the packaged renderer. It is served on the custom app:// origin below,
// where `'self'` resolves to a real origin. (A file:// document gets an opaque origin that `'self'`
// can never match, which would block the bundle entirely.)
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // VexFlow/SVG set inline style attributes
  "img-src 'self' data:",
  "font-src 'self' data:", // VexFlow embeds its music notation fonts as data: URIs

  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

// A standard, secure custom scheme so the packaged renderer loads from a real origin instead of
// file://. file:// breaks Vite's absolute asset paths and gives CSP `'self'` an opaque origin.
// `secure: true` keeps it a secure context, which Web MIDI requires.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url);
    const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.replace(/^\/+/, ''));
    const filePath = path.join(rendererDist, relativePath);

    // Guard against path traversal outside the bundled renderer.
    if (filePath !== rendererDist && !filePath.startsWith(rendererDist + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const data = await readFile(filePath);
      const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
      return new Response(data, {
        headers: {
          'Content-Type': mimeType,
          'Content-Security-Policy': CONTENT_SECURITY_POLICY,
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

/** The only origin the renderer is ever allowed to sit on: app://bundle in prod, Vite in dev. */
function isAllowedOrigin(url: string): boolean {
  try {
    const { origin } = new URL(url);
    return origin === APP_ORIGIN || (isDev && origin === DEV_ORIGIN);
  } catch {
    return false;
  }
}

/** Hand http(s) links to the user's browser; drop anything else (file:, javascript:, custom schemes). */
async function openExternally(url: string) {
  try {
    const { protocol } = new URL(url);

    if (protocol === 'https:' || protocol === 'http:') {
      await shell.openExternal(url);
    }
  } catch {
    // Not a parseable URL - ignore.
  }
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 820,
    minHeight: 680,
    title: 'Live Chord Monitor',
    backgroundColor: '#f7f4ee',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Grant only the Web MIDI permission; deny everything else. Chromium/Electron route Web MIDI through
  // the `midiSysex` permission name even when the renderer requests `{ sysex: false }`, so both `midi`
  // and `midiSysex` must be allowed or requestMIDIAccess() rejects with a SecurityError ("MIDI denied").
  // (Actual SysEx capability is still gated by the renderer's `sysex: false` request.)
  const isMidiPermission = (permission: string) => permission === 'midi' || permission === 'midiSysex';
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(isMidiPermission(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => isMidiPermission(permission));

  // Navigation guards. The CSP does not restrict navigation, and an unhandled `window.open` would
  // spawn a child window with webPreferences we did not choose. Refuse both: this app has exactly
  // one origin and never opens child windows.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void openExternally(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedOrigin(url)) {
      event.preventDefault();
      void openExternally(url);
    }
  });

  if (isDev) {
    win.loadURL(DEV_ORIGIN);
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  win.loadURL(`${APP_ORIGIN}/index.html`);
}

app.whenReady().then(() => {
  if (!isDev) {
    registerAppProtocol();
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
