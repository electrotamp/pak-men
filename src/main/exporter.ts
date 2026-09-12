/**
 * Export a Project to the exact `menu/` file tree the firmware reads. Produces an
 * in-memory file list first (testable), then `planExport` / `commitExport` apply
 * it to a target folder with a diff + temp-dir swap.
 *
 * File-format contracts are in the plan doc and mirror:
 *   bookkeeping.c (favorites/history), settings.c (config.ini),
 *   rom_info.c (gameconfigs/<stem>.ini), game_metadata.h (<CODE>.meta.ini),
 *   ui_components/boxart.c (art suffixes), disclink.c, menu.c (.migrated marker).
 */

import { basename, extname, join, posix } from 'node:path';
import { promises as fs, existsSync } from 'node:fs';
import { IniBuilder } from '../shared/ini.ts';
import { SETTINGS_SCHEMA, settingId, type SettingsValues } from '../shared/settings-schema.ts';
import { ART_TYPES, ART_TYPE_CUSTOM_SUFFIX } from '../shared/enums.ts';
import type { Project, Favorite, ExportPlan, ExportPlanEntry } from '../shared/types.ts';
import { toMenuJson, startPage } from '../shared/menu-schema.ts';
import dataver from '../shared/data/dataver.json' with { type: 'json' };
import { fitPng } from './image.ts';

export const MENU_DATA_VERSION = (dataver as { menuDataVersion: number }).menuDataVersion;

const SPLASH_MAX = { w: 640, h: 480 };
const CUSTOM_ART_MAX = { w: 1024, h: 1024 };
const AUDIO_KEYS = ['grid_move', 'grid_enter', 'grid_back', 'launch'] as const;

export interface OutFile {
  /** POSIX-style path relative to the export root. */
  rel: string;
  data: Buffer;
  /** Where the bytes came from, for the plan UI. */
  note?: string;
}

export interface BuildResult {
  files: OutFile[];
  warnings: string[];
}

const enc = (s: string) => Buffer.from(s, 'utf8');
const stem = (p: string) => basename(p, extname(p));

// --------------------------------------------------------------- favorites / history

function bookkeepingIni(items: Favorite[], group: 'favorite' | 'history'): string {
  const b = new IniBuilder();
  items.forEach((it, i) => {
    b.setString(group, `${i}_primary_path`, it.sdPath);
    b.setString(group, `${i}_secondary_path`, it.secondarySdPath ?? '');
    b.setInt(group, `${i}_type`, it.type);
    if (it.gameCode) b.setString(group, `${i}_game_code`, it.gameCode);
    if (it.presentsAs && it.presentsAs !== 0) b.setInt(group, `${i}_presents_as`, it.presentsAs);
  });
  return b.toString();
}

// --------------------------------------------------------------- config.ini

export function configIni(settings: SettingsValues, effective: SettingsValues): string {
  const b = new IniBuilder();
  for (const spec of SETTINGS_SCHEMA) {
    const id = settingId(spec);
    const v = effective[id] ?? settings[id] ?? spec.default;
    if (spec.kind === 'bool') b.setBool(spec.section, spec.key, Boolean(v));
    else if (spec.kind === 'int' || spec.kind === 'enum') b.setInt(spec.section, spec.key, Number(v));
    else b.setString(spec.section, spec.key, String(v));
  }
  return b.toString();
}

// --------------------------------------------------------------- per-game gameconfigs

function gameConfigIni(fav: Favorite): string | null {
  const b = new IniBuilder();
  if (fav.presentsAs && fav.presentsAs !== 0) b.setInt('', 'presents_as', fav.presentsAs);
  if (fav.boot) {
    if (fav.boot.cic != null && fav.boot.cic !== -1) b.setInt('custom_boot', 'cic_type', fav.boot.cic);
    if (fav.boot.save != null && fav.boot.save !== -1) b.setInt('custom_boot', 'save_type', fav.boot.save);
    if (fav.boot.tv != null && fav.boot.tv !== -1) b.setInt('custom_boot', 'tv_type', fav.boot.tv);
  }
  if (fav.imageView) {
    const iv = fav.imageView;
    if (iv.grid != null && iv.grid >= 0) b.setInt('presentation', 'image_view_grid', iv.grid);
    if (iv.inspect != null && iv.inspect >= 0) b.setInt('presentation', 'image_view_inspect', iv.inspect);
    if (iv.load != null && iv.load >= 0) b.setInt('presentation', 'image_view_load', iv.load);
  }
  return b.isEmpty ? null : b.toString();
}

