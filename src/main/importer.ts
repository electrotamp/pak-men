/**
 * Seed a Project from an existing SD card (or an exported `menu/` tree). The
 * inverse of exporter.ts — parses the same files back into the project model so
 * an import -> export round-trip is stable.
 */

import { promises as fs } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { parseIni, getString, getInt, getBool } from '../shared/ini.ts';
import { SETTINGS_SCHEMA, settingId, defaultSettings } from '../shared/settings-schema.ts';
import { ART_TYPES, ART_TYPE_CUSTOM_SUFFIX } from '../shared/enums.ts';
import { newProject } from './project.ts';
import { fromMenuJson } from '../shared/menu-schema.ts';
import type { Project, Favorite, HistoryEntry, DiscLink, RomSource } from '../shared/types.ts';

async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await fs.readFile(path, 'utf8');
  } catch {
    return null;
  }
}

function parseSettings(text: string | null): Project['settings'] {
  const s = defaultSettings();
  if (!text) return s;
  const doc = parseIni(text);
  for (const spec of SETTINGS_SCHEMA) {
    const id = settingId(spec);
    if (spec.kind === 'bool') s[id] = getBool(doc, spec.section, spec.key, Boolean(spec.default));
    else if (spec.kind === 'int' || spec.kind === 'enum')
      s[id] = getInt(doc, spec.section, spec.key, Number(spec.default));
    else s[id] = getString(doc, spec.section, spec.key) ?? String(spec.default);
  }
  return s;
}

function parseBookkeeping(text: string | null, group: 'favorite' | 'history'): Favorite[] {
  if (!text) return [];
  const doc = parseIni(text);
  const sec = doc.find((x) => x.name === group);
  if (!sec) return [];
  const rows = new Map<number, Favorite>();
  for (const [key, value] of sec.pairs) {
    const m = /^(\d+)_(.+)$/.exec(key);
    if (!m) continue;
    const i = Number(m[1]);
    const field = m[2]!;
    const row = rows.get(i) ?? ({ sdPath: '', type: 1 } as Favorite);
    if (field === 'primary_path') row.sdPath = value;
    else if (field === 'secondary_path' && value) row.secondarySdPath = value;
    else if (field === 'type') row.type = (Number(value) === 2 ? 2 : 1) as 1 | 2;
    else if (field === 'game_code' && value) row.gameCode = value;
    else if (field === 'presents_as' && value) row.presentsAs = Number(value);
    rows.set(i, row);
  }
  return [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, r]) => r)
    .filter((r) => r.sdPath);
}

async function parseGameconfigs(dir: string, favorites: Favorite[]): Promise<void> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return;
  }
  const byStem = new Map(favorites.map((f) => [basename(f.sdPath, extname(f.sdPath)), f]));
  const byCode = new Map(favorites.filter((f) => f.gameCode).map((f) => [f.gameCode!.toUpperCase(), f]));

  for (const name of names) {
    const abs = join(dir, name);
    if (name.toLowerCase().endsWith('.meta.ini')) {
      const code = name.slice(0, -'.meta.ini'.length).toUpperCase();
      const fav = byCode.get(code);
      if (!fav) continue;
      const doc = parseIni(await fs.readFile(abs, 'utf8'));
      fav.meta = {
        title: getString(doc, 'meta', 'title'),
        developer: getString(doc, 'meta', 'developer'),
        release_jp: getString(doc, 'meta', 'release_jp'),
        release_us: getString(doc, 'meta', 'release_us'),
        release_eu: getString(doc, 'meta', 'release_eu'),
        description: getString(doc, 'meta', 'description'),
      };
    } else if (name.toLowerCase().endsWith('.ini')) {
      const stem = name.slice(0, -4);
      const fav = byStem.get(stem);
      if (!fav) continue;
      const doc = parseIni(await fs.readFile(abs, 'utf8'));
      const pa = getInt(doc, '', 'presents_as', 0);
      if (pa) fav.presentsAs = pa;
      const cic = getInt(doc, 'custom_boot', 'cic_type', -1);
      const save = getInt(doc, 'custom_boot', 'save_type', -1);
      const tv = getInt(doc, 'custom_boot', 'tv_type', -1);
      if (cic !== -1 || save !== -1 || tv !== -1) fav.boot = { cic, save, tv };
      const g = getInt(doc, 'presentation', 'image_view_grid', -1);
      const ins = getInt(doc, 'presentation', 'image_view_inspect', -1);
      const load = getInt(doc, 'presentation', 'image_view_load', -1);
      if (g !== -1 || ins !== -1 || load !== -1) fav.imageView = { grid: g, inspect: ins, load };
    } else if (name.toLowerCase().endsWith('.png')) {
      const fav = favorites.find((f) => {
        const s = basename(f.sdPath, extname(f.sdPath));
        return ART_TYPES.some((t) => name === `${s}${ART_TYPE_CUSTOM_SUFFIX[t]}.png`);
      });
      if (!fav) continue;
      for (const t of ART_TYPES) {
        const s = basename(fav.sdPath, extname(fav.sdPath));
        if (name === `${s}${ART_TYPE_CUSTOM_SUFFIX[t]}.png`) {
          fav.art = { ...(fav.art ?? {}), [t]: abs };
        }
      }
    }
  }
}

