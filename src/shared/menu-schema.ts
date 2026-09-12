/**
 * menu-schema.ts — the rebuilt layout model (M3).
 *
 * One ordered list of pages, no special "home". Every page carries one flat
 * `elements[]` array; any element type can appear on any page, any number of
 * times. Exactly one page is the `start` screen (the console boots there),
 * independent of tab order.
 *
 * This is the shape written to `menu/n64ever/ui/menu.json` (format 2). The
 * firmware parser doesn't read format 2 yet — that lands in a later M3 step.
 * `fromMenuJson()` still reads a format-1 `home.json` and migrates it, so old
 * SD cards import cleanly.
 *
 * Shared primitives (Rect, Align, Fit, Corner, Action, ThemeColors, …) come
 * from layout-schema.ts so the two models don't drift while both exist.
 */

import defaultMenuData from './data/default-menu.json' with { type: 'json' };
import { normalizeButtonMap, PHYS_INPUTS, type ButtonMap } from './input-map.ts';
import {
  ALL_CORNERS,
  BUTTON_SHAPES,
  cornerRadiusCss,
  effectiveChrome,
  FRAMEBUFFER,
  type Action,
  type ActionKind,
  type Align,
  type ButtonShape,
  type ChromePanel,
  type Corner,
  type Fit,
  type HomeLayout,
  type Rect,
  type Widget,
} from './layout-schema.ts';

export {
  ALL_CORNERS,
  BUTTON_SHAPES,
  cornerRadiusCss,
  FRAMEBUFFER,
  type Action,
  type ActionKind,
  type Align,
  type ButtonShape,
  type ButtonMap,
  type Corner,
  type Fit,
  type Rect,
};

/** legacy format-1 fill tokens — 'panel'/'plate' now resolve to these fixed
 *  hexes at import time; the model itself has no shared tokens any more. */
const LEGACY_PANEL = '#0C122C';
const LEGACY_PLATE = '#5A5FB0';

/** Resolve a possibly-legacy colour ('panel'/'plate'/hex/undefined) to a hex. */
export function resolveColor(c: string | undefined, tokens?: { panel: string; plate: string }): string {
  if (!c) return '#00000000';
  if (c === 'panel') return tokens?.panel ?? LEGACY_PANEL;
  if (c === 'plate') return tokens?.plate ?? LEGACY_PLATE;
  return c;
}

export const MENU_FORMAT = 2;

// Must match the firmware's MC_MAX_PAGES / MC_MAX_ELEMENTS (menu_config.h) —
// the console pre-allocates a fixed slot per page/element and a 4 MB N64 can't
// spare a megabyte of config for slots nobody uses.
export const PAGE_LIMIT = 16;
export const PAGE_ELEMENT_LIMIT = 40;
/** page id / used by "go to page" actions */
export const PAGE_ID_RE = /^[a-z0-9_-]{1,24}$/;

export type ElementType =
  | 'gameList'
  | 'boxArt'
  | 'infoPanel'
  | 'text'
  | 'image'
  | 'button'
  | 'panel'
  | 'setting'
  | 'fileList';

export const ELEMENT_TYPES: ElementType[] = [
  'gameList',
  'boxArt',
  'infoPanel',
  'text',
  'image',
  'button',
  'panel',
  'setting',
  'fileList',
];

/** Firmware bool settings a Setting element can bind to (mirrors gm_bool_setting). */
export const SETTING_KEYS = [
  'bgm_enabled',
  'soundfx_enabled',
  'rumble_enabled',
  'pal60_enabled',
  'force_progressive_scan',
  'use_custom_files',
  'always_sort_az',
  'use_legacy_font',
  'screensaver_favorites_only',
  'rom_boot_enabled',
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];
export const SETTING_LABEL: Record<SettingKey, string> = {
  bgm_enabled: 'Background music',
  soundfx_enabled: 'Sound effects',
  rumble_enabled: 'Rumble Pak',
  pal60_enabled: 'PAL 60 Hz',
  force_progressive_scan: 'Progressive scan (240p)',
  use_custom_files: 'Custom metadata / art',
  always_sort_az: 'Always sort games A–Z',
  use_legacy_font: 'Legacy font',
  screensaver_favorites_only: 'Screensaver: favourites only',
  rom_boot_enabled: 'Direct ROM boot',
};

/** The shaped box any element can sit in. Omit `fill` for no background. */
export type Shape =
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'octagon';
export const SHAPES: Shape[] = [
  'rect',
  'circle',
  'ellipse',
  'triangle',
  'diamond',
  'pentagon',
  'hexagon',
  'octagon',
];
export const SHAPE_LABEL: Record<Shape, string> = {
  rect: 'Rectangle',
  circle: 'Circle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  diamond: 'Diamond',
  pentagon: 'Pentagon',
  hexagon: 'Hexagon',
  octagon: 'Octagon',
};

/** The width/height these shapes read best at — a regular polygon or a circle
 *  looks wrong squashed, so the editor squares the box on shape change and
 *  Shift-resize locks to it. `undefined` = free aspect (rect / ellipse / triangle). */
export function shapeAspect(shape: Shape | undefined): number | undefined {
  return shape === 'circle' ||
    shape === 'diamond' ||
    shape === 'pentagon' ||
    shape === 'hexagon' ||
    shape === 'octagon'
    ? 1
    : undefined;
}

/** Where the outline sits relative to the shape edge. */
export type BorderAlign = 'inside' | 'outside' | 'center';
export const BORDER_ALIGNS: BorderAlign[] = ['inside', 'outside', 'center'];
export const BORDER_ALIGN_LABEL: Record<BorderAlign, string> = {
  inside: 'Inside',
  outside: 'Outside',
  center: 'Centred',
};