function metaIni(fav: Favorite): string | null {
  if (!fav.meta) return null;
  const m = fav.meta;
  const b = new IniBuilder();
  if (m.title) b.setString('meta', 'title', m.title);
  if (m.developer) b.setString('meta', 'developer', m.developer);
  if (m.release_jp) b.setString('meta', 'release_jp', m.release_jp);
  if (m.release_us) b.setString('meta', 'release_us', m.release_us);
  if (m.release_eu) b.setString('meta', 'release_eu', m.release_eu);
  if (m.description) b.setString('meta', 'description', m.description);
  return b.isEmpty ? null : b.toString();
}

// --------------------------------------------------------------- disclink

function disclinkFiles(project: Project): OutFile[] {
  const jp: string[] = [];
  const us: string[] = [];
  for (const link of project.discLinks) {
    const line = `${link.code.slice(0, 4)} = ${link.sdPath}\n`;
    (link.code[3] === 'J' ? jp : us).push(line);
  }
  const out: OutFile[] = [];
  if (jp.length) out.push({ rel: 'menu/n64ever/disclink_jp.ini', data: enc(jp.join('')) });
  if (us.length) out.push({ rel: 'menu/n64ever/disclink_us.ini', data: enc(us.join('')) });
  return out;
}

// --------------------------------------------------------------- menu ROM

const CART_ROM_FILES: Record<string, string> = {
  sc64: 'sc64menu.n64',
  ed64: 'OS64.v64',
  ed64p: 'OS64P.v64',
  '64drive': 'menu.bin',
};

async function menuRomFiles(project: Project, resourcesDir: string, warnings: string[]): Promise<OutFile[]> {
  const out: OutFile[] = [];
  for (const cart of project.targetCarts) {
    const name = CART_ROM_FILES[cart];
    if (!name) continue;
    const src = join(resourcesDir, 'menu-rom', name);
    try {
      const data = await fs.readFile(src);
      out.push({ rel: name, data, note: 'bundled menu ROM' });
    } catch {
      warnings.push(
        `Menu ROM for ${cart} (${name}) is not bundled — run "npm run stage" in tools/menu-builder after a firmware build, or uncheck this cart.`,
      );
    }
  }
  return out;
}

// --------------------------------------------------------------- build

export function effectiveSettings(project: Project): SettingsValues {
  const eff: SettingsValues = { ...project.settings };
  eff['menu.schema_revision'] = 1;
  eff['menu.first_run'] = false;

  const hasOverrides = project.favorites.some(
    (f) => f.meta || (f.art && Object.keys(f.art).length > 0),
  );
  if (hasOverrides) eff['menu.use_custom_files'] = true;

  if (project.splashImage) {
    eff['menu.custom_splash_enabled'] = true;
    eff['menu.splash_enabled'] = true;
  }
  return eff;
}

