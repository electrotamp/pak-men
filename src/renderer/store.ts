/** Tiny external store (no deps). `useStore` subscribes React components. */

import { useSyncExternalStore } from 'react';
import type { Project, RomEntry } from '../shared/types.ts';
import { readSkin, applySkin, type Skin } from './theme/skin.ts';

export interface AppState {
  project: Project | null;
  projectPath: string | null;
  dirty: boolean;
  /** All ROMs discovered across the project's sources, keyed by sdPath. */
  library: Map<string, RomEntry>;
  scanning: boolean;
  scanMsg: string;
  /** Selected favorite index in the grid, or -1. */
  selected: number;
  /** Right-panel mode. */
  view: 'grid' | 'settings' | 'history' | 'design';
  toast: string | null;
  /** Active app skin (Flat / Bubbly). Persisted; applied as data-skin on <html>. */
  skin: Skin;
  /** Design tab: selected slot id(s), snap settings, zoom, current page. */
  design: {
    selected: string[];
    snap: boolean;
    gridPx: number;
    /** Absolute canvas scale: 1 = one framebuffer pixel per screen pixel. */
    zoom: number;
    /** True while the canvas auto-scales to fill the pane; any manual zoom clears it. */
    zoomFit: boolean;
    /** The scale "Fit" currently resolves to. Measured by the Canvas, read by the
     *  toolbar so its +/- buttons can step off the fitted scale. */
    fitZoom: number;
    /** Makes the background-image layer selectable/draggable on the canvas. */
    skinEdit: boolean;
    /** CRT emulation layers enabled over the canvas — any combination. Cosmetic; persisted. */
    crt: CrtFilter[];
    /** Show the overscan safe-zone guide + dim outside it. Persisted. */
    safeGuide: boolean;
    /** Id of the page the canvas is editing. */
    page: string;
    /** Id of the last template applied (TEMPLATES manifest) — labels the picker. */
    template: string;
  };
}

/** CRT emulation layers — each is an independent overlay; stack any combination. */
export const CRT_FILTERS = ['scanlines', 'aperture', 'shadowmask', 'bloom', 'vignette'] as const;
export type CrtFilter = (typeof CRT_FILTERS)[number];
export const CRT_FILTER_LABEL: Record<CrtFilter, string> = {
  scanlines: 'Scanlines',
  aperture: 'Aperture grille',
  shadowmask: 'Shadow mask',
  bloom: 'Bloom / blur',
  vignette: 'Tube vignette',
};

const readCrt = (): CrtFilter[] => {
  try {
    return (localStorage.getItem('mb.crt') ?? '')
      .split(',')
      .filter((f): f is CrtFilter => (CRT_FILTERS as readonly string[]).includes(f));
  } catch {
    return [];
  }
};

export const writeCrt = (fs: CrtFilter[]): void => {
  try {
    localStorage.setItem('mb.crt', fs.join(','));
  } catch {
    /* private mode — still works for the session */
  }
};

const readSafeGuide = (): boolean => {
  try {
    return localStorage.getItem('mb.safeGuide') !== '0';
  } catch {
    return true;
  }
};
export const writeSafeGuide = (on: boolean): void => {
  try {
    localStorage.setItem('mb.safeGuide', on ? '1' : '0');
  } catch {
    /* private mode — still works for the session */
  }
};

/** Canvas zoom. Continuous in 5% steps from ZOOM_MIN..ZOOM_MAX (+/− keys, the
 *  zoom-pill buttons and the wheel all move by ZOOM_INCREMENT); whole-number
 *  zooms stay pixel-perfect (`image-rendering: pixelated`), the rest render
 *  smoothly. ZOOM_STEPS is just the shortlist the zoom-pill dropdown offers. */
export const ZOOM_INCREMENT = 0.05;
export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8] as const;
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 8;
export const clampZoom = (z: number): number => {
  const v = Number.isFinite(z) ? z : 1;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(v * 100) / 100));
};

/** One 5% step above (dir 1) or below (dir -1) `cur`, snapped to the 5% grid. */
export function zoomStep(cur: number, dir: 1 | -1): number {
  const grid = Math.round(cur / ZOOM_INCREMENT) * ZOOM_INCREMENT;
  return clampZoom(grid + dir * ZOOM_INCREMENT);
}

/** The largest 5% step that still fits a pane whose board-to-pane ratio is `s`
 *  — where "Fit" lands, so +/− steps cleanly from there. */
export function zoomFit(s: number): number {
  return clampZoom(Math.floor(s / ZOOM_INCREMENT) * ZOOM_INCREMENT);
}

let state: AppState = {
  project: null,
  projectPath: null,
  dirty: false,
  library: new Map(),
  scanning: false,
  scanMsg: '',
  selected: -1,
  view: 'design',
  toast: null,
  skin: readSkin(),
  design: {
    selected: [],
    snap: true,
    gridPx: 8,
    zoom: 1,
    zoomFit: true,
    fitZoom: 1,
    skinEdit: false,
    crt: readCrt(),
    safeGuide: readSafeGuide(),
    page: 'home',
    template: 'grand-tour',
  },
};

const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
  );
}

// ---- project mutation helpers ----

export function updateProject(mut: (p: Project) => void): void {
  if (!state.project) return;
  const p = structuredClone(state.project);
  mut(p);
  setState({ project: p, dirty: true });
}

export function setSkin(skin: Skin): void {
  applySkin(skin);
  setState({ skin });
}

export function toast(msg: string): void {
  setState({ toast: msg });
  setTimeout(() => {
    if (getState().toast === msg) setState({ toast: null });
  }, 3500);
}