export interface BoxStyle {
  /** default 'rect' */
  shape?: Shape;
  /** `#RRGGBB[AA]` — omit for a transparent box (no background) */
  fill?: string;
  border?: string;
  borderW?: number;
  /** where the outline sits relative to the shape edge — 'inside' (default,
   *  the outline is drawn within the box), 'outside' (added around it), or
   *  'center' (straddling the edge). */
  borderAlign?: BorderAlign;
  /** corner rounding in px — rounds a rect's corners or any polygon's vertices */
  cornerRadius?: number;
  corners?: Corner[];
}

/** vertical placement of content inside an element's box */
export type VAlign = 'top' | 'middle' | 'bottom';

/** The 22 bundled display fonts (filename stems, without .font64). "" = the
 *  menu's default UI font. Real list is data-driven from assets/fonts/. */
export const MENU_FONTS: string[] = [
  'Emulogic-zrEw',
  'Foneitwu-1jEOg',
  'Foneitwu-R9yOW',
  'GamePlayed-vYL7',
  'GamecubenDualset-L85D',
  'KidpixiesRegular-p0Z1',
  'MarioAndLuigi-0v99',
  'MushroomKingdomNbpRegular-RGGA',
  'Nes2Regular-yxyd',
  'PixelEmulator-xq08',
  'PolygonParty-3KXM',
  'PressStart2P-vaV7',
  'RoBlueShellBold-gxn35',
  'RoSpritendoSemiboldBeta-vmVwZ',
  'SuperMario286-18qg',
  'SuperMarioBros-ov7d',
  'SuperMarioBrothers-4nmp',
  'TheWildBreathOfZelda-15Lv',
  'Triforce-y07d',
  'TypefaceMario64-ywA93',
  'TypefaceMarioWorldPixelFilledRegular-Yz84q',
  'TypefaceMarioWorldPixelFilledRegular-rgVMx',
];

/** Baked bitmap size of each font: 16 for the display fonts, 12 for the built-in
 *  UI font ("" / undefined). A bitmap font is only sharp at this size and whole
 *  multiples of it, so the editor's size control offers only those. */
export const BUILTIN_FONT_PX = 12;
export const DISPLAY_FONT_PX = 16;
export const SHARP_FONT_MULTIPLES = [1, 2, 3];

export function nativeFontPx(font: string | undefined): number {
  return font ? DISPLAY_FONT_PX : BUILTIN_FONT_PX;
}
export function sharpFontSizes(font: string | undefined): number[] {
  const n = nativeFontPx(font);
  return SHARP_FONT_MULTIPLES.map((m) => n * m);
}
export function snapFontSize(px: number, font: string | undefined): number {
  const sizes = sharpFontSizes(font);
  return sizes.reduce((best, s) => (Math.abs(s - px) < Math.abs(best - px) ? s : best), sizes[0]!);
}

/** Overscan compensation. A CRT hides a slice around every edge; how much varies
 *  by set. `menu.overscan` is a fine-tune in whole units: 0 = the full frame,
 *  drawn 1:1 (so bitmap text stays pixel-exact); each +1 shrinks the whole menu
 *  1% toward screen centre for a set that crops harder than the safe-area guide.
 *  It is a display-time scale only — every element's authored rect / fontSize is
 *  left exactly as designed. Applied by the canvas preview and, on export, by
 *  the console at menu-config load. The safe-area *guide* (a fixed ~32/24px
 *  inset, matching the firmware's OVERSCAN_WIDTH/HEIGHT) is advisory only. */
export const OVERSCAN_BASE_SCALE = 1.0;
export const OVERSCAN_UNIT = 0.01;
export const OVERSCAN_UNITS_MIN = 0;
export const OVERSCAN_UNITS_MAX = 30;

export function clampOverscanUnits(units: number | undefined): number {
  const u = Math.round(Number.isFinite(units) ? (units as number) : 0);
  return Math.max(OVERSCAN_UNITS_MIN, Math.min(OVERSCAN_UNITS_MAX, u));
}
/** The uniform scale (about screen centre) for a given compensation value. */
export function overscanScale(units: number | undefined): number {
  return Math.max(0.7, Math.min(1, OVERSCAN_BASE_SCALE - clampOverscanUnits(units) * OVERSCAN_UNIT));
}

/** Text styling shared by Text, Panel and Button. `font` is a MENU_FONTS stem
 *  or "" for the default; `rotation` is degrees relative to the box (0 follows
 *  the box); `keepUpright` overrides that to always draw screen-horizontal. */
export interface TextStyle {
  color: string;
  align: Align;
  valign: VAlign;
  wrap: boolean;
  pad?: Pad;
  font?: string;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textRotation?: number;
  keepUpright?: boolean;
}

interface ElementBase {
  /** unique within the page. [a-z0-9_-] */
  id: string;
  type: ElementType;
  rect: Rect;
  /** paint order within the page, low first */
  z: number;
  /** when true, resizing preserves the box's width:height ratio — set by
   *  default on box art and the grid so covers never stretch. */
  aspectLock?: boolean;
  /** clockwise rotation in degrees about the element's centre. Not used by
   *  gameList / infoPanel (they always render upright). */
  rotation?: number;
  /** optional shaped background behind the element's content */
  box?: BoxStyle;
}

export type GameSource = 'all' | 'favorites' | 'history';
export type ListStyle = 'list' | 'grid';
/** cols*rows cap — mirrors the firmware's MC_GRID_MAX_TILES */
export const GRID_MAX_TILES = 24;

