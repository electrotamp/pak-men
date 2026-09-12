import { getState, setState, updateProject, toast } from './store.ts';
import type { RomEntry, RomSource } from '../shared/types.ts';

/** Re-scan every ROM source and rebuild the library map. */
export async function rescanAll(): Promise<void> {
  const p = getState().project;
  if (!p) return;
  setState({ scanning: true, scanMsg: 'Scanning…' });
  const lib = new Map<string, RomEntry>();
  for (const source of p.romSources) {
    if (!source.hostDir) continue;
    const { entries } = await window.api.scanSource(source, p.storagePrefix);
    for (const e of entries) lib.set(e.sdPath, e);
  }
  setState({ library: lib, scanning: false, scanMsg: '' });
}

export async function addRomSource(): Promise<void> {
  const dir = await window.api.pickFolder('Choose a folder of ROMs');
  if (!dir) return;
  const name = dir.split(/[\\/]/).pop() || 'roms';
  const source: RomSource = { hostDir: dir, sdDir: `/${name}` };
  updateProject((p) => {
    if (!p.romSources.some((s) => s.hostDir === dir)) p.romSources.push(source);
  });
  await rescanAll();
}

export function removeRomSource(hostDir: string): void {
  updateProject((p) => {
    p.romSources = p.romSources.filter((s) => s.hostDir !== hostDir);
  });
  void rescanAll();
}

export function setSourceSdDir(hostDir: string, sdDir: string): void {
  const clean = '/' + sdDir.replace(/^\/+|\/+$/g, '');
  updateProject((p) => {
    const s = p.romSources.find((x) => x.hostDir === hostDir);
    if (s) s.sdDir = clean;
  });
  void rescanAll();
}

export function addFavorite(sdPath: string, atIndex?: number): void {
  const entry = getState().library.get(sdPath);
  updateProject((p) => {
    if (p.favorites.some((f) => f.sdPath === sdPath)) return;
    const fav = {
      sdPath,
      type: (entry?.type ?? 1) as 1 | 2,
      gameCode: entry?.gameCode,
    };
    if (atIndex == null || atIndex >= p.favorites.length) p.favorites.push(fav);
    else p.favorites.splice(atIndex, 0, fav);
  });
}

export function removeFavorite(index: number): void {
  updateProject((p) => p.favorites.splice(index, 1));
  const sel = getState().selected;
  if (sel === index) setState({ selected: -1 });
  else if (sel > index) setState({ selected: sel - 1 });
}

export function moveFavorite(from: number, to: number): void {
  updateProject((p) => {
    const [it] = p.favorites.splice(from, 1);
    if (it) p.favorites.splice(to, 0, it);
  });
}

export function sortFavoritesAZ(): void {
  const lib = getState().library;
  updateProject((p) => {
    p.favorites.sort((a, b) => {
      const na = (lib.get(a.sdPath)?.displayName ?? a.sdPath).toLowerCase();
      const nb = (lib.get(b.sdPath)?.displayName ?? b.sdPath).toLowerCase();
      return na < nb ? -1 : na > nb ? 1 : 0;
    });
  });
  toast('Sorted A–Z');
}
