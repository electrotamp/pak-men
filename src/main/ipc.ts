/** Registers all ipcMain handlers. Channel names match MenuBuilderApi method names. */

import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import { promises as fs } from 'node:fs';
import * as fsSync from 'node:fs';
import { join, extname, sep } from 'node:path';
import { newProject, loadProject, saveProject, normalizeProject } from './project.ts';
import { scanSource } from './scan.ts';
import { identifyRom } from './rom-id.ts';
import { buildExport, planExport, commitExport, MENU_DATA_VERSION } from './exporter.ts';
import { importFromSd } from './importer.ts';
import { launchTestMenu } from './emulator.ts';
import { artRoot, artInfoFor, artFileUrl, resourcesDir } from './art.ts';
import { checkForUpdate, downloadAndStageUpdate, applyStagedUpdateAndRelaunch } from './updater.ts';
import type { Project, RomSource, RomEntry } from '../shared/types.ts';

let recentPath: string | null = null;

const win = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined;

export function registerIpc(): void {
  ipcMain.handle('newProject', () => newProject());

  ipcMain.handle('openProject', async () => {
    const w = win();
    const res = await dialog.showOpenDialog(w!, {
      title: 'Open menu project',
      filters: [{ name: 'Menu project', extensions: ['n64menu', 'json'] }],
      properties: ['openFile'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const path = res.filePaths[0];
    recentPath = path;
    return { path, project: await loadProject(path) };
  });

  ipcMain.handle('saveProject', async (_e, project: Project, path?: string) => {
    let target = path ?? recentPath;
    if (!target) {
      const res = await dialog.showSaveDialog(win()!, {
        title: 'Save menu project',
        defaultPath: `${project.name || 'menu'}.n64menu`,
        filters: [{ name: 'Menu project', extensions: ['n64menu'] }],
      });
      if (res.canceled || !res.filePath) return null;
      target = res.filePath;
    }
    await saveProject(target, project);
    recentPath = target;
    return { path: target };
  });

  ipcMain.handle('recentProjectPath', () => recentPath);

  ipcMain.handle('pickFolder', async (_e, title?: string) => {
    const res = await dialog.showOpenDialog(win()!, {
      title: title ?? 'Choose a folder',
      properties: ['openDirectory'],
    });
    return res.canceled ? null : (res.filePaths[0] ?? null);
  });

  ipcMain.handle('pickFile', async (_e, opts: { title?: string; filters?: Electron.FileFilter[] }) => {
    const res = await dialog.showOpenDialog(win()!, {
      title: opts.title ?? 'Choose a file',
      filters: opts.filters,
      properties: ['openFile'],
    });
    return res.canceled ? null : (res.filePaths[0] ?? null);
  });

  ipcMain.handle('scanSource', async (_e, source: RomSource, storagePrefix: string) => {
    const w = win();
    return scanSource(source, storagePrefix, (done, path) => {
      w?.webContents.send('scan:progress', { done, path });
    });
  });

  ipcMain.handle('identify', async (_e, hostPath: string): Promise<RomEntry> => {
    const id = await identifyRom(hostPath);
    return {
      hostPath,
      sdPath: hostPath,
      source: { hostDir: '', sdDir: '/' },
      fileName: hostPath.split(sep).pop() ?? hostPath,
      ext: extname(hostPath).toLowerCase(),
      type: id.type,
      gameCode: id.gameCode,
      headerTitle: id.headerTitle,
      regionByte: id.regionByte,
      detectedCic: id.detectedCic,
      special: id.special,
      displayName: id.displayName,
      description: id.description,
      error: id.error,
    };
  });

  ipcMain.handle('artInfo', (_e, code: string) => artInfoFor(code));
  ipcMain.handle('artUrlForFile', (_e, hostPath: string) => artFileUrl(hostPath));

  ipcMain.handle('planExport', async (_e, project: Project, target: string) => {
    const build = await buildExport(normalizeProject(project), { resourcesDir: resourcesDir() });
    return planExport(build, target);
  });

  ipcMain.handle('commitExport', async (_e, project: Project, target: string) => {
    const build = await buildExport(normalizeProject(project), { resourcesDir: resourcesDir() });
    await commitExport(build, target);
    return { ok: true as const };
  });

  ipcMain.handle('importFromSd', (_e, sdRoot: string) => importFromSd(sdRoot));

  ipcMain.handle('testMenu', (_e, project: Project, opts?: { noExpansionPak?: boolean }) => {
    const res = resourcesDir();
    const staged = join(res, 'emulator');
    const devRepo = join(app.getAppPath(), '..', '..', 'tools', 'emulator');
    return launchTestMenu(
      normalizeProject(project),
      {
        emulatorSrcDir: fsSync.existsSync(join(staged, 'gopher64.exe')) ? staged : devRepo,
        menuRomPath: join(res, 'menu-rom', 'sc64menu.n64'),
        workDir: join(app.getPath('userData'), 'emulator'),
        resourcesDir: res,
      },
      opts,
    );
  });

  ipcMain.handle('bundledMenuRoms', async () => {
    const carts: Array<[string, string]> = [
      ['sc64', 'sc64menu.n64'],
      ['ed64', 'OS64.v64'],
      ['ed64p', 'OS64P.v64'],
      ['64drive', 'menu.bin'],
    ];
    const out = [];
    for (const [cart, file] of carts) {
      try {
        const st = await fs.stat(join(resourcesDir(), 'menu-rom', file));
        out.push({ cart, file, present: true, bytes: st.size });
      } catch {
        out.push({ cart, file, present: false, bytes: 0 });
      }
    }
    return out;
  });

  ipcMain.handle('openExternal', (_e, url: string) => shell.openExternal(url));

  ipcMain.handle('appInfo', () => ({
    version: app.getVersion(),
    artRoot: artRoot(),
    menuDataVersion: MENU_DATA_VERSION,
  }));

  ipcMain.handle('update:check', () => checkForUpdate());

  ipcMain.handle('update:download', async (_e, info) => {
    const w = win();
    return downloadAndStageUpdate(info, (phase, pct) => {
      w?.webContents.send('update:progress', { phase, pct });
    });
  });

  ipcMain.handle('update:apply', (_e, stagingDir: string) => {
    applyStagedUpdateAndRelaunch(stagingDir);
  });
}