function parseDiscLinks(text: string | null): DiscLink[] {
  if (!text) return [];
  const out: DiscLink[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9]{4})\s*=\s*(.+?)\s*$/.exec(line);
    if (m) out.push({ code: m[1]!.toUpperCase(), sdPath: m[2]! });
  }
  return out;
}

/** Longest common directory prefix of the favorite/history SD paths -> RomSources. */
function inferSources(paths: string[], storagePrefix: string): RomSource[] {
  const prefix = storagePrefix.replace(/\/+$/, '');
  const dirs = new Set<string>();
  for (const p of paths) {
    if (!p.startsWith(prefix)) continue;
    const rel = p.slice(prefix.length); // "/All n64/sub/game.n64"
    const parts = rel.split('/').filter(Boolean);
    parts.pop();
    dirs.add('/' + (parts[0] ?? ''));
  }
  return [...dirs]
    .filter((d) => d !== '/')
    .map((sdDir) => ({ hostDir: '', sdDir }));
}

export async function importFromSd(sdRoot: string): Promise<Project> {
  // accept either the SD root or a folder that *is* the menu/ dir
  const menuDir = basename(sdRoot).toLowerCase() === 'menu' ? sdRoot : join(sdRoot, 'menu');
  const n64everDir = join(menuDir, 'n64ever');

  const project: Project = newProject(`Imported from ${basename(sdRoot)}`);
  project.settings = parseSettings(await readTextIfExists(join(menuDir, 'config.ini')));
  project.storagePrefix = 'sd:/';

  project.favorites = parseBookkeeping(
    await readTextIfExists(join(n64everDir, 'favorites.ini')),
    'favorite',
  );
  project.history = parseBookkeeping(
    await readTextIfExists(join(n64everDir, 'history.ini')),
    'history',
  ) as HistoryEntry[] as Favorite[];

  await parseGameconfigs(join(n64everDir, 'gameconfigs'), project.favorites);

  project.discLinks = [
    ...parseDiscLinks(await readTextIfExists(join(n64everDir, 'disclink_jp.ini'))),
    ...parseDiscLinks(await readTextIfExists(join(n64everDir, 'disclink_us.ini'))),
  ];

  try {
    await fs.access(join(n64everDir, 'splash.png'));
    project.splashImage = join(n64everDir, 'splash.png');
  } catch {
    /* none */
  }

  const uiDir = join(n64everDir, 'ui');
  const menuJson =
    (await readTextIfExists(join(uiDir, 'menu.json'))) ?? (await readTextIfExists(join(uiDir, 'home.json')));
  if (menuJson) {
    const layout = fromMenuJson(menuJson);
    for (const pg of layout.pages) {
      for (const e of pg.elements) {
        if (e.type === 'image' && e.src) {
          const abs = join(uiDir, 'assets', e.src);
          try {
            await fs.access(abs);
            e.srcHostPath = abs;
          } catch {
            /* asset missing */
          }
        }
      }
      if (pg.skin) {
        const abs = join(uiDir, pg.skin);
        try {
          await fs.access(abs);
          pg.skinHostPath = abs;
        } catch {
          pg.skin = undefined;
        }
      }
    }
    project.layout = layout;
  }

  project.romSources = inferSources(
    [...project.favorites, ...project.history].map((f) => f.sdPath),
    project.storagePrefix,
  );

  return project;
}
