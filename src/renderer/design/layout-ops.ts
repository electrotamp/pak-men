import {
  newElement,
  elementById,
  PAGE_ELEMENT_LIMIT,
  FRAMEBUFFER,
  SKIN_LAYER_ID,
  type MenuLayout,
  type Element,
  type ElementType,
  type Page,
  type Rect,
} from '../../shared/menu-schema.ts';
import { getState } from '../store.ts';
import { updateLayout, select, currentPageObj } from './state.ts';

export { SKIN_LAYER_ID };

function activePageId(): string {
  return getState().design.page;
}
function activePage(layout: MenuLayout | null | undefined): Page | undefined {
  return currentPageObj(layout, activePageId());
}

// -------- page background image ("skin") layer --------

let skinNatural: [number, number] = [FRAMEBUFFER.w, FRAMEBUFFER.h];
export function setSkinNatural(w: number, h: number): void {
  if (w > 0 && h > 0) skinNatural = [w, h];
}
export function getSkinNatural(): [number, number] {
  return skinNatural;
}

/** The wallpaper's default drawn size: the image at its own pixels, but shrunk
 *  to fit inside the 640×480 frame if it's larger (aspect kept, never upscaled)
 *  — exactly what the exporter's fitPng() ships to the console. */
export function skinDefaultSize(natural: [number, number]): [number, number] {
  const [nw, nh] = natural;
  if (!(nw > 0) || !(nh > 0)) return [FRAMEBUFFER.w, FRAMEBUFFER.h];
  const s = Math.min(FRAMEBUFFER.w / nw, FRAMEBUFFER.h / nh, 1);
  return [Math.max(1, Math.round(nw * s)), Math.max(1, Math.round(nh * s))];
}

/** Keep a wallpaper rect finite and within sane bounds. A runaway drag (or a
 *  corrupt project) must never make the on-canvas <img> so large the renderer's
 *  compositor drops it — that shows as a blank screen with no error. */
const SKIN_MAX_PX = 5120; // generous, still well under any GPU texture limit
export function clampSkinRect(ox: number, oy: number, w: number, h: number): Rect {
  const fin = (n: number, d: number) => (Number.isFinite(n) ? n : d);
  const cw = Math.min(SKIN_MAX_PX, Math.max(1, Math.round(fin(w, FRAMEBUFFER.w))));
  const ch = Math.min(SKIN_MAX_PX, Math.max(1, Math.round(fin(h, FRAMEBUFFER.h))));
  // let it pan off-frame by up to its own size, no further
  const cx = Math.max(-cw, Math.min(FRAMEBUFFER.w, Math.round(fin(ox, 0))));
  const cy = Math.max(-ch, Math.min(FRAMEBUFFER.h, Math.round(fin(oy, 0))));
  return [cx, cy, cw, ch];
}

export function skinRectOf(page: Page, natural: [number, number]): Rect {
  // no skinSize set → the image's own (fit-to-frame) size at the top-left; the
  // author drags / resizes from there. "Fill screen" stretches it to 640×480.
  const [w, h] = page.skinSize ?? skinDefaultSize(natural);
  return clampSkinRect(page.skinOffset?.[0] ?? 0, page.skinOffset?.[1] ?? 0, w, h);
}

// -------- rect get/set for any draggable box on the canvas --------

export function rectOf(layout: MenuLayout, id: string): Rect | undefined {
  const page = activePage(layout);
  if (!page) return undefined;
  if (id === SKIN_LAYER_ID) return skinRectOf(page, skinNatural);
  return elementById(page, id)?.rect;
}

export function setRectOf(layout: MenuLayout, id: string, rect: Rect): void {
  const page = activePage(layout);
  if (!page) return;
  if (id === SKIN_LAYER_ID) {
    const [ox, oy, w, h] = clampSkinRect(rect[0], rect[1], rect[2], rect[3]);
    page.skinOffset = [ox, oy];
    page.skinSize = [w, h];
    return;
  }
  const el = elementById(page, id);
  if (el) el.rect = rect;
}

// -------- elements --------

const STEM: Record<ElementType, string> = {
  gameList: 'games',
  boxArt: 'cover',
  infoPanel: 'info',
  text: 'text',
  image: 'image',
  button: 'button',
  panel: 'panel',
  setting: 'setting',
  fileList: 'files',
};

