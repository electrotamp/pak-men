/** Warnings/errors for a HomeLayout, surfaced in the Design tab and the export dialog. */

import {
  FRAMEBUFFER,
  CHROME_LIMIT,
  GRID_MAX_TILES,
  HOME_PAGE_ID,
  BROWSER_PAGE_ID,
  SLOT_META,
  isSlotRemoved,
  type HomeLayout,
  type Rect,
  type SlotId,
  type Widget,
} from './layout-schema.ts';
import { validateMenuText } from './validate.ts';

export interface LayoutIssue {
  level: 'error' | 'warn';
  slot?: SlotId;
  /** Set for issues that belong to a custom page rather than the home screen. */
  page?: string;
  message: string;
}

const PAGE_ID_RE = /^[a-z0-9_-]+$/;

const inside = (r: Rect) =>
  r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= FRAMEBUFFER.w && r[1] + r[3] <= FRAMEBUFFER.h;

export function validateLayout(layout: HomeLayout): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const push = (level: LayoutIssue['level'], message: string, slot?: SlotId) =>
    issues.push({ level, message, slot });

  // A deleted slot isn't drawn, so its geometry/text can't cause trouble — skip it.
  const live = (id: SlotId) => !isSlotRemoved(layout, id);

  for (const meta of SLOT_META) {
    if (!live(meta.id)) continue;
    const slot = layout.slots[meta.id] as { rect: Rect };
    const r = slot.rect;
    if (r[2] <= 0 || r[3] <= 0) push('error', `${meta.label}: width and height must be positive`, meta.id);
    else if (!inside(r)) push('warn', `${meta.label} extends outside the 640×480 screen`, meta.id);
  }

  // text content
  for (const id of ['header', 'actionBar'] as const) {
    if (!live(id)) continue;
    const t = validateMenuText(layout.slots[id].text);
    if (t) push('error', `${id === 'header' ? 'Header' : 'Action bar'} text: ${t}`, id);
  }
  for (const id of ['platGames', 'platPreview', 'platInfo'] as const) {
    if (!live(id)) continue;
    const p = layout.slots[id];
    for (const s of [p.label, p.labelFav, p.labelAll]) {
      if (s == null) continue;
      const e = validateMenuText(s);
      if (e) push('error', `${id} label: ${e}`, id);
    }
  }
  if (live('info')) {
    for (const [i, lbl] of layout.slots.info.labels.entries()) {
      const e = validateMenuText(lbl);
      if (e) push('error', `Info label ${i + 1} ("${lbl}"): ${e}`, 'info');
    }
  }

  // list geometry — row count is derived from height/rowH (see listRows()), so
  // there's no separate "rows" field left to validate, just what feeds it.
  const list = layout.slots.list;
  if (!live('list')) {
    // nothing to check
  } else if (list.style === 'grid') {
    const cols = list.gridCols ?? 4, rows = list.gridRows ?? 3;
    if (cols < 1 || rows < 1) push('error', 'Game grid: columns and rows must be at least 1', 'list');
    else if (cols * rows > GRID_MAX_TILES)
      push(
        'error',
        `Game grid: ${cols}×${rows} = ${cols * rows} tiles exceeds the ${GRID_MAX_TILES}-tile limit — the firmware will shrink it`,
        'list',
      );
  } else {
    if (list.rowH < 1) push('error', 'Game list: row height must be at least 1', 'list');
    else if (list.rect[3] < list.rowH)
      push('warn', `Game list: box is shorter than one row (${list.rect[3]}px < ${list.rowH}px) — nothing will show`, 'list');
    if (list.textPadL + list.textPadR >= list.rect[2])
      push(
        'error',
        `Game list: padding (${list.textPadL} + ${list.textPadR}) leaves no room for names in a ${list.rect[2]}px list`,
        'list',
      );
  }

  // info geometry — the value column is [rect.x + labelW .. rect.x + rect.w], so a
  // labelW at or past the panel's right edge leaves it nothing to draw into
  if (live('info')) {
    const infoValueW = layout.slots.info.rect[2] - layout.slots.info.labelW;
    if (infoValueW <= 0)
      push(
        'error',
        `Information panel: the label column (${layout.slots.info.labelW}px) fills the whole ${layout.slots.info.rect[2]}px panel, leaving no room for values`,
        'info',
      );
    else if (infoValueW < 24)
      push('warn', `Information panel: only ${infoValueW}px left for values`, 'info');
  }

  // clock format sanity
  if (live('clock') && !/%[YmdHMS]/.test(layout.slots.clock.format))
    push('warn', 'Clock: format has no %Y/%m/%d/%H/%M — it will render literally', 'clock');

  // colors
  const hexRe = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
  for (const [k, v] of Object.entries(layout.colors)) {
    if (!hexRe.test(v)) push('error', `Color "${k}" must be #RRGGBB or #RRGGBBAA (got "${v}")`);
  }
  if (layout.theme) {
    for (const [k, v] of Object.entries(layout.theme)) {
      if (typeof v !== 'string' || !hexRe.test(v))
        push('error', `Theme colour "${k}" must be #RRGGBB or #RRGGBBAA (got "${String(v)}")`);
    }
  }

  // ---- skin layer ----
  if (layout.skinSize) {
    const [sw, sh] = layout.skinSize;
    if (!(sw > 0) || !(sh > 0)) push('error', 'Skin size: width and height must be positive');
    else if (
      layout.skinOffset[0] + sw <= 0 ||
      layout.skinOffset[1] + sh <= 0 ||
      layout.skinOffset[0] >= FRAMEBUFFER.w ||
      layout.skinOffset[1] >= FRAMEBUFFER.h
    )
      push('warn', 'Skin image sits entirely off-screen');
  }

  // ---- fallback chrome ----
  if (layout.chrome) {
    if (layout.chrome.length > CHROME_LIMIT)
      push('error', `Chrome has ${layout.chrome.length} panels; the firmware keeps the first ${CHROME_LIMIT}`);
    const seenChrome = new Set<string>();
    for (const c of layout.chrome) {
      const name = c.label || c.id;
      if (seenChrome.has(c.id)) push('error', `Duplicate chrome panel id "${c.id}"`);
      seenChrome.add(c.id);
      if (c.rect[2] <= 0 || c.rect[3] <= 0)
        push('error', `Panel "${name}": width and height must be positive — it will be skipped`);
      else if (!inside(c.rect)) push('warn', `Panel "${name}" extends outside the 640×480 screen`);
      for (const [what, v] of [
        ['fill', c.color],
        ['outline', c.border],
      ] as const) {
        if (v == null || v === 'panel' || v === 'plate') continue;
        if (!hexRe.test(v))
          push('error', `Panel "${name}" ${what} must be "panel", "plate", #RRGGBB or #RRGGBBAA (got "${v}")`);
      }
      if ((c.borderW ?? 0) > 0 && !c.border)
        push('warn', `Panel "${name}" has an outline thickness but no outline colour`);
    }
    if (layout.chrome.length === 0 && !layout.skin)
      push('warn', 'No chrome panels and no skin — the home screen will draw on a bare background');
  }

  // ---- custom pages ----
  const pageIds = new Set<string>([HOME_PAGE_ID]);
  const seen = new Set<string>();
  const hex = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
  const inFb = (r: Rect) =>
    r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= FRAMEBUFFER.w && r[1] + r[3] <= FRAMEBUFFER.h;

  for (const pg of layout.pages ?? []) {
    const at = (level: LayoutIssue['level'], message: string) => issues.push({ level, message, page: pg.id });
    if (!pg.id || !PAGE_ID_RE.test(pg.id))
      at('error', `Page id "${pg.id}" must be lowercase letters, digits, "-" or "_"`);
    if (pg.id === HOME_PAGE_ID) at('error', `"home" is reserved for the list screen`);
    if (seen.has(pg.id)) at('error', `Duplicate page id "${pg.id}"`);
    seen.add(pg.id);
    pageIds.add(pg.id);
    if (pg.id === BROWSER_PAGE_ID) {
      // Marker page — the firmware never renders any of this, so anything set
      // here (likely from hand-editing home.json, or importing one) is silently
      // ignored on the console. Flag it rather than let it look configured.
      if (pg.title || pg.skin || pg.background || pg.hint || pg.widgets.length > 0)
        at('warn', `Page "browser" is the reserved file-browser marker — its title, background, hint and widgets are all ignored`);
      continue;
    }
    if (pg.background && !hex.test(pg.background))
      at('error', `Background must be #RRGGBB or #RRGGBBAA (got "${pg.background}")`);
    if (pg.hint) {
      const e = validateMenuText(pg.hint);
      if (e) at('error', `Hint bar: ${e}`);
    }
    for (const w of pg.widgets) {
      if (w.rect[2] <= 0 || w.rect[3] <= 0) at('error', `Widget "${w.id}": width and height must be positive`);
      else if (!inFb(w.rect)) at('warn', `Widget "${w.id}" extends outside the 640×480 screen`);
      widgetText(w, (m) => at('error', m));
    }
  }

  // goto targets across the home screen and every page
  const checkGoto = (widgets: Widget[] | undefined, where: (m: string) => void) => {
    for (const w of widgets ?? []) {
      if (w.type === 'button' && w.action.kind === 'goto') {
        const t = w.action.page;
        if (!t || !pageIds.has(t)) where(`Button "${w.id}" goes to unknown page "${t ?? ''}"`);
      }
    }
  };
  checkGoto(layout.widgets, (m) => push('warn', m));
  for (const pg of layout.pages ?? [])
    checkGoto(pg.widgets, (m) => issues.push({ level: 'warn', message: m, page: pg.id }));

  return issues;
}

/** validateMenuText over a widget's user-facing strings. */
function widgetText(w: Widget, err: (m: string) => void): void {
  if (w.type === 'text') {
    const e = validateMenuText(w.text);
    if (e) err(`Widget "${w.id}" text: ${e}`);
  } else if (w.type === 'button') {
    const e = validateMenuText(w.label);
    if (e) err(`Widget "${w.id}" label: ${e}`);
  }
}
