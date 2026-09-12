import { getState, setState } from '../store.ts';
import {
  defaultMenuLayout,
  newPage,
  startPage,
  PAGE_LIMIT,
  type MenuLayout,
  type Page,
  type Element,
} from '../../shared/menu-schema.ts';
import { matchTemplateId, templateLayout } from './templates/index.ts';

/** Make sure the project has a layout, and that design.page points at a real
 *  page in it (called when the Design tab opens). */
export function ensureLayout(): MenuLayout {
  const p = getState().project;
  if (!p) return defaultMenuLayout();
  let layout = p.layout;
  if (!layout) {
    layout = defaultMenuLayout();
    setState({ project: { ...p, layout }, dirty: true });
  }
  if (!layout.pages.some((pg) => pg.id === getState().design.page)) {
    setDesign({ page: startPage(layout).id, selected: [] });
  }
  return layout;
}

/** Replace the whole layout with a ready-made template (see design/templates/).
 *  Undoable (Ctrl+Z), like the toolbar's Reset. */
export function applyTemplate(id: string): void {
  const d = templateLayout(id);
  updateLayout((l) => {
    l.format = d.format;
    l.pages = d.pages;
    if (d.buttons) l.buttons = d.buttons;
    else delete l.buttons;
    if (d.overscan != null) l.overscan = d.overscan;
    else delete l.overscan;
  });
  const l = getState().project?.layout;
  setDesign({ page: l ? startPage(l).id : 'page1', selected: [], template: id });
}

/** Replace the whole layout with the built-in default (or whichever template was
 *  last applied). Undoable (Ctrl+Z). */
export function resetLayout(): void {
  applyTemplate(getState().design.template || 'grand-tour');
}

// -------- undo / redo (bounded) --------

const UNDO_MAX = 100;
let undoStack: MenuLayout[] = [];
let redoStack: MenuLayout[] = [];

function snapshot(): MenuLayout | null {
  return getState().project?.layout ? structuredClone(getState().project!.layout!) : null;
}

export function updateLayout(mut: (l: MenuLayout) => void, opts: { coalesce?: boolean } = {}): void {
  const p = getState().project;
  if (!p) return;
  const before = p.layout ?? defaultMenuLayout();
  if (!opts.coalesce || undoStack.length === 0) {
    undoStack.push(structuredClone(before));
    if (undoStack.length > UNDO_MAX) undoStack.shift();
  }
  redoStack = [];
  const next = structuredClone(before);
  mut(next);
  setState({ project: { ...p, layout: next }, dirty: true });
}

export function undo(): void {
  const cur = snapshot();
  const prev = undoStack.pop();
  if (!prev || !cur) return;
  redoStack.push(cur);
  const p = getState().project!;
  setState({ project: { ...p, layout: prev }, dirty: true });
  setDesign({ template: matchTemplateId(prev) });
  reconcilePage();
}

export function redo(): void {
  const cur = snapshot();
  const next = redoStack.pop();
  if (!next || !cur) return;
  undoStack.push(cur);
  const p = getState().project!;
  setState({ project: { ...p, layout: next }, dirty: true });
  setDesign({ template: matchTemplateId(next) });
  reconcilePage();
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}
export function canRedo(): boolean {
  return redoStack.length > 0;
}
export function resetHistory(): void {
  undoStack = [];
  redoStack = [];
}

// -------- design sub-state --------

export function setDesign(patch: Partial<ReturnType<typeof getState>['design']>): void {
  setState((s) => ({ design: { ...s.design, ...patch } }));
}

export function select(ids: string[]): void {
  setDesign({ selected: ids });
}

/** If the active page id no longer exists, jump to the start page. */
function reconcilePage(): void {
  const l = getState().project?.layout;
  if (!l) return;
  if (!l.pages.some((p) => p.id === getState().design.page)) {
    setDesign({ page: startPage(l).id, selected: [] });
  }
}

// -------- pages --------

export function pageIds(layout: MenuLayout | null | undefined): string[] {
  return (layout?.pages ?? []).map((p) => p.id);
}

