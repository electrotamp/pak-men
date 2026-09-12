/** Walk a ROM source folder and identify every ROM / disk / archive found. */

import { promises as fs } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';
import { ALL_ROM_LIKE_EXTS, identifyRom, artCodeFor } from './rom-id.ts';
import type { RomEntry, RomSource } from '../shared/types.ts';

/** Turn a host path under `source.hostDir` into its on-SD absolute path. */
export function toSdPath(source: RomSource, hostPath: string, storagePrefix: string): string {
  const rel = relative(source.hostDir, hostPath).split(sep).join('/');
  const dir = source.sdDir.replace(/\/+$/, '');
  const prefix = storagePrefix.replace(/\/+$/, '');
  return `${prefix}/${`${dir}/${rel}`.replace(/^\/+/, '')}`;
}

async function* walk(dir: string): AsyncGenerator<string> {
  let ents: import('node:fs').Dirent[];
  try {
    ents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of ents) {
    if (e.name.startsWith('.')) continue;
    const abs = join(dir, e.name);
    if (e.isDirectory()) {
      if (/^(saves|save|cache)$/i.test(e.name)) continue;
      yield* walk(abs);
    } else if (ALL_ROM_LIKE_EXTS.includes(extname(e.name).toLowerCase())) {
      yield abs;
    }
  }
}

export interface ScanResult {
  entries: RomEntry[];
  errors: string[];
}

export async function scanSource(
  source: RomSource,
  storagePrefix: string,
  onProgress?: (done: number, path: string) => void,
): Promise<ScanResult> {
  const paths: string[] = [];
  for await (const p of walk(source.hostDir)) paths.push(p);
  paths.sort((a, b) => (a < b ? -1 : 1));

  const entries: RomEntry[] = [];
  const errors: string[] = [];
  let done = 0;
  for (const hostPath of paths) {
    const id = await identifyRom(hostPath);
    const ext = extname(hostPath).toLowerCase();
    entries.push({
      hostPath,
      sdPath: toSdPath(source, hostPath, storagePrefix),
      source,
      fileName: hostPath.split(sep).pop() ?? hostPath,
      ext,
      type: id.type,
      gameCode: id.gameCode,
      headerTitle: id.headerTitle,
      regionByte: id.regionByte,
      detectedCic: id.detectedCic,
      special: id.special,
      displayName: id.displayName,
      description: id.description,
      error: id.error,
    });
    if (id.error) errors.push(`${hostPath}: ${id.error}`);
    onProgress?.(++done, hostPath);
  }
  return { entries, errors };
}

/** Art code (special edition wins) for a scanned entry. */
export function entryArtCode(e: RomEntry): string | undefined {
  return artCodeFor(e.gameCode, e.special ?? -1);
}
