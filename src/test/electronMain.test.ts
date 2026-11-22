import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  app: { isPackaged: true, commandLine: { appendSwitch: vi.fn() }, whenReady: () => Promise.resolve(), on: vi.fn() },
  win: {
    loadURL: vi.fn(), on: vi.fn(), once: vi.fn(),
    webContents: { openDevTools: vi.fn(), setWindowOpenHandler: vi.fn(), on: vi.fn() },
  },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
}));
vi.mock('electron', () => ({
  app: electron.app,
  BrowserWindow: class { constructor() { return electron.win; } },
  protocol: electron.protocol,
  ipcMain: { handle: vi.fn() },
  session: { defaultSession: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
  shell: { openExternal: vi.fn() },
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  electron.app.isPackaged = true;
});
afterEach(() => vi.unstubAllEnvs());
async function loadMain() {
  const entrypoint = '../../electron/main';
  await import(entrypoint);
}

it('loads the packaged bundle and keeps DevTools closed even with NODE_ENV=development', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  await loadMain();
  expect(electron.win.loadURL).toHaveBeenCalledWith('app://bundle/index.html');
  expect(electron.protocol.handle).toHaveBeenCalledWith('app', expect.any(Function));
  expect(electron.win.webContents.openDevTools).not.toHaveBeenCalled();
});

it('allows bundle navigation but denies other custom hosts, schemes, and production localhost', async () => {
  await loadMain();
  const navigate = electron.win.webContents.on.mock.calls.find(([name]) => name === 'will-navigate')?.[1];
  expect(navigate).toBeTypeOf('function');
  for (const url of ['app://bundle/index.html#notes', 'app://bundle/other.html']) {
    const event = { preventDefault: vi.fn() };
    navigate(event, url);
    expect(event.preventDefault).not.toHaveBeenCalled();
  }
  for (const url of ['app://other/index.html', 'app://bundle.evil/index.html', 'app://bundle:42/', 'file:///index.html', 'http://localhost:5173/', 'https://example.com', 'invalid']) {
    const event = { preventDefault: vi.fn() };
    navigate(event, url);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  }
});

it('allows only the exact Vite origin in development', async () => {
  electron.app.isPackaged = false;
  await loadMain();
  const navigate = electron.win.webContents.on.mock.calls.find(([name]) => name === 'will-navigate')?.[1];
  for (const [url, allowed] of [
    ['http://localhost:5173/notes', true],
    ['http://localhost:5174/', false],
    ['http://localhost:5173.evil/', false],
    ['https://localhost:5173/', false],
  ] as const) {
    const event = { preventDefault: vi.fn() };
    navigate(event, url);
    expect(event.preventDefault).toHaveBeenCalledTimes(allowed ? 0 : 1);
  }
});
