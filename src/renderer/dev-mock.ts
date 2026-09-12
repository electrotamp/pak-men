/**
 * Dev-only browser stub for `window.api`, so the renderer can be opened in a plain
 * browser tab (outside Electron) for fast UI iteration. Never bundled in production
 * (guarded by import.meta.env.DEV at the call site).
 */

import type { MenuBuilderApi } from '../shared/ipc-api.ts';
import type { Project } from '../shared/types.ts';
import { ART_TYPES, type ArtType } from '../shared/enums.ts';
import { defaultSettings } from '../shared/settings-schema.ts';
import artIndex from '../shared/data/art-index.json' with { type: 'json' };

/** Mirror of main/art.ts resolveArtCode: exact code, else region fallback. */
const AI = artIndex as { types: ArtType[]; codes: Record<string, number> };
const REGIONS = ['E', 'P', 'J', 'U', 'A', 'X', 'Y', 'D', 'F', 'I', 'S'];
function resolveArtCode(code: string, type: ArtType): string | null {
  const bit = AI.types.indexOf(type);
  if (bit < 0 || !code || code.length < 3) return null;
  const hit = (c: string) => AI.codes[c] != null && (AI.codes[c]! & (1 << bit)) !== 0;
  if (hit(code)) return code;
  for (const r of REGIONS) if (hit(code.slice(0, 3) + r)) return code.slice(0, 3) + r;
  return null;
}

function mockProject(name: string): Project {
  return {
    format: 3,
    name,
    storagePrefix: 'sd:/',
    targetCarts: ['sc64'],
    romSources: [],
    favorites: [],
    history: [],
    settings: defaultSettings(),
    discLinks: [],
  };
}

export function installDevMock(): void {
  if (window.api) return;
  const noop = async () => null;
  const api: MenuBuilderApi = {
    newProject: async () => mockProject('Browser preview'),
    openProject: noop,
    saveProject: async () => ({ path: 'preview.n64menu' }),
    recentProjectPath: noop,
    pickFolder: noop,
    // returns a fake path so skin / image-widget flows are reachable in the
    // browser preview; artUrlForFile below renders a placeholder for any path
    pickFile: async () => 'C:\\preview\\picked-image.png',
    scanSource: async () => ({ entries: [], errors: [] }),
    identify: async (hostPath) => ({
      hostPath,
      sdPath: hostPath,
      source: { hostDir: '', sdDir: '/' },
      fileName: hostPath,
      ext: '.z64',
      type: 1,
      special: -1,
      displayName: hostPath,
    }),
    // the preview's vite publicDir points at resources/, so a bundled cover is
    // served at /boxart/<code>/<type>.png
    artInfo: async (code: string) => {
      const baked = Object.fromEntries(ART_TYPES.map((t) => [t, false])) as Record<ArtType, boolean>;
      const url: Partial<Record<ArtType, string>> = {};
      for (const t of ART_TYPES) {
        const resolved = resolveArtCode(code, t);
        if (resolved) {
          baked[t] = true;
          url[t] = `/boxart/${resolved}/${t}.png`;
        }
      }
      return { baked, url };
    },
    artUrlForFile: (p) => {
      // preview convenience: resolve the image srcs templates use.
      //  - `boxart/<CODE>/<type>.png` → the bundled box-art library (publicDir)
      //  - any other bare filename → resources/default-assets/
      //  - anything else → a labelled placeholder.
      const bx = /(?:^|[\\/])(boxart[\\/][A-Za-z0-9]{2,4}[\\/][a-z0-9]+\.png)$/i.exec(p);
      if (bx?.[1]) return `/${bx[1].replace(/\\/g, '/')}`;
      const m = /([^\\/]+\.(png|jpg|jpeg|gif))$/i.exec(p);
      if (m?.[1]) return `/default-assets/${m[1]}`;
      return `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='480'><rect width='100%' height='100%' fill='%23223'/><text x='50%' y='50%' fill='%2399a' font-size='24' text-anchor='middle'>${p}</text></svg>`,
      )}`;
    },
    planExport: async (_p, target) => ({ target, entries: [], orphans: [], warnings: ['(browser preview — export is a no-op)'] }),
    commitExport: async () => ({ ok: true }),
    importFromSd: async () => mockProject('Imported (preview)'),
    testMenu: async (_p, _opts) => ({ ok: false, message: 'Test Menu needs the desktop app.' }),
    bundledMenuRoms: async () => [],
    openExternal: async () => {},
    appInfo: async () => ({ version: '0.0.0-preview', artRoot: '(browser)', menuDataVersion: 1 }),
    checkForUpdate: async () => null,
    downloadUpdate: async () => '(browser preview)',
    applyUpdate: async () => {},
  };
  (window as unknown as { api: MenuBuilderApi }).api = api;
  (
    window as unknown as {
      events: { onScanProgress: () => () => void; onUpdateProgress: () => () => void };
    }
  ).events = {
    onScanProgress: () => () => {},
    onUpdateProgress: () => () => {},
  };

  // preview affordance: expose the live design as shipped menu.json (+ which
  // template it came from), so in-canvas edits can be captured straight back
  // into a template file. `window.__mb.menuJson()` === what `toMenuJson` writes
  // to the SD card, so it's the exact form a template ships in.
  void (async () => {
    const [{ getState }, { toMenuJson }] = await Promise.all([
      import('./store.ts'),
      import('../shared/menu-schema.ts'),
    ]);
    (window as unknown as { __mb: unknown }).__mb = {
      template: () => getState().design.template,
      layout: () => getState().project?.layout ?? null,
      menuJson: () => {
        const l = getState().project?.layout;
        return l ? toMenuJson(l) : null;
      },
    };
  })();
}