export interface GameListElement extends ElementBase {
  type: 'gameList';
  /** every game on the card, or only the ones favourited on the console */
  source: GameSource;
  /** when source is 'favorites': a named collection, or '' for all favourites */
  collection?: string;
  style: ListStyle;
  rowH: number;
  textPadL: number;
  textPadR: number;
  textDy: number;
  gridCols?: number;
  gridRows?: number;
  /** px between grid tiles (0 = touching). grid style only. */
  gridGap?: number;
  /** grid style: show each tile's game name. Default off = art-only tiles, today's exact geometry. */
  gridLabels?: boolean;
  /** where the name sits relative to the cover art. Default 'bottom'. */
  gridLabelPos?: 'top' | 'bottom' | 'overlay';
  /** true = wrap the name to two lines; false = single line, marquee-scroll if it overflows. Default true. */
  gridLabelWrap?: boolean;
  highlight: string;
  textColor: string;
}

/** Reserved band height (in 640×480 layout px) for a grid tile's name label,
 *  when shown outside the art (top/bottom). Mirrors the firmware. */
export const GRID_LABEL_BAND = 24;

/** Extra per-row height a grid tile reserves for its name — 0 unless labels are
 *  on and sit outside the art. */
export function gridLabelBand(el: Pick<GameListElement, 'gridLabels' | 'gridLabelPos'>): number {
  return el.gridLabels && (el.gridLabelPos ?? 'bottom') !== 'overlay' ? GRID_LABEL_BAND : 0;
}

/** Height a grid Game List needs so every tile is exactly box-art shaped:
 *  cols×rows of (tileW / BOXART_ASPECT + label band) plus the gaps. */
export function gridBoxHeight(w: number, cols: number, rows: number, gap: number, band = 0): number {
  const tileW = (w - (cols - 1) * gap) / Math.max(1, cols);
  return Math.round(rows * (tileW / BOXART_ASPECT + band) + (rows - 1) * gap);
}

/** The bundled art skews landscape (~11:8); box art defaults to that so a cover
 *  fills the frame with no letterboxing. */
export const BOXART_ASPECT = 11 / 8;

export interface BoxArtElement extends ElementBase {
  type: 'boxArt';
  fit: Fit;
  bg: string;
}

export interface InfoPanelElement extends ElementBase {
  type: 'infoPanel';
  rowH: number;
  labelW: number;
  baselineDy: number;
  labels: [string, string, string, string, string];
  labelColor: string;
  valueColor: string;
}

/** Text placement inside the element's box: T/R/B/L padding in px. */
export type Pad = [number, number, number, number];

/** Text and Panel are the same element — a box (optional fill) that may hold
 *  text, positioned freely inside it. "Text" starts with a string and no fill;
 *  "Panel" starts with a fill and no text. Either can become the other. */
export interface TextishBase extends TextStyle {
  text: string;
  /** if set, renders strftime(now) in this format instead of `text` */
  clockFormat?: string;
}

export interface TextElement extends ElementBase, TextishBase {
  type: 'text';
}

export interface PanelElement extends ElementBase, TextishBase {
  type: 'panel';
}

export interface ImageElement extends ElementBase {
  type: 'image';
  /** filename written under menu/n64ever/ui/assets/ */
  src: string;
  /** app-only: absolute host path the file is copied from */
  srcHostPath?: string;
  fit: Fit;
}

export interface ButtonElement extends ElementBase, TextStyle {
  type: 'button';
  /** the button's text (its own field — not `text` — so it never reads as a panel) */
  label: string;
  glyph?: string;
  action: Action;
  focusOrder?: number;
  focusable?: boolean;
}

/** A placeable on/off row bound to a firmware setting — always focusable on the
 *  console; pressing A toggles it and saves. */
export interface SettingElement extends ElementBase, TextStyle {
  type: 'setting';
  /** which firmware bool setting this row controls */
  settingKey: SettingKey;
  /** the row's caption */
  label: string;
  /** value text for each state (default "ON" / "OFF") */
  onText?: string;
  offText?: string;
  /** colour of the value word (falls back to `color`) */
  valueColor?: string;
  focusOrder?: number;
}

/** A placeable SD-card file browser — navigate folders, launch ROMs / disks /
 *  emulator ROMs, open the image / text / music viewers, and (when `manage` is
 *  on) delete / rename / move files. Always focusable on the console. */
export interface FileListElement extends ElementBase {
  type: 'fileList';
  /** the directory it opens in, e.g. "sd:/" or "sd:/ROMS" */
  root: string;
  rowH: number;
  /** draw a file-size column */
  showSize?: boolean;
  /** allow delete / rename / move / extract from the element */
  manage?: boolean;
  /** file-row text */
  fg: string;
  /** directory rows */
  dirColor: string;
  /** ROM / disk rows */
  romColor: string;
  /** selection bar */
  highlight: string;
  /** background behind the rows */
  bg: string;
}

export type Element =
  | GameListElement
  | BoxArtElement
  | InfoPanelElement
  | TextElement
  | ImageElement
  | ButtonElement
  | PanelElement
  | SettingElement
  | FileListElement;

/** Every page is a screen you lay out yourself. (Older files may carry a
 *  `"browser"` / `"favorites"` kind; those are migrated to normal pages on
 *  import — a Browser page becomes a page with a File Browser element.) */
export type PageKind = 'custom';