/** Build the full in-memory file tree for a project. */
export async function buildExport(project: Project, opts: { resourcesDir: string }): Promise<BuildResult> {
  const warnings: string[] = [];
  const files: OutFile[] = [];

  const favorites = project.favorites.slice(0, 2048);
  if (project.favorites.length > 2048) {
    warnings.push(`Favorites capped at 2048 (project has ${project.favorites.length}).`);
  }
  const history = project.history.slice(0, 64);

  files.push({ rel: 'menu/config.ini', data: enc(configIni(project.settings, effectiveSettings(project))) });
  files.push({ rel: 'menu/n64ever/favorites.ini', data: enc(bookkeepingIni(favorites, 'favorite')) });
  files.push({ rel: 'menu/n64ever/history.ini', data: enc(bookkeepingIni(history, 'history')) });
  files.push({ rel: `menu/n64ever/.migrated.v${MENU_DATA_VERSION}`, data: Buffer.alloc(0) });

  // per-game gameconfigs + meta + art
  const seenMeta = new Set<string>();
  for (const fav of favorites) {
    const s = stem(fav.sdPath);
    const gc = gameConfigIni(fav);
    if (gc) files.push({ rel: `menu/n64ever/gameconfigs/${s}.ini`, data: enc(gc) });

    if (fav.meta && fav.gameCode) {
      const code = fav.gameCode.slice(0, 4).toUpperCase();
      const mi = metaIni(fav);
      if (mi && !seenMeta.has(code)) {
        seenMeta.add(code);
        files.push({ rel: `menu/n64ever/gameconfigs/${code}.meta.ini`, data: enc(mi) });
        checkMetaLength(fav, code, warnings);
      }
    } else if (fav.meta && !fav.gameCode) {
      warnings.push(`"${basename(fav.sdPath)}" has a metadata override but no game code — skipped.`);
    }

    if (fav.art) {
      for (const type of ART_TYPES) {
        const src = fav.art[type];
        if (!src) continue;
        try {
          const fit = await fitPng(src, CUSTOM_ART_MAX.w, CUSTOM_ART_MAX.h);
          if (fit.passthrough) warnings.push(`Could not process art image ${basename(src)} — copied as-is.`);
          else if (fit.resized) warnings.push(`Resized ${basename(src)} to ${fit.width}x${fit.height} (max 1024).`);
          files.push({
            rel: `menu/n64ever/gameconfigs/${s}${ART_TYPE_CUSTOM_SUFFIX[type]}.png`,
            data: fit.buffer,
            note: `art: ${type}`,
          });
        } catch (e) {
          warnings.push(`Failed to read art image ${basename(src)}: ${(e as Error).message}`);
        }
      }
    }
  }

  files.push(...disclinkFiles(project));

  if (project.layout) {
    const layout = project.layout;
    files.push({
      rel: 'menu/n64ever/ui/menu.json',
      data: enc(toMenuJson(layout)),
      note: 'menu layout',
    });

    // per-page background skins; the start page's also bakes for the firmware
    const boot = startPage(layout);
    const seenSkin = new Set<string>();
    for (const pg of layout.pages) {
      if (!pg.skin || !pg.skinHostPath || seenSkin.has(pg.skin)) continue;
      seenSkin.add(pg.skin);
      try {
        const fit = await fitPng(pg.skinHostPath, 640, 480);
        if (fit.resized)
          warnings.push(`Resized "${pg.title}" background to ${fit.width}x${fit.height} (max 640x480).`);
        files.push({ rel: `menu/n64ever/ui/${pg.skin}`, data: fit.buffer, note: `"${pg.title}" background` });
        if (project.bakeSkin && pg.id === boot.id) {
          files.push({ rel: 'assets/images/menu_skin.png', data: fit.buffer, note: 'start-page background (firmware bake)' });
        }
      } catch (e) {
        warnings.push(`Failed to read background for "${pg.title}": ${(e as Error).message}`);
      }
    }

    // Ship each image at exactly the size it's drawn on the canvas (rect is in
    // framebuffer pixels, 1:1 with hardware). The console decodes every image to
    // a resident surface, so a full-screen PNG is ~0.6 MB of RAM — shipping the
    // source at native resolution is what starved the grid cover loader into an
    // out-of-memory panic. `fitPng` never upscales, so the element rect is the
    // real ceiling; clamp anyway so a near-full-screen decorative image can't
    // eat the whole heap.
    const IMG_HARD_CAP = 512;
    const displayMax = new Map<string, { w: number; h: number }>();
    for (const pg of layout.pages)
      for (const el of pg.elements)
        if (el.type === 'image' && el.src) {
          const w = Math.min(IMG_HARD_CAP, Math.max(1, Math.ceil(el.rect[2])) || IMG_HARD_CAP);
          const h = Math.min(IMG_HARD_CAP, Math.max(1, Math.ceil(el.rect[3])) || IMG_HARD_CAP);
          const cur = displayMax.get(el.src);
          displayMax.set(el.src, { w: Math.max(cur?.w ?? 0, w), h: Math.max(cur?.h ?? 0, h) });
        }

    // image-element assets, deduped across every page
    const seenAsset = new Set<string>();
    for (const pg of layout.pages) {
      for (const el of pg.elements) {
        if (el.type !== 'image' || !el.src) continue;
        // no picked file: fall back to a bundled asset —
        //  - `boxart/<CODE>/<type>.png` from the bundled box-art library (the
        //    themed templates decorate with real game logos / box renders)
        //  - otherwise a default asset of the same name (the showcase's emblem)
        const isBoxart = /^boxart[\\/]/i.test(el.src);
        const host =
          el.srcHostPath ??
          (isBoxart
            ? join(opts.resourcesDir, el.src)
            : join(opts.resourcesDir, 'default-assets', basename(el.src)));
        if (!el.srcHostPath && !existsSync(host)) {
          warnings.push(`Image "${el.id}" on "${pg.title}" has no source file — pick one on the Design tab.`);
          continue;
        }
        if (seenAsset.has(el.src)) continue;
        seenAsset.add(el.src);
        const rel = isBoxart ? el.src.replace(/\\/g, '/') : el.src;
        const cap = displayMax.get(el.src) ?? { w: IMG_HARD_CAP, h: IMG_HARD_CAP };
        try {
          const fit = await fitPng(host, cap.w, cap.h);
          files.push({ rel: `menu/n64ever/ui/assets/${rel}`, data: fit.buffer, note: 'image element' });
        } catch (e) {
          warnings.push(`Failed to read image ${el.src}: ${(e as Error).message}`);
        }
      }
    }
  }

  if (project.splashImage) {
    try {
      const fit = await fitPng(project.splashImage, SPLASH_MAX.w, SPLASH_MAX.h);
      if (fit.resized) warnings.push(`Resized splash to ${fit.width}x${fit.height} (max 640x480).`);
      files.push({ rel: 'menu/n64ever/splash.png', data: fit.buffer, note: 'custom splash' });
    } catch (e) {
      warnings.push(`Failed to read splash image: ${(e as Error).message}`);
    }
  }

  if (project.audio) {
    for (const key of AUDIO_KEYS) {
      const src = project.audio[key];
      if (!src) continue;
      if (extname(src).toLowerCase() !== '.wav64') {
        warnings.push(`Audio "${key}" must be a .wav64 file (got ${basename(src)}) — skipped.`);
        continue;
      }
      try {
        files.push({ rel: `menu/n64ever/audio/${key}.wav64`, data: await fs.readFile(src) });
      } catch (e) {
        warnings.push(`Failed to read audio ${basename(src)}: ${(e as Error).message}`);
      }
    }
  }

  files.push(...(await menuRomFiles(project, opts.resourcesDir, warnings)));

  if (project.copyRoms) {
    warnings.push('Copy-ROMs is enabled: the export will also copy every referenced ROM file (large).');
  }

  // stable order
  files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return { files, warnings };
}

