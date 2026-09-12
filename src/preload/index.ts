import { contextBridge, ipcRenderer } from 'electron';
import type { MenuBuilderApi } from '../shared/ipc-api.ts';

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>;

const api: MenuBuilderApi = {
  newProject: () => invoke('newProject'),
  openProject: () => invoke('openProject'),
  saveProject: (project, path) => invoke('saveProject', project, path),
  recentProjectPath: () => invoke('recentProjectPath'),

  pickFolder: (title) => invoke('pickFolder', title),
  pickFile: (opts) => invoke('pickFile', opts),
  scanSource: (source, storagePrefix) => invoke('scanSource', source, storagePrefix),
  identify: (hostPath) => invoke('identify', hostPath),

  artInfo: (code) => invoke('artInfo', code),
  artUrlForFile: (hostPath) => `art://file/${encodeURIComponent(hostPath)}`,

  planExport: (project, target) => invoke('planExport', project, target),
  commitExport: (project, target) => invoke('commitExport', project, target),
  importFromSd: (sdRoot) => invoke('importFromSd', sdRoot),
  testMenu: (project, opts) => invoke('testMenu', project, opts),

  bundledMenuRoms: () => invoke('bundledMenuRoms'),
  openExternal: (url) => invoke('openExternal', url),
  appInfo: () => invoke('appInfo'),

  checkForUpdate: () => invoke('update:check'),
  downloadUpdate: (info) => invoke('update:download', info),
  applyUpdate: (stagingDir) => invoke('update:apply', stagingDir),
};

contextBridge.exposeInMainWorld('api', api);

// scan / update progress events
contextBridge.exposeInMainWorld('events', {
  onScanProgress: (cb: (p: { done: number; path: string }) => void) => {
    const listener = (_e: unknown, p: { done: number; path: string }) => cb(p);
    ipcRenderer.on('scan:progress', listener);
    return () => ipcRenderer.removeListener('scan:progress', listener);
  },
  onUpdateProgress: (cb: (p: { phase: 'download' | 'extract'; pct: number }) => void) => {
    const listener = (_e: unknown, p: { phase: 'download' | 'extract'; pct: number }) => cb(p);
    ipcRenderer.on('update:progress', listener);
    return () => ipcRenderer.removeListener('update:progress', listener);
  },
});
