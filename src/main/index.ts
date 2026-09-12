import { app, BrowserWindow, protocol, session } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerArtProtocol } from './art.ts';
import { registerIpc } from './ipc.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

protocol.registerSchemesAsPrivileged([
  { scheme: 'art', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true } },
]);

const CSP =
  "default-src 'self'; img-src 'self' art: data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'";

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#14161c',
    title: 'PAK-MEN',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.removeMenu();

  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer gone]', JSON.stringify(details));
  });
  win.webContents.on('preload-error', (_e, path, error) => {
    console.error('[preload-error]', path, error);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
  if (process.env.MENU_BUILDER_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  // CSP for the packaged app (file://). In dev, Vite serves from localhost and
  // injects its HMR client, so we leave it to the browser defaults.
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CSP] } });
    });
  }

  registerArtProtocol();
  registerIpc();
  createWindow();

  if (process.env.MENU_BUILDER_SELFTEST) void selfTest();
  if (process.env.PAKMEN_UPDATE_SELFTEST) void updateSelfTest();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

async function updateSelfTest(): Promise<void> {
  const { checkForUpdate, downloadAndStageUpdate, applyStagedUpdateAndRelaunch } = await import('./updater.ts');
  const t0 = Date.now();
  console.log('[update-selftest] app.getVersion() =', app.getVersion());
  console.log('[update-selftest] checking…');
  try {
    const info = await checkForUpdate();
    console.log('[update-selftest] check result:', JSON.stringify(info), `(${Date.now() - t0}ms)`);
    if (!info) return;
    let lastLog = Date.now();
    const dir = await downloadAndStageUpdate(info, (phase, pct) => {
      if (Date.now() - lastLog > 250) {
        lastLog = Date.now();
        console.log(`[update-selftest] ${phase} ${pct}% (${Date.now() - t0}ms)`);
      }
    });
    console.log('[update-selftest] staged at', dir, `total ${Date.now() - t0}ms`);
    if (process.env.PAKMEN_UPDATE_SELFTEST_APPLY) {
      console.log('[update-selftest] applying + relaunching…');
      applyStagedUpdateAndRelaunch(dir);
    }
  } catch (e) {
    console.error('[update-selftest] FAILED', e);
  }
}

async function selfTest(): Promise<void> {
  const { artRoot, bakedArtPath, artInfoFor } = await import('./art.ts');
  const { readFile } = await import('node:fs/promises');
  console.log('[selftest] artRoot =', artRoot());
  for (const code of ['CFZE', 'NSME', 'NZSE', 'NALP']) {
    const info = artInfoFor(code);
    const p = bakedArtPath(code, 'front');
    let bytes = -1;
    try {
      if (p) bytes = (await readFile(p)).length;
    } catch {
      /* missing */
    }
    console.log(`[selftest] ${code}: front=${p ? p.replace(artRoot(), '…') : 'none'} bytes=${bytes} baked=${JSON.stringify(info.baked)}`);
  }
  console.log('[selftest] done');
}