export interface Page {
  id: string;
  /** tab label; editable */
  title: string;
  kind: PageKind;
  /** exactly one page across the menu has this; that page is the boot screen */
  start?: boolean;
  /** 640x480 background PNG, written next to menu.json */
  skin?: string;
  skinHostPath?: string;
  skinOffset?: [number, number];
  skinSize?: [number, number];
  /** flat background colour when there is no skin */
  background?: string;
  /** bottom hint-bar text; empty = no hint bar */
  hint?: string;
  /** per-page controller remap — a sparse delta over the resolved global map */
  buttons?: ButtonMap;
  elements: Element[];
}

/** Colours for the menu's own pop-ups — the file-browser action menu, the
 *  yes/no prompts, the on-screen keyboard, the copy progress bar. Every key is
 *  optional; an omitted one keeps the firmware's built-in (dark) value. */
export interface PopupTheme {
  popupBg?: string;
  popupBorder?: string;
  popupText?: string;
  highlight?: string;
  progressTrack?: string;
  progressBar?: string;
}
export const POPUP_THEME_KEYS = [
  'popupBg', 'popupBorder', 'popupText', 'highlight', 'progressTrack', 'progressBar',
] as const;

export interface MenuLayout {
  format: typeof MENU_FORMAT;
  /** ordered; exactly one element has start:true */
  pages: Page[];
  /** global controller remap — a sparse delta over the stock map */
  buttons?: ButtonMap;
  /** overscan compensation, in whole fine-tune units (see overscanScale). 0 or
   *  absent = the console safe-area default; omitted from menu.json when 0. */
  overscan?: number;
  /** colours for the menu's own pop-ups (see PopupTheme). Omitted when empty. */
  theme?: PopupTheme;
}

const HEX8 = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
/** Keep only valid hex entries; returns undefined when nothing is left. */
export function cleanPopupTheme(raw: unknown): PopupTheme | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Record<string, unknown>;
  const out: PopupTheme = {};
  for (const k of POPUP_THEME_KEYS) {
    const v = src[k];
    if (typeof v === 'string' && HEX8.test(v.trim())) out[k] = v.trim().toUpperCase();
  }
  return Object.keys(out).length ? out : undefined;
}

// ---------------------------------------------------------------- factories

const TEXT_COLOR = '#E7E9EF';

export function newElement(type: ElementType, id: string): Element {
  const base = { id, z: 0 };
  switch (type) {
    case 'gameList':
      return {
        ...base,
        type,
        rect: [40, 100, 262, 312],
        source: 'all',
        style: 'list',
        rowH: 24,
        textPadL: 10,
        textPadR: 8,
        textDy: 16,
        highlight: '#2C44D8',
        textColor: TEXT_COLOR,
      };
    case 'boxArt':
      return { ...base, type, rect: [346, 100, 248, 180], fit: 'cover', bg: '#000000', aspectLock: true };
    case 'infoPanel':
      return {
        ...base,
        type,
        rect: [338, 328, 262, 84],
        rowH: 20,
        labelW: 100,
        baselineDy: 14,
        labels: ['RELEASED', 'DEVELOPER', '', '', ''],
        labelColor: '#9AA0B3',
        valueColor: TEXT_COLOR,
      };
    case 'image':
      return { ...base, type, rect: [520, 20, 96, 48], src: '', fit: 'contain' };
    case 'button':
      return {
        ...base,
        type,
        rect: [40, 360, 120, 26],
        label: 'Button',
        action: { kind: 'none' },
        color: TEXT_COLOR,
        align: 'center',
        valign: 'middle',
        wrap: false,
        box: { fill: LEGACY_PANEL, border: LEGACY_PLATE, borderW: 2, cornerRadius: 6 },
      };
    case 'panel':
      return {
        ...base,
        type,
        rect: [220, 190, 200, 100],
        text: '',
        color: TEXT_COLOR,
        align: 'center',
        valign: 'middle',
        wrap: true,
        box: { fill: LEGACY_PANEL, cornerRadius: 8 },
      };
    case 'setting':
      return {
        ...base,
        type,
        rect: [40, 360, 264, 30],
        settingKey: 'soundfx_enabled',
        label: SETTING_LABEL.soundfx_enabled,
        color: TEXT_COLOR,
        valueColor: '#5EE6D0',
        align: 'left',
        valign: 'middle',
        wrap: false,
        box: { fill: '#1B2440', border: '#28315A', borderW: 1, cornerRadius: 8 },
      };
    case 'fileList':
      return {
        ...base,
        type,
        rect: [40, 88, 560, 344],
        root: 'sd:/',
        rowH: 22,
        fg: TEXT_COLOR,
        dirColor: '#FFC828',
        romColor: '#3C8CFF',
        highlight: '#2C44D8',
        bg: '#000000',
        box: { fill: '#0C122C', border: '#28315A', borderW: 1, cornerRadius: 8 },
      };
    case 'text':
    default:
      return {
        ...base,
        type: 'text',
        rect: [40, 400, 200, 20],
        text: 'New text',
        color: TEXT_COLOR,
        align: 'left',
        valign: 'bottom',
        wrap: false,
      };
  }
}

let pageSeq = 0;
export function newPage(existing: string[], title?: string): Page {
  const taken = new Set(existing);
  let n = existing.length + 1;
  let id = `page${n}`;
  while (taken.has(id)) id = `page${++n}`;
  pageSeq++;
  return {
    id,
    title: title ?? `Page ${n}`,
    kind: 'custom',
    background: '#0C122C',
    hint: 'A Select     B Back',
    elements: [],
  };
}

/** A normal page carrying one full-screen File Browser element — used only to
 *  migrate a legacy `kind:"browser"` page into the element model. */