export function elementOf(layout: MenuLayout, id: string): Element | undefined {
  const page = activePage(layout);
  return page ? elementById(page, id) : undefined;
}

export function addElement(type: ElementType): void {
  const layout = getState().project?.layout;
  const page = activePage(layout);
  if (!page || page.elements.length >= PAGE_ELEMENT_LIMIT) return;
  const existing = new Set(page.elements.map((e) => e.id));
  const stem = STEM[type];
  let id = stem;
  let n = 1;
  while (existing.has(id)) id = `${stem}${++n}`;
  updateLayout((l) => {
    const p = l.pages.find((x) => x.id === page.id)!;
    const el = newElement(type, id);
    // Nudge off anything that shares the same top-left so a second element of a
    // type is visibly on top of the first, not hidden exactly behind it.
    let guard = 0;
    while (
      guard++ < 20 &&
      p.elements.some((o) => o.rect[0] === el.rect[0] && o.rect[1] === el.rect[1])
    ) {
      el.rect = [
        Math.min(el.rect[0] + 16, FRAMEBUFFER.w - el.rect[2]),
        Math.min(el.rect[1] + 16, FRAMEBUFFER.h - el.rect[3]),
        el.rect[2],
        el.rect[3],
      ];
    }
    el.z = p.elements.length;
    p.elements.push(el);
  });
  select([id]);
}

export function patchElement(id: string, mut: (e: Element) => void): void {
  const pageId = activePageId();
  updateLayout((l) => {
    const e = l.pages.find((p) => p.id === pageId)?.elements.find((x) => x.id === id);
    if (e) mut(e);
  });
}

export function deleteSelected(): void {
  const sel = getState().design.selected.filter((id) => id !== SKIN_LAYER_ID);
  if (sel.length === 0) return;
  const pageId = activePageId();
  updateLayout((l) => {
    const p = l.pages.find((x) => x.id === pageId);
    if (!p) return;
    p.elements = p.elements.filter((e) => !sel.includes(e.id));
    p.elements.forEach((e, i) => (e.z = i));
  });
  select([]);
}

export function selectAll(): void {
  const page = activePage(getState().project?.layout);
  if (!page) return;
  select(page.elements.map((e) => e.id));
}

// -------- clipboard (in-memory; survives page/project switches this session) --------

let clipboard: Element[] = [];

export function copySelection(): void {
  const layout = getState().project?.layout;
  const page = activePage(layout);
  if (!page) return;
  const sel = new Set(getState().design.selected);
  const picked = page.elements.filter((e) => sel.has(e.id));
  if (picked.length) clipboard = structuredClone(picked);
}

export function cutSelection(): void {
  copySelection();
  deleteSelected();
}

export function pasteClipboard(): void {
  if (clipboard.length === 0) return;
  const layout = getState().project?.layout;
  const page = activePage(layout);
  if (!page) return;
  const pageId = page.id;
  const existing = new Set(page.elements.map((e) => e.id));
  const room = PAGE_ELEMENT_LIMIT - page.elements.length;
  const items = clipboard.slice(0, Math.max(0, room));
  const newIds: string[] = [];
  updateLayout((l) => {
    const p = l.pages.find((x) => x.id === pageId)!;
    for (const src of items) {
      const stem = src.id.replace(/-?\d+$/, '') || STEM[src.type];
      let id = `${stem}-copy`;
      let n = 1;
      while (existing.has(id)) id = `${stem}-copy${++n}`;
      existing.add(id);
      const clone = structuredClone(src);
      clone.id = id;
      clone.rect = [clone.rect[0] + 12, clone.rect[1] + 12, clone.rect[2], clone.rect[3]];
      clone.z = p.elements.length;
      p.elements.push(clone);
      newIds.push(id);
    }
  });
  select(newIds);
}

/** Move an element one step in the paint order (array position == z). */
export function bumpZ(id: string, dir: 1 | -1): void {
  const pageId = activePageId();
  updateLayout((l) => {
    const p = l.pages.find((x) => x.id === pageId);
    if (!p) return;
    const i = p.elements.findIndex((e) => e.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= p.elements.length) return;
    const tmp = p.elements[i]!;
    p.elements[i] = p.elements[j]!;
    p.elements[j] = tmp;
    p.elements.forEach((e, k) => (e.z = k));
  });
}