function checkMetaLength(fav: Favorite, code: string, warnings: string[]): void {
  const d = fav.meta?.description;
  if (d && d.length > 255) {
    warnings.push(
      `${code}.meta.ini description is ${d.length} chars — the menu's INI parser truncates values at 255.`,
    );
  }
}

// --------------------------------------------------------------- plan + commit

export async function planExport(build: BuildResult, target: string): Promise<ExportPlan> {
  const entries: ExportPlanEntry[] = [];
  for (const f of build.files) {
    const abs = join(target, f.rel);
    let action: ExportPlanEntry['action'] = 'create';
    try {
      const existing = await fs.readFile(abs);
      action = existing.equals(f.data) ? 'unchanged' : 'overwrite';
    } catch {
      action = 'create';
    }
    entries.push({ rel: f.rel, action, bytes: f.data.length, note: f.note });
  }

  const owned = new Set(build.files.map((f) => f.rel));
  const orphans: string[] = [];
  for (const rel of await listTree(join(target, 'menu'), target)) {
    if (!owned.has(rel) && !isFirmwareOwned(rel)) orphans.push(rel);
  }

  return { target, entries, orphans, warnings: build.warnings };
}

/** Paths the firmware itself manages that we must never flag as orphans. */
function isFirmwareOwned(rel: string): boolean {
  return (
    rel === 'menu/config.ini' ||
    rel.startsWith('menu/cache/') ||
    rel.startsWith('menu/metadata/') ||
    rel.startsWith('menu/64ddipl/') ||
    rel.startsWith('menu/emulators/') ||
    /^menu\/n64ever\/\.migrated\.v\d+$/.test(rel) ||
    rel === 'menu/n64ever/favorites.ini' ||
    rel === 'menu/n64ever/history.ini'
  );
}

export async function commitExport(build: BuildResult, target: string): Promise<void> {
  for (const f of build.files) {
    const abs = join(target, f.rel);
    await fs.mkdir(join(abs, '..'), { recursive: true });
    await fs.writeFile(abs, f.data);
  }
}

async function listTree(dir: string, root: string): Promise<string[]> {
  const out: string[] = [];
  let ents: import('node:fs').Dirent[];
  try {
    ents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of ents) {
    const abs = join(dir, e.name);
    const rel = posix.normalize(abs.slice(root.length + 1).split(/[\\/]/).join('/'));
    if (e.isDirectory()) out.push(...(await listTree(abs, root)));
    else out.push(rel);
  }
  return out;
}