export function newFileBrowserPage(existing: string[]): Page {
  const p = newPage(existing, 'Files');
  const fl = newElement('fileList', 'files') as Element & { rect: Rect };
  fl.rect = [24, 64, 592, 372];
  return { ...p, id: taken(existing, 'files'), elements: [fl] };
}
function taken(existing: string[], want: string): string {
  const s = new Set(existing);
  if (!s.has(want)) return want;
  let n = 2;
  while (s.has(`${want}-${n}`)) n++;
  return `${want}-${n}`;
}

// ---------------------------------------------------------------- default

/**
 * A fresh project (also what Reset restores): the showcase menu that ships on
 * the SD card — `docs/examples/menu.json`, bundled via `npm run gen`. Nothing
 * about it is locked; rename / move / delete pages like any layout.
 */
export function defaultMenuLayout(): MenuLayout {
  return normalizeMenu(fromMenuJson(JSON.stringify(defaultMenuData)));
}

// ---------------------------------------------------------------- v1 migration

type Tokens = { panel: string; plate: string };

function chromeToPanel(c: ChromePanel, z: number, tk: Tokens): PanelElement {
  const box: BoxStyle = { fill: resolveColor(c.color, tk) };
  if (c.border && (c.borderW ?? 0) > 0) {
    box.border = resolveColor(c.border, tk);
    box.borderW = c.borderW;
  }
  if ((c.cornerRadius ?? 0) > 0) {
    box.cornerRadius = c.cornerRadius;
    if (c.corners) box.corners = c.corners;
  }
  return {
    id: safeId(c.id, `panel${z}`),
    type: 'panel',
    rect: c.rect,
    z,
    text: '',
    color: TEXT_COLOR,
    align: 'center',
    valign: 'middle',
    wrap: true,
    box,
  };
}

function widgetToElement(w: Widget, z: number, tk: Tokens): Element {
  if (w.type === 'image')
    return { id: safeId(w.id, `img${z}`), type: 'image', rect: w.rect, z, src: w.src, srcHostPath: w.srcHostPath, fit: w.fit };
  if (w.type === 'button') {
    const box: BoxStyle = { fill: resolveColor(w.fill, tk) };
    if (w.border) box.border = resolveColor(w.border, tk);
    if (w.borderW) box.borderW = w.borderW;
    if (w.cornerRadius) box.cornerRadius = w.cornerRadius;
    if (w.shape && w.shape !== 'rect') box.shape = w.shape as Shape;
    return {
      id: safeId(w.id, `btn${z}`),
      type: 'button',
      rect: w.rect,
      z,
      label: w.label,
      glyph: w.glyph,
      action: w.action,
      focusOrder: w.focusOrder,
      focusable: w.focusable,
      color: w.color,
      align: 'center',
      valign: 'middle',
      wrap: false,
      box,
    };
  }
  return {
    id: safeId(w.id, `txt${z}`),
    type: 'text',
    rect: w.rect,
    z,
    text: w.text,
    color: w.color,
    align: w.align,
    valign: 'bottom',
    wrap: w.wrap,
  };
}

/** Turn a format-1 HomeLayout into the page model. The 9 fixed slots + the
 *  fallback chrome + the loose widgets all become elements on one page. */
export function migrateV1(v1: HomeLayout): MenuLayout {
  const tk: Tokens = { panel: v1.colors.panel, plate: v1.colors.plate };
  const removed = new Set(v1.removedSlots ?? []);
  let z = 0;
  const elements: Element[] = [];

  // panels first (behind everything)
  for (const c of effectiveChrome(v1)) elements.push(chromeToPanel(c, z++, tk));

  const s = v1.slots;
  if (!removed.has('list')) {
    const l = s.list;
    elements.push({
      id: 'games',
      type: 'gameList',
      rect: l.rect,
      z: z++,
      source: 'all',
      style: l.style ?? 'list',
      rowH: l.rowH,
      textPadL: l.textPadL,
      textPadR: l.textPadR,
      textDy: l.textDy,
      gridCols: l.gridCols,
      gridRows: l.gridRows,
      highlight: v1.colors.highlight,
      textColor: TEXT_COLOR,
    });
  }
  if (!removed.has('preview')) {
    // give the frame the cover aspect and fill it, so migrated layouts stop
    // showing letterboxed art
    const pr = s.preview.rect;
    elements.push({
      id: 'cover',
      type: 'boxArt',
      rect: [pr[0], pr[1], pr[2], Math.round(pr[2] / BOXART_ASPECT)],
      z: z++,
      fit: 'cover',
      bg: v1.colors.previewBg,
      aspectLock: true,
    });
  }
  if (!removed.has('info')) {
    const i = s.info;
    elements.push({
      id: 'info',
      type: 'infoPanel',
      rect: i.rect,
      z: z++,
      rowH: i.rowH,
      labelW: i.labelW,
      baselineDy: i.baselineDy,
      labels: i.labels,
      labelColor: '#9AA0B3',
      valueColor: TEXT_COLOR,
    });
  }

  const asText = (id: string, rect: Rect, align: Align, text: string, clockFormat?: string) => {
    const el: TextElement = {
      id, type: 'text', rect, z: z++, text, color: v1.colors.titleText, align, valign: 'bottom', wrap: false,
    };
    if (clockFormat) el.clockFormat = clockFormat;
    if (id === 'header' || id === 'clock' || id === 'actionbar') el.color = TEXT_COLOR;
    elements.push(el);
  };
  if (!removed.has('header')) asText('header', s.header.rect, s.header.align, s.header.text);
  if (!removed.has('clock')) asText('clock', s.clock.rect, s.clock.align, '', s.clock.format);
  if (!removed.has('platGames'))
    asText('title-games', s.platGames.rect, 'center', s.platGames.labelAll ?? s.platGames.label ?? 'GAMES');
  if (!removed.has('platPreview'))
    asText('title-preview', s.platPreview.rect, 'center', s.platPreview.label ?? 'PREVIEW');
  if (!removed.has('platInfo'))
    asText('title-info', s.platInfo.rect, 'center', s.platInfo.label ?? 'INFORMATION');
  if (!removed.has('actionBar'))
    asText('actionbar', s.actionBar.rect, s.actionBar.align, 'A Launch');

  for (const w of v1.widgets ?? []) elements.push(widgetToElement(w, z++, tk));

  const page0: Page = {
    id: 'page1',
    title: 'Page 1',
    kind: 'custom',
    start: true,
    background: '#0C122C',
    elements,
  };
  if (v1.skin) {
    page0.skin = v1.skin;
    page0.skinHostPath = v1.skinHostPath;
    page0.skinOffset = v1.skinOffset;
    page0.skinSize = v1.skinSize;
  }

  const pages: Page[] = [page0];
  for (const p of v1.pages ?? []) {
    if (p.id === 'browser') {
      pages.push(newFileBrowserPage(pages.map((x) => x.id)));
      continue;
    }
    let pz = 0;
    pages.push({
      id: safeId(p.id, `page${pages.length + 1}`),
      title: p.title || p.id,
      kind: 'custom',
      background: p.background,
      hint: p.hint,
      skin: p.skin,
      skinHostPath: p.skinHostPath,
      elements: p.widgets.map((w) => widgetToElement(w, pz++, tk)),
    });
  }

  return normalizeMenu({ format: MENU_FORMAT, pages });
}

