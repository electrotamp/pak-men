/** The typed IPC surface exposed to the renderer as `window.api`. */

import type { Project, RomEntry, ExportPlan, RomSource } from './types.ts';
import type { ArtType } from './enums.ts';

export interface ArtInfo {
  /** Which of the 6 art types resolve from the baked library for this code. */
  baked: Record<ArtType, boolean>;
  /** art:// URL for a given type (baked), or null. */
  url: Partial<Record<ArtType, string>>;
}

export interface UpdateInfo {
  version: string;
  zipUrl: string;
  isGithubAsset: boolean;
}

export interface MenuBuilderApi {
  // project
  newProject(): Promise<Project>;
  openProject(): Promise<{ path: string; project: Project } | null>;
  saveProject(project: Project, path?: string): Promise<{ path: string } | null>;
  recentProjectPath(): Promise<string | null>;

  // rom sources
  pickFolder(title?: string): Promise<string | null>;
  pickFile(opts: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }): Promise<string | null>;
  scanSource(source: RomSource, storagePrefix: string): Promise<{ entries: RomEntry[]; errors: string[] }>;
  identify(hostPath: string): Promise<RomEntry>;

  // art
  artInfo(code: string): Promise<ArtInfo>;
  artUrlForFile(hostPath: string): string;

  // export / import
  planExport(project: Project, target: string): Promise<ExportPlan>;
  commitExport(project: Project, target: string): Promise<{ ok: true }>;
  importFromSd(sdRoot: string): Promise<Project>;

  /** Boot the current design in the bundled emulator (no rebuild, no SD card). */
  testMenu(
    project: Project,
    opts?: { noExpansionPak?: boolean },
  ): Promise<{ ok: boolean; message?: string }>;

  // misc
  bundledMenuRoms(): Promise<Array<{ cart: string; file: string; present: boolean; bytes: number }>>;
  openExternal(url: string): Promise<void>;
  appInfo(): Promise<{ version: string; artRoot: string; menuDataVersion: number }>;

  // self-updater
  checkForUpdate(): Promise<UpdateInfo | null>;
  downloadUpdate(info: UpdateInfo): Promise<string>;
  applyUpdate(stagingDir: string): Promise<void>;
}

export interface AppEvents {
  onScanProgress(cb: (p: { done: number; path: string }) => void): () => void;
  onUpdateProgress(cb: (p: { phase: 'download' | 'extract'; pct: number }) => void): () => void;
}

declare global {
  interface Window {
    api: MenuBuilderApi;
    events: AppEvents;
  }
}
