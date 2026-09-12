/**
 * Baked box-art library access. Mirrors the firmware's resolution: exact
 * boxart/<CODE>/<type>.png, else region-fallback across region bytes on the
 * 3-char base code (ui_components/boxart.c try_dfs_sprite).
 */

import { app, protocol } from 'electron';
import { promises as fs } from 'node:fs';
import { join, extname } from 'node:path';
import artIndex from '../shared/data/art-index.json' with { type: 'json' };
import { ART_TYPES, type ArtType } from '../shared/enums.ts';
import type { ArtInfo } from '../shared/ipc-api.ts';

const INDEX = artIndex as { types: ArtType[]; codes: Record<string, number> };
const REGION_FALLBACK = ['E', 'P', 'J', 'U', 'A', 'X', 'Y', 'D', 'F', 'I', 'S'];

let ART_ROOT = '';

export function artRoot(): string {
  if (ART_ROOT) return ART_ROOT;
  const packaged = join(process.resourcesPath ?? '', 'boxart');
  const dev = join(app.getAppPath(), '..', '..', 'assets', 'images', 'boxart');
  ART_ROOT = process.env.MENU_BUILDER_ART_ROOT || (app.isPackaged ? packaged : dev);
  return ART_ROOT;
}

function has(code: string, type: ArtType): boolean {
  const mask = INDEX.codes[code];
  if (mask == null) return false;
  const bit = INDEX.types.indexOf(type);
  return bit >= 0 && (mask & (1 << bit)) !== 0;
}

/** Resolve the code that actually has `type` art, applying region fallback. */
export function resolveArtCode(code: string, type: ArtType): string | null {
  if (!code || code.length < 3) return null;
  if (has(code, type)) return code;
  const base = code.slice(0, 3);
  for (const r of REGION_FALLBACK) {
    const c = base + r;
    if (c !== code && has(c, type)) return c;
  }
  // any region byte present in the index for this base
  for (const c of Object.keys(INDEX.codes)) {
    if (c.startsWith(base) && has(c, type)) return c;
  }
  return null;
}

/** Absolute host path of the best baked art for (code, type), or null. */
export function bakedArtPath(code: string | undefined, type: ArtType): string | null {
  if (!code) return null;
  const resolved = resolveArtCode(code.toUpperCase(), type);
  return resolved ? join(artRoot(), resolved, `${type}.png`) : null;
}

/**
 * Register the `art://` scheme. URLs:
 *   art://baked/<CODE>/<type>     -> baked library PNG (region fallback)
 *   art://file/<abs host path>    -> an arbitrary local image (per-game override preview)
 */
const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export function registerArtProtocol(): void {
  protocol.handle('art', async (request) => {
    const url = new URL(request.url);
    let abs: string | null = null;
    if (url.hostname === 'baked') {
      const [, code, type] = url.pathname.split('/');
      abs = bakedArtPath(code, (type ?? 'front') as ArtType);
    } else if (url.hostname === 'file') {
      abs = decodeURIComponent(url.pathname.replace(/^\//, ''));
    } else if (url.hostname === 'font') {
      // art://font/<file> -> resources/fonts/<file>  (the canvas display fonts)
      const file = url.pathname.replace(/^\//, '').replace(/[/\\]/g, '');
      if (file) abs = join(resourcesDir(), 'fonts', file);
    }
    if (!abs) return new Response('not found', { status: 404 });
    try {
      const data = await fs.readFile(abs);
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream',
          'Cache-Control': 'no-cache',
          // fonts are subject to CORS even for a privileged scheme
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });
}

export async function artExists(code: string | undefined, type: ArtType): Promise<boolean> {
  const p = bakedArtPath(code, type);
  if (!p) return false;
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Where bundled resources (boxart/, menu-rom/) live. */
export function resourcesDir(): string {
  if (app.isPackaged) return process.resourcesPath;
  return join(app.getAppPath(), 'resources');
}

/** art:// URL for an arbitrary local image file (per-game override preview). */
export function artFileUrl(hostPath: string): string {
  return `art://file/${encodeURIComponent(hostPath)}`;
}

/** Which of the 6 art types resolve for a code, and their art:// URLs. */
export function artInfoFor(code: string): ArtInfo {
  const baked = {} as Record<ArtType, boolean>;
  const url: Partial<Record<ArtType, string>> = {};
  for (const t of ART_TYPES) {
    const resolved = resolveArtCode((code ?? '').toUpperCase(), t);
    baked[t] = resolved != null;
    if (resolved) url[t] = `art://baked/${resolved}/${t}`;
  }
  return { baked, url };
}