// ---------------------------------------------------------------- invariants

function safeId(raw: string | undefined, fallback: string): string {
  const v = (raw ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  return v || fallback;
}

/** Enforce the model's invariants in place: unique page ids, unique element ids
 *  per page, contiguous z, and exactly one start page. */
export function normalizeMenu(m: MenuLayout): MenuLayout {
  m.format = MENU_FORMAT;
  if (m.buttons) {
    const b = normalizeButtonMap(m.buttons);
    if (Object.keys(b).length) m.buttons = b;
    else delete m.buttons;
  }
  if (m.overscan != null && Number.isFinite(m.overscan)) {
    const v = clampOverscanUnits(m.overscan);
    if (v > 0) m.overscan = v;
    else delete m.overscan;
  } else {
    delete m.overscan;
  }
  const th = cleanPopupTheme(m.theme);
  if (th) m.theme = th;
  else delete m.theme;
  if (!Array.isArray(m.pages) || m.pages.length === 0) {
    m.pages = [defaultPage()];
  }
  const seenPage = new Set<string>();
  m.pages = m.pages.slice(0, PAGE_LIMIT).map((p, i) => {
    let id = safeId(p.id, `page${i + 1}`);
    while (seenPage.has(id)) id = `${id}-${i}`;
    seenPage.add(id);
    // legacy page kinds are gone — a Browser page becomes a page carrying a
    // full-screen File Browser element; Favorites just keeps its elements
    const legacyBrowser = (p.kind as string) === 'browser';
    const seenEl = new Set<string>();
    let rawEls = Array.isArray(p.elements) ? p.elements : [];
    if (legacyBrowser && rawEls.length === 0) {
      rawEls = [newFileBrowserPage([]).elements[0]! as unknown as Element];
    }
    const elements = rawEls
      .slice(0, PAGE_ELEMENT_LIMIT)
      .map((e, j) => {
        let eid = safeId(e.id, `el${j + 1}`);
        while (seenEl.has(eid)) eid = `${eid}-${j}`;
        seenEl.add(eid);
        return { ...e, id: eid, z: j };
      });
    const np: Page = { ...p, id, kind: 'custom', title: p.title || id, elements };
    if (np.buttons) {
      const b = normalizeButtonMap(np.buttons);
      if (Object.keys(b).length) np.buttons = b;
      else delete np.buttons;
    }
    return np;
  });

  // exactly one start page
  const starts = m.pages.filter((p) => p.start);
  if (starts.length !== 1) {
    for (const p of m.pages) delete p.start;
    m.pages[0]!.start = true;
  }
  return m;
}

function defaultPage(): Page {
  return { id: 'page1', title: 'Page 1', kind: 'custom', start: true, background: '#0C122C', elements: [] };
}

// ---------------------------------------------------------------- json io

/** Parse menu.json (format 2) or a legacy home.json (format 1) into a MenuLayout. */
export function fromMenuJson(text: string, skinHostPath?: string): MenuLayout {
  let raw: Record<string, unknown>;
  try {
    const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    raw = JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    return defaultMenuLayout();
  }

  // legacy home.json — migrate through the v1 reader
  if (raw.format !== MENU_FORMAT || !Array.isArray(raw.pages) || raw.slots) {
    // dynamic import avoids a cycle at module load
    const v1 = fromHomeJsonLoose(text, skinHostPath);
    return migrateV1(v1);
  }

  // a pre-token-removal format-2 file may still carry `colors` + 'panel'/'plate'
  // element refs — resolve them against that file's own tokens on the way in.
  const tk: Tokens = {
    panel: pick(raw.colors, 'panel', LEGACY_PANEL),
    plate: pick(raw.colors, 'plate', LEGACY_PLATE),
  };
  const out: MenuLayout = {
    format: MENU_FORMAT,
    pages: (raw.pages as Record<string, unknown>[]).map((p, i) => normalizePageJson(p, i, tk, skinHostPath)),
  };
  const gb = normalizeButtonMap(raw.buttons);
  if (Object.keys(gb).length) out.buttons = gb;
  if (typeof raw.overscan === 'number') out.overscan = raw.overscan;
  const th = cleanPopupTheme(raw.theme);
  if (th) out.theme = th;
  return normalizeMenu(out);
}

function pick(o: unknown, k: string, dflt: string): string {
  return o && typeof o === 'object' && typeof (o as Record<string, unknown>)[k] === 'string'
    ? ((o as Record<string, unknown>)[k] as string)
    : dflt;
}

function num(v: unknown, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function rectOf(v: unknown): Rect {
  return Array.isArray(v) && v.length >= 4
    ? ([Math.round(num(v[0], 0)), Math.round(num(v[1], 0)), Math.round(num(v[2], 10)), Math.round(num(v[3], 10))] as Rect)
    : ([0, 0, 40, 20] as Rect);
}

function normalizePageJson(p: Record<string, unknown>, i: number, tk: Tokens, skinHostPath?: string): Page {
  const page: Page = {
    id: safeId(typeof p.id === 'string' ? p.id : '', `page${i + 1}`),
    title: typeof p.title === 'string' && p.title ? p.title : `Page ${i + 1}`,
    kind: 'custom',
    elements: [],
  };
  if (p.start === true) page.start = true;
  if (typeof p.background === 'string') page.background = p.background;
  if (typeof p.hint === 'string') page.hint = p.hint;
  const pb = normalizeButtonMap(p.buttons);
  if (Object.keys(pb).length) page.buttons = pb;
  if (typeof p.skin === 'string' && p.skin) {
    page.skin = p.skin;
    // a .n64menu project keeps the source image's absolute path per page;
    // `skinHostPath` (the fn arg) is the legacy single-image fallback
    if (typeof p.skinHostPath === 'string' && p.skinHostPath) page.skinHostPath = p.skinHostPath;
    else if (skinHostPath) page.skinHostPath = skinHostPath;
  }
  if (Array.isArray(p.skinOffset) && p.skinOffset.length >= 2)
    page.skinOffset = [num(p.skinOffset[0], 0), num(p.skinOffset[1], 0)];
  if (Array.isArray(p.skinSize) && p.skinSize.length >= 2)
    page.skinSize = [Math.max(1, num(p.skinSize[0], FRAMEBUFFER.w)), Math.max(1, num(p.skinSize[1], FRAMEBUFFER.h))];
  if (Array.isArray(p.elements))
    page.elements = (p.elements as Record<string, unknown>[])
      .map((e, j) => normalizeElementJson(e, j, tk))
      .filter((e): e is Element => e != null);
  // a legacy `kind:"browser"` page with nothing on it -> a real page with a
  // full-screen File Browser element
  if (p.kind === 'browser' && page.elements.length === 0) {
    page.elements = [newFileBrowserPage([]).elements[0]!];
  }
  return page;
}

/** old flat box keys — folded into `box` when a pre-2a file still carries them */
const FLAT_BOX_KEYS = ['fill', 'border', 'borderW', 'cornerRadius', 'corners', 'shape'];

function normalizeBox(raw: unknown, tk: Tokens): BoxStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const b: BoxStyle = {};
  if (typeof r.fill === 'string') b.fill = resolveColor(r.fill, tk);
  if (typeof r.border === 'string') b.border = resolveColor(r.border, tk);
  if (r.borderW != null) b.borderW = num(r.borderW, 0);
  if (typeof r.borderAlign === 'string' && BORDER_ALIGNS.includes(r.borderAlign as BorderAlign) && r.borderAlign !== 'inside')
    b.borderAlign = r.borderAlign as BorderAlign;
  if (r.cornerRadius != null) b.cornerRadius = num(r.cornerRadius, 0);
  if (Array.isArray(r.corners)) b.corners = r.corners as Corner[];
  if (typeof r.shape === 'string' && SHAPES.includes(r.shape as Shape) && r.shape !== 'rect')
    b.shape = r.shape as Shape;
  return Object.keys(b).length ? b : undefined;
}

function normalizeElementJson(e: Record<string, unknown>, i: number, tk: Tokens): Element | null {
  const type = (ELEMENT_TYPES.includes(e.type as ElementType) ? e.type : 'text') as ElementType;
  const id = safeId(typeof e.id === 'string' ? e.id : '', `el${i + 1}`);
  const rect = rectOf(e.rect);
  const z = Math.round(num(e.z, i));
  const seed = newElement(type, id) as unknown as Record<string, unknown>;

  // box: nested `box` object, or (pre-2a) flat fill/border/... on the element
  const flatBox = FLAT_BOX_KEYS.some((k) => e[k] !== undefined) ? Object.fromEntries(FLAT_BOX_KEYS.map((k) => [k, e[k]])) : null;
  const box = normalizeBox(e.box ?? flatBox, tk);

  const merged = { ...seed, id, rect, z } as Record<string, unknown>;
  for (const [k, v] of Object.entries(e)) {
    if (k === 'type' || k === 'id' || k === 'rect' || k === 'z' || v === undefined) continue;
    if (k === 'box' || FLAT_BOX_KEYS.includes(k)) continue; // handled above
    merged[k] = k === 'color' && typeof v === 'string' ? resolveColor(v, tk) : v;
  }
  if (box) merged.box = box;
  else delete merged.box;
  // gameList / infoPanel / fileList always render upright — never carry a rotation
  if (type === 'gameList' || type === 'infoPanel' || type === 'fileList') delete merged.rotation;
  // font size: any whole px is allowed; it's crispest at the baked size and whole
  // multiples (see sharpFontSizes) but off-ladder sizes just render a touch soft.
  if (typeof merged.fontSize === 'number' && merged.fontSize > 0) {
    merged.fontSize = Math.max(1, Math.round(merged.fontSize));
  }
  for (const k of ['lineHeight', 'letterSpacing']) {
    if (typeof merged[k] === 'number') merged[k] = Math.round(merged[k] as number);
  }
  return merged as unknown as Element;
}

/** A `buttons` object with keys in canonical order, or undefined when empty. */
function orderedButtons(m: ButtonMap | undefined): Record<string, string> | undefined {
  if (!m) return undefined;
  const out: Record<string, string> = {};
  for (const p of PHYS_INPUTS) if (m[p]) out[p] = m[p]!;
  return Object.keys(out).length ? out : undefined;
}

/** Serialize to the exact menu.json written to the card (drops app-only fields). */
export function toMenuJson(input: MenuLayout): string {
  // tolerate a stale/old-shape object reaching here (e.g. a format-1 layout in
  // an old .n64menu that skipped normalisation) — round it through the reader.
  const layout =
    input && input.format === MENU_FORMAT && Array.isArray(input.pages)
      ? input
      : fromMenuJson(JSON.stringify(input ?? {}));
  const out: Record<string, unknown> = { format: MENU_FORMAT };
  const gb = orderedButtons(layout.buttons);
  if (gb) out.buttons = gb;
  const osc = clampOverscanUnits(layout.overscan);
  if (osc !== 0) out.overscan = osc;
  const th = cleanPopupTheme(layout.theme);
  if (th) {
    const ordered: Record<string, string> = {};
    for (const k of POPUP_THEME_KEYS) if (th[k]) ordered[k] = th[k]!;
    out.theme = ordered;
  }
  out.pages = layout.pages.map((p) => {
    const o: Record<string, unknown> = { id: p.id, title: p.title, kind: p.kind };
    if (p.start) o.start = true;
    if (p.skin) o.skin = p.skin;
    if (p.skinOffset) o.skinOffset = p.skinOffset;
    if (p.skinSize) o.skinSize = p.skinSize;
    if (p.background) o.background = p.background;
    if (p.hint != null) o.hint = p.hint;
    const pb = orderedButtons(p.buttons);
    if (pb) o.buttons = pb;
    o.elements = (p.elements ?? [])
      .slice()
      .sort((a, b) => a.z - b.z)
      .map((e, i) => {
        const { id, type, rect, srcHostPath, ...others } = e as unknown as {
          id: string;
          type: string;
          rect: Rect;
          srcHostPath?: string;
        } & Record<string, unknown>;
        void srcHostPath;
        delete others.z;
        // nested box: alphabetise its keys too so the round-trip is stable
        if (others.box && typeof others.box === 'object') {
          const bb = others.box as Record<string, unknown>;
          const sorted: Record<string, unknown> = {};
          for (const k of Object.keys(bb).sort()) if (bb[k] !== undefined) sorted[k] = bb[k];
          others.box = Object.keys(sorted).length ? sorted : undefined;
          if (!others.box) delete others.box;
        }
        // canonical, deterministic key order: identity first, then the rest
        // alphabetised so serialise->parse->serialise is stable no matter how
        // the object was built (migrated vs re-imported).
        const rest: Record<string, unknown> = {};
        for (const k of Object.keys(others).sort()) if (others[k] !== undefined) rest[k] = others[k];
        return { id, type, rect, z: i, ...rest };
      });
    return o;
  });
  return JSON.stringify(out, null, 2) + '\n';
}

// ---------------------------------------------------------------- helpers

/** Canvas id of a page's background-image layer (movable/resizable like an element). */
export const SKIN_LAYER_ID = '@skin';

/** Human label for an element type (palette + properties header). */
export const ELEMENT_LABEL: Record<ElementType, string> = {
  gameList: 'Game List',
  boxArt: 'Box Art',
  infoPanel: 'Info Panel',
  text: 'Text',
  image: 'Image',
  button: 'Button',
  panel: 'Panel',
  setting: 'Setting',
  fileList: 'File Browser',
};

/** Every named favourites collection referenced anywhere in the layout —
 *  by a Game List's `collection` or a favorite.toggle action's `collection`. */
export function collectionsInLayout(m: MenuLayout): string[] {
  const seen = new Set<string>();
  for (const p of m.pages)
    for (const e of p.elements) {
      if (e.type === 'gameList' && e.source === 'favorites' && e.collection) seen.add(e.collection);
      if (e.type === 'button' && e.action.kind === 'favorite.toggle' && e.action.collection)
        seen.add(e.action.collection);
    }
  return [...seen].sort();
}

export function startPage(m: MenuLayout): Page {
  return m.pages.find((p) => p.start) ?? m.pages[0]!;
}
export function pageById(m: MenuLayout, id: string): Page | undefined {
  return m.pages.find((p) => p.id === id);
}
export function elementById(page: Page, id: string): Element | undefined {
  return page.elements.find((e) => e.id === id);
}

// ---------------------------------------------------------------- v1 loose reader
// layout-schema.fromHomeJson needs the raw text; re-exported thin so callers of
// this module don't also have to import layout-schema.

import { fromHomeJson as _fromHomeJson } from './layout-schema.ts';
function fromHomeJsonLoose(text: string, skinHostPath?: string): HomeLayout {
  return _fromHomeJson(text, skinHostPath);
}