export function currentPageObj(layout: MenuLayout | null | undefined, id: string): Page | undefined {
  return layout?.pages.find((p) => p.id === id);
}

export function currentElements(layout: MenuLayout | null | undefined, id: string): Element[] {
  return currentPageObj(layout, id)?.elements ?? [];
}

export function setDesignPage(pageId: string): void {
  setDesign({ page: pageId, selected: [] });
}

export function normalizePageId(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
}

export function addPage(): string | null {
  const layout = ensureLayout();
  if (layout.pages.length >= PAGE_LIMIT) return null;
  const page = newPage(layout.pages.map((p) => p.id));
  updateLayout((l) => {
    l.pages.push(page);
  });
  setDesignPage(page.id);
  return page.id;
}

/** Copy a page (elements, background, hint — everything) in as the next tab. */
export function duplicatePage(id: string): string | null {
  const layout = getState().project?.layout;
  if (!layout) return null;
  const src = layout.pages.find((p) => p.id === id);
  if (!src || layout.pages.length >= PAGE_LIMIT) return null;

  const taken = new Set(layout.pages.map((p) => p.id));
  const stem = src.id.replace(/-copy\d*$/, '');
  let newId = `${stem}-copy`;
  for (let n = 2; taken.has(newId); n++) newId = `${stem}-copy${n}`;

  const clone: Page = structuredClone(src);
  clone.id = newId;
  clone.title = /\bcopy$/i.test(src.title) ? src.title : `${src.title} copy`;
  delete clone.start; // only the original stays the boot screen

  updateLayout((l) => {
    const at = l.pages.findIndex((p) => p.id === id);
    l.pages.splice(at < 0 ? l.pages.length : at + 1, 0, clone);
  });
  setDesignPage(newId);
  return newId;
}

export function deletePage(id: string): void {
  updateLayout((l) => {
    if (l.pages.length <= 1) return;
    const wasStart = l.pages.find((p) => p.id === id)?.start;
    l.pages = l.pages.filter((p) => p.id !== id);
    if (wasStart && !l.pages.some((p) => p.start)) {
      l.pages[0]!.start = true;
    }
  });
  reconcilePage();
}

/** Move a page to a new index (drag-reorder). Tab order = console navigation order. */
export function reorderPages(fromIndex: number, toIndex: number): void {
  updateLayout((l) => {
    if (fromIndex < 0 || fromIndex >= l.pages.length) return;
    const clamped = Math.max(0, Math.min(l.pages.length - 1, toIndex));
    const [moved] = l.pages.splice(fromIndex, 1);
    l.pages.splice(clamped, 0, moved!);
  });
}

/** Set the boot screen — the `start` page, independent of tab order. */
export function setStartPage(id: string): void {
  updateLayout((l) => {
    for (const p of l.pages) {
      if (p.id === id) p.start = true;
      else delete p.start;
    }
  });
}

/** Point the Design tab at a just-loaded project: jump to its start screen,
 *  drop any stale selection, and clear undo history. Call after New / Open /
 *  Import, where `design.page` may still name a screen from the old project. */
export function syncDesignToProject(): void {
  const layout = ensureLayout();
  resetHistory();
  setDesign({
    page: startPage(layout).id,
    selected: [],
    skinEdit: false,
    template: matchTemplateId(layout),
  });
}

export function patchPage(id: string, mut: (p: Page) => void): void {
  updateLayout((l) => {
    const pg = l.pages.find((p) => p.id === id);
    if (pg) mut(pg);
  });
}

/** Rename a page and repoint every `goto` action that referenced it. */
export function renamePage(oldId: string, rawNew: string): void {
  const next = normalizePageId(rawNew);
  if (!next) return;
  const layout = getState().project?.layout;
  if (!layout || layout.pages.some((p) => p.id === next)) return;
  updateLayout((l) => {
    const pg = l.pages.find((p) => p.id === oldId);
    if (!pg) return;
    pg.id = next;
    for (const p of l.pages)
      for (const e of p.elements)
        if (e.type === 'button' && e.action.kind === 'goto' && e.action.page === oldId)
          e.action.page = next;
  });
  if (getState().design.page === oldId) setDesignPage(next);
}
