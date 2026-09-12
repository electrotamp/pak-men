/**
 * The skinned home-screen layout — the `menu/n64ever/ui/home.json` the firmware
 * reads (src/menu/ui_layout/home_config.c). Rects are [x, y, w, h] in the
 * 640x480 framebuffer; for text slots the drawn BASELINE is `y + h`.
 *
 * `defaultHomeLayout()` reproduces the firmware's baked defaults exactly, so
 * exporting an untouched layout is a no-op on the console and the Design canvas
 * opens on the current look.
 */

export const HOME_LAYOUT_FORMAT = 1;

export type Rect = [x: number, y: number, w: number, h: number];
export type Align = 'left' | 'center' | 'right';
export type Fit = 'contain' | 'cover' | 'stretch';

/** The 9 fixed home-screen slots can be DELETED, not just toggled: a deleted
 *  slot is listed in `HomeLayout.removedSlots` and dropped from the emitted
 *  `home.json` "slots" object entirely, and the firmware never draws it. The
 *  Design tab's "+ Element" menu re-adds one at its baked defaults (nothing
 *  is remembered — see `newSlot`). For `list` the delete is still draw-only:
 *  selection/nav/launch keep working underneath (firmware `list_present`).
 *  The slot objects always exist in memory (this layout keeps all 9); only
 *  `removedSlots` and the exported JSON reflect a deletion. */
export interface TextSlot {
  rect: Rect;
  align: Align;
  text: string;
}
export interface ClockSlot {
  rect: Rect;
  align: Align;
  format: string;
}
export interface PlateSlot {
  rect: Rect;
  /** platGames uses labelFav + labelAll; platPreview / platInfo use label. */
  label?: string;
  labelFav?: string;
  labelAll?: string;
}
export interface ListSlot {
  rect: Rect;
  rowH: number;
  textPadL: number;
  textPadR: number;
  textDy: number;
  /** 'list' (scrolling names, the original look) or 'grid' (box-art tiles).
   *  Same underlying selection/scroll/launch either way — just a different
   *  presentation. Omitted = 'list'. */
  style?: ListStyle;
  /** Grid style only. Tile size is derived from the box's own W/H ÷ cols/rows
   *  — the box stays independently resizable no matter the grid size.
   *  cols*rows is capped at GRID_MAX_TILES (a home-screen grid keeps every
   *  visible tile's art loaded at once, no read-ahead eviction like the
   *  dedicated Grid view has, so it has to stay small by construction). */
  gridCols?: number;
  gridRows?: number;
}

export type ListStyle = 'list' | 'grid';
/** Mirrors the firmware's HC_GRID_MAX_TILES (home_config.h) exactly. */
export const GRID_MAX_TILES = 12;

/** How many rows actually show — derived from the box height, not a separate
 *  field: resizing the list IS how you change the row count (matches the
 *  firmware, which computes the same thing from the rect it's given). */
export function listRows(list: ListSlot): number {
  return Math.max(1, Math.floor(list.rect[3] / Math.max(1, list.rowH)));
}
export interface PreviewSlot {
  rect: Rect;
  fit: Fit;
}
export interface InfoSlot {
  rect: Rect;
  rowH: number;
  labelW: number;
  baselineDy: number;
  labels: [string, string, string, string, string];
}

export interface HomeColors {
  highlight: string;
  panel: string;
  plate: string;
  previewBg: string;
  titleText: string;
}

// ---- the fallback chrome: the flat panels drawn when there is no skin PNG ----

/**
 * A chrome panel's fill/border may be a literal `#RRGGBB[AA]` or one of the two
 * shared tokens, so the "Fallback panel" / "Fallback plate" colour pickers keep
 * driving every panel that hasn't been given a colour of its own.
 */
export type ChromeColor = 'panel' | 'plate' | (string & {});

export interface ChromePanel {
  /** Stable id: canvas selection + the props dock key. [a-z0-9_-]. */
  id: string;
  /** Editor label only — the firmware ignores it. */
  label?: string;
  rect: Rect;
  /** Fill: 'panel' | 'plate' | '#RRGGBB[AA]'. */
  color: ChromeColor;
  /** Outline colour; omit (or borderW 0) for no outline. */
  border?: ChromeColor;
  /** Outline thickness in framebuffer px, drawn inside the rect. 0 = none. */
  borderW?: number;
  /** Corner radius in framebuffer px (stepped, not a smooth curve — see the
   *  firmware's ui_components_rounded_box_draw). 0 / omitted = square. */
  cornerRadius?: number;
  /** Which corners `cornerRadius` rounds. Omitted = all four. An empty array
   *  is deliberately "none" (e.g. a plate rounds only its top two, since its
   *  bottom edge meets the panel below it — rounding there would cut a notch
   *  out of a seam that should stay a clean straight line). */
  corners?: Corner[];
}

export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export const ALL_CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];

export const CHROME_LIMIT = 16;

/**
 * The firmware's baked fallback chrome, as absolute 640×480 rects.
 *
 * Laid out on a symmetric two-column grid: 32px outer margins on every edge,
 * a 20px gutter between columns and between stacked panels, so the two
 * columns, the plate-over-panel pairs, and the action bar all line up exactly
 * (panelList and panelInfo share a bottom edge; panelBar spans both columns).
 */
export function defaultChrome(): ChromePanel[] {
  return [
    { id: 'panelList', label: 'List panel', rect: [32, 64, 278, 356], color: 'panel', cornerRadius: 8 },
    { id: 'panelPreview', label: 'Preview panel', rect: [330, 64, 278, 208], color: 'panel', cornerRadius: 8 },
    { id: 'panelInfo', label: 'Info panel', rect: [330, 292, 278, 128], color: 'panel', cornerRadius: 8 },
    { id: 'panelBar', label: 'Action bar panel', rect: [32, 440, 576, 32], color: 'panel', cornerRadius: 8 },
    // Plates sit flush atop their panel with the same x/w, so only their top
    // corners round -- the bottom edge is an internal seam, not an outer edge.
    { id: 'plateList', label: 'List plate', rect: [32, 64, 278, 28], color: 'plate', cornerRadius: 8, corners: ['tl', 'tr'] },
    { id: 'platePreview', label: 'Preview plate', rect: [330, 64, 278, 28], color: 'plate', cornerRadius: 8, corners: ['tl', 'tr'] },
    { id: 'plateInfo', label: 'Info plate', rect: [330, 292, 278, 28], color: 'plate', cornerRadius: 8, corners: ['tl', 'tr'] },
  ];
}

/** The chrome a layout actually renders: its own, or the baked defaults. */
export function effectiveChrome(layout: HomeLayout): ChromePanel[] {
  return layout.chrome ?? defaultChrome();
}

/** Resolve a ChromeColor against the layout's shared palette. */
export function resolveChromeColor(c: ChromeColor | undefined, colors: HomeColors): string {
  if (!c) return '#00000000';
  if (c === 'panel') return colors.panel;
  if (c === 'plate') return colors.plate;
  return c;
}

export function newChromePanel(id: string): ChromePanel {
  return { id, label: 'Panel', rect: [220, 190, 200, 100], color: 'panel', cornerRadius: 8 };
}

/** CSS `border-radius` shorthand (TL TR BR BL) for a chrome/button preview box. */
export function cornerRadiusCss(radius: number | undefined, corners: Corner[] | undefined): string {
  if (!radius) return '0';
  const on = new Set(corners ?? ALL_CORNERS);
  const px = (c: Corner) => (on.has(c) ? `${radius}px` : '0');
  return `${px('tl')} ${px('tr')} ${px('br')} ${px('bl')}`;
}

/** Colours for the built-in screens (Settings, Files, dialogs, tabs, …). #RRGGBB[AA]. */
export interface ThemeColors {
  border: string;
  dialogBg: string;
  highlight: string;
  scrollbarTrack: string;
  scrollbarInactive: string;
  scrollbarThumb: string;
  tabInactiveBg: string;
  tabActiveBg: string;
  tabInactiveBorder: string;
  tabActiveBorder: string;
  progressTrack: string;
  progressDone: string;
  backgroundEmpty: string;
  backgroundOverlay: string;
  boxartLoading: string;
}

/** The firmware's baked constants.h values — an unset token falls back to these. */
export function defaultThemeColors(): ThemeColors {
  return {
    border: '#FFFFFF',
    dialogBg: '#000000',
    highlight: '#7F7F7F',
    scrollbarTrack: '#3F3F3F',
    scrollbarInactive: '#5F5F5F',
    scrollbarThumb: '#7F7F7F',
    tabInactiveBg: '#3F3F3F',
    tabActiveBg: '#6F6F6F',
    tabInactiveBorder: '#5F5F5F',
    tabActiveBorder: '#FFFFFF',
    progressTrack: '#000000',
    progressDone: '#3B7CF5',
    backgroundEmpty: '#000000',
    backgroundOverlay: '#000000A0',
    boxartLoading: '#000000',
  };
}

// ---- arbitrary widgets drawn over the slots ----

export type WidgetType = 'text' | 'image' | 'button';

export type ActionKind =
  | 'none'
  | 'launch'
  | 'inspect'
  | 'goto'
  | 'back'
  | 'open'
  | 'toggleSetting'
  | 'setSetting'
  | 'runSort'
  | 'screensaver'
  | 'favorite.toggle';

export interface Action {
  kind: ActionKind;
  page?: string;
  view?: string;
  key?: string;
  value?: number;
  /** favorite.toggle: which named favourites collection ('' / omitted = ask) */
  collection?: string;
}

interface WidgetBase {
  id: string;
  type: WidgetType;
  rect: Rect;
  z: number;
}
export interface TextWidget extends WidgetBase {
  type: 'text';
  text: string;
  color: string;
  align: Align;
  wrap: boolean;
}
export interface ImageWidget extends WidgetBase {
  type: 'image';
  /** filename written to menu/n64ever/ui/assets/ */
  src: string;
  /** app-only: absolute host path the image is copied from */
  srcHostPath?: string;
  fit: Fit;
}
export interface ButtonWidget extends WidgetBase {
  type: 'button';
  label: string;
  glyph?: string;
  action: Action;
  /** D-pad focus ring position (low first). Omitted = fall back to layer/order. */
  focusOrder?: number;
  /** Defaults to true for buttons; set false to make a button non-selectable. */
  focusable?: boolean;
  /** Fill: 'panel' | 'plate' | '#RRGGBB[AA]' (same shared tokens as chrome). */
  fill: ChromeColor;
  /** Outline colour; omit (or borderW 0) for no outline. */
  border?: ChromeColor;
  /** Outline thickness in framebuffer px, drawn inside the rect. 0 = none. */
  borderW?: number;
  /** Label text colour, #RRGGBB[AA]. */
  color: string;
  /** Corner radius in framebuffer px (stepped — see the firmware's
   *  ui_components_rounded_box_draw). 0 = square. Ignored unless shape is 'rect'. */
  cornerRadius?: number;
  /** Box shape. 'circle' inscribes an ellipse, 'triangle' an upward-pointing
   *  triangle, both filling the widget's rect — same stepped-fill technique as
   *  cornerRadius, no smooth curve. Omitted = 'rect'. */
  shape?: ButtonShape;
}

export type ButtonShape = 'rect' | 'circle' | 'triangle';
export const BUTTON_SHAPES: ButtonShape[] = ['rect', 'circle', 'triangle'];
export type Widget = TextWidget | ImageWidget | ButtonWidget;

export const WIDGET_LIMIT = 48;

// ---- full-screen custom pages, reached from a button's "goto" action ----

export interface Page {
  /** Referenced by button actions ({ kind: 'goto', page: <id> }). [a-z0-9_-]. */
  id: string;
  /** Editor label only — the firmware ignores it. */
  title?: string;
  /** Per-page 640×480 background PNG, written next to home.json. */
  skin?: string;
  /** App-only: absolute host path the page skin is copied from. */
  skinHostPath?: string;
  /** Flat background colour (#RRGGBB[AA]) used when there is no skin. */
  background?: string;
  /** Bottom hint-bar text; empty = no hint bar. */
  hint?: string;
  widgets: Widget[];
}

export const PAGE_LIMIT = 12;
export const PAGE_WIDGET_LIMIT = 16;

/** The built-in list home screen, always the first entry in the page picker. */
export const HOME_PAGE_ID = 'home';

/**
 * Reserved page id for the SD-card file browser. It isn't a real full-screen
 * page — the firmware never renders its background/widgets/hint, it's purely
 * a marker (see the "browser" special-case in ui_actions.c's HC_ACT_GOTO and
 * games_menu.c's try_open_browser()) meaning "this project's page list opts
 * into the file browser." Its presence/absence is the whole toggle: the Home
 * screen's B button, and any button's {kind:'goto', page:'browser'} action,
 * only work when a page with this id exists — otherwise they're a no-op, the
 * same as a fresh project that never added it. Add/remove it like any other
 * page (addBrowserPage()/deletePage() in renderer/design/state.ts).
 */
export const BROWSER_PAGE_ID = 'browser';

export function newPage(id: string): Page {
  return { id, title: id, background: '#0C122C', hint: 'A Select     B Back', widgets: [] };
}

/** The browser marker page — see BROWSER_PAGE_ID. No title/background/hint/widgets:
 *  none of it is ever drawn, so there's nothing useful to default. */
export function newBrowserPage(): Page {
  return { id: BROWSER_PAGE_ID, widgets: [] };
}

export function hasBrowserPage(layout: Pick<HomeLayout, 'pages'>): boolean {
  return (layout.pages ?? []).some((p) => p.id === BROWSER_PAGE_ID);
}

export function newWidget(type: WidgetType, id: string): Widget {
  const base = { id, z: 0 };
  if (type === 'text')
    return { ...base, type, rect: [40, 400, 200, 20], text: 'New text', color: '#E7E9EF', align: 'left', wrap: false };
  if (type === 'image')
    return { ...base, type, rect: [520, 20, 96, 48], src: '', fit: 'contain' };
  return {
    ...base,
    type: 'button',
    rect: [40, 360, 120, 26],
    label: 'Button',
    action: { kind: 'none' },
    fill: 'panel',
    border: 'plate',
    borderW: 2,
    color: '#E7E9EF',
    cornerRadius: 6,
  };
}

/**
 * Fill in any fields a widget is missing, mutating it in place. Needed for a
 * button saved by an older build of the app: `fill`/`border`/`borderW`/`color`/
 * `cornerRadius` didn't exist before this version, so `.n64menu` project files
 * (loaded verbatim, unlike the SD-import path which already runs everything
 * through fromHomeJson's defaulting) can hold a button object missing them —
 * and passing `undefined` into a controlled color/text input breaks React's
 * controlled-input tracking for that field, which reads as "can't edit this."
 * Safe to call on an already-current widget: every check is additive.
 */
export function backfillWidgetDefaults(w: Widget): Widget {
  if (w.type === 'button') {
    const b = w as ButtonWidget;
    if (b.fill === undefined) b.fill = 'panel';
    if (b.border === undefined) b.border = 'plate';
    if (b.borderW === undefined) b.borderW = 2;
    if (b.color === undefined) b.color = '#E7E9EF';
    if (b.cornerRadius === undefined) b.cornerRadius = 6;
  } else if (w.type === 'text') {
    if ((w as TextWidget).color === undefined) (w as TextWidget).color = '#E7E9EF';
  }
  return w;
}

/** Run backfillWidgetDefaults over every widget a layout has, home screen and
 *  every page alike. Mutates in place; call once when a project loads. */
export function backfillLayoutWidgets(layout: HomeLayout): void {
  for (const w of layout.widgets ?? []) backfillWidgetDefaults(w);
  for (const p of layout.pages ?? []) for (const w of p.widgets) backfillWidgetDefaults(w);
}

export type SlotId = keyof HomeLayout['slots'];

export interface HomeLayout {
  format: typeof HOME_LAYOUT_FORMAT;
  /** Skin PNG filename written next to home.json, or undefined = baked chrome. */
  skin?: string;
  /** App-only: absolute host path of the source image the skin is copied from. */
  skinHostPath?: string;
  skinOffset: [number, number];
  /** Drawn size of the skin image. Absent = blit it at its native pixel size. */
  skinSize?: [number, number];
  colors: HomeColors;
  /** The flat fallback panels drawn when there is no skin. Absent = the baked 7. */
  chrome?: ChromePanel[];
  slots: {
    header: TextSlot;
    clock: ClockSlot;
    platGames: PlateSlot;
    platPreview: PlateSlot;
    platInfo: PlateSlot;
    list: ListSlot;
    preview: PreviewSlot;
    info: InfoSlot;
    actionBar: TextSlot;
  };
  /** Which of the 9 fixed slots have been deleted in the Design tab. Omitted /
   *  empty = all present. A listed slot is also dropped from the exported
   *  "slots" object; on the firmware this array is authoritative (an absent
   *  slot key alone still means "default", never "deleted"). The slot objects
   *  above always stay populated in memory regardless. */
  removedSlots?: SlotId[];
  /** Extra elements drawn on top of the slots (Design tab palette). */
  widgets?: Widget[];
  /** Full-screen custom pages authored in the Design tab. */
  pages?: Page[];
  /** Colour overrides for the built-in screens; unset = the firmware defaults. */
  theme?: ThemeColors;
}

/**
 * A symmetric two-column grid: 32px outer margins on every edge, a 20px gutter
 * between the columns and between stacked panels, 8-10px insets between each
 * chrome panel and the content that sits inside it. Every number below derives
 * from that one rule, so panel edges, plate widths, and content boxes all
 * genuinely line up instead of each having been tuned in isolation:
 *
 *   list panel   [32, 64, 278, 356]  bottom 420 -- same bottom edge as info
 *   preview pnl  [330, 64, 278, 208] bottom 272, +20 gutter -> info panel top
 *   info panel   [330, 292, 278, 128] bottom 420
 *   action bar   [32, 440, 576, 32]  bottom 472, 8px to the screen edge
 */
export function defaultHomeLayout(): HomeLayout {
  return {
    format: HOME_LAYOUT_FORMAT,
    skinOffset: [14, 8],
    colors: {
      highlight: '#2C44D8',
      panel: '#0C122C',
      plate: '#5A5FB0',
      previewBg: '#000000',
      titleText: '#0B0B1C',
    },
    slots: {
      header: { rect: [32, 26, 278, 18], align: 'left', text: 'GAME MENU' },
      clock: { rect: [328, 26, 280, 18], align: 'right', format: '%Y-%m-%d   %H:%M' },
      platGames: { rect: [32, 62, 278, 22], labelFav: 'GAMES', labelAll: 'ALL GAMES' },
      platPreview: { rect: [330, 62, 278, 22], label: 'PREVIEW' },
      platInfo: { rect: [330, 290, 278, 22], label: 'INFORMATION' },
      list: { rect: [40, 100, 262, 312], rowH: 24, textPadL: 10, textPadR: 8, textDy: 16 },
      preview: { rect: [340, 102, 258, 160], fit: 'contain' },
      info: {
        rect: [338, 328, 262, 84],
        rowH: 20,
        labelW: 100,
        baselineDy: 14,
        // Only these two are backed by real data today (game_metadata.h has no
        // players/genre/publisher field at all) -- an empty label hides that
        // row entirely rather than showing a permanent "---". Add your own in
        // the remaining 3 slots if a custom gameconfigs .meta.ini supplies them.
        labels: ['RELEASED', 'DEVELOPER', '', '', ''],
      },
      actionBar: {
        rect: [40, 447, 560, 18],
        align: 'center',
        text: 'A Launch     B Browser     R Grid view     Z {sourceToggle}',
      },
    },
    // Matches home_config_defaults()'s own baked page list, so a fresh project
    // and a "no home.json" SD card behave identically out of the box: B opens
    // the file browser. Delete this page (or never add it back) to opt out.
    pages: [newBrowserPage()],
  };
}

/** Metadata for the canvas: label, kind, whether it's a text baseline slot. */
export interface SlotMeta {
  id: SlotId;
  label: string;
  kind: 'text' | 'plate' | 'list' | 'preview' | 'info';
  /** Text/plate slots: the drawn content sits on the baseline at rect.y + rect.h. */
  baseline: boolean;
}

export const SLOT_META: SlotMeta[] = [
  { id: 'header', label: 'Header', kind: 'text', baseline: true },
  { id: 'clock', label: 'Clock', kind: 'text', baseline: true },
  { id: 'platGames', label: 'Games plate title', kind: 'plate', baseline: true },
  { id: 'platPreview', label: 'Preview plate title', kind: 'plate', baseline: true },
  { id: 'platInfo', label: 'Info plate title', kind: 'plate', baseline: true },
  { id: 'list', label: 'Game list', kind: 'list', baseline: false },
  { id: 'preview', label: 'Cover preview', kind: 'preview', baseline: false },
  { id: 'info', label: 'Information panel', kind: 'info', baseline: false },
  { id: 'actionBar', label: 'Action bar', kind: 'text', baseline: true },
];

/** The 9 fixed slot ids, in canvas/JSON order. */
export const ALL_SLOT_IDS: SlotId[] = SLOT_META.map((m) => m.id);

export function isSlotRemoved(layout: Pick<HomeLayout, 'removedSlots'>, id: SlotId): boolean {
  return (layout.removedSlots ?? []).includes(id);
}
/** Slot ids still on the screen — what the canvas draws and the props dock lists. */
export function presentSlotIds(layout: Pick<HomeLayout, 'removedSlots'>): SlotId[] {
  return ALL_SLOT_IDS.filter((id) => !isSlotRemoved(layout, id));
}
/** Slot ids the author deleted — what the "+ Element" menu offers to re-add. */
export function removedSlotIds(layout: Pick<HomeLayout, 'removedSlots'>): SlotId[] {
  return ALL_SLOT_IDS.filter((id) => isSlotRemoved(layout, id));
}
/** A freshly-defaulted slot object — what "+ Element" re-adds. Nothing about a
 *  slot is remembered across a delete/re-add, by design. */
export function newSlot<K extends SlotId>(id: K): HomeLayout['slots'][K] {
  return structuredClone(defaultHomeLayout().slots[id]);
}

/**
 * Migrate the short-lived per-slot `show` flag (the build between "everything is
 * a fixed slot" and this one) to the `removedSlots` model: a slot saved with
 * `show: false` becomes a deletion, and every stray `show` key is stripped
 * (`clock` always carried `show: true`). In place; safe to call repeatedly and
 * on layouts that never had the flag.
 */
export function migrateLegacySlotShow(layout: HomeLayout): void {
  const removed = new Set<SlotId>(layout.removedSlots ?? []);
  for (const id of ALL_SLOT_IDS) {
    const slot = layout.slots[id] as unknown as Record<string, unknown> | undefined;
    if (!slot || !('show' in slot)) continue;
    if (slot.show === false) removed.add(id);
    delete slot.show;
  }
  if (removed.size) layout.removedSlots = ALL_SLOT_IDS.filter((i) => removed.has(i));
}

export const FRAMEBUFFER = { w: 640, h: 480 } as const;

/** Canvas id of the skin-image layer (movable/resizable like any other box). */
export const SKIN_LAYER_ID = '@skin';

/** Canvas id of a chrome panel — namespaced so it can't collide with a widget id. */
export const CHROME_ID_PREFIX = '@chrome:';
export const chromeCanvasId = (id: string): string => `${CHROME_ID_PREFIX}${id}`;
export function isChromeCanvasId(id: string): boolean {
  return id.startsWith(CHROME_ID_PREFIX);
}
export function chromeIdFromCanvasId(id: string): string {
  return id.slice(CHROME_ID_PREFIX.length);
}

/** Parse a `home.json` string back into a HomeLayout, filling defaults for anything absent. */
export function fromHomeJson(text: string, skinHostPath?: string): HomeLayout {
  const base = defaultHomeLayout();
  let raw: Record<string, unknown>;
  try {
    // tolerate // and /* */ comments (the docs use jsonc)
    const stripped = text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    raw = JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    return base;
  }
  const out = structuredClone(base);
  if (typeof raw.skin === 'string') out.skin = raw.skin;
  if (skinHostPath) out.skinHostPath = skinHostPath;
  if (Array.isArray(raw.skinOffset) && raw.skinOffset.length >= 2)
    out.skinOffset = [Number(raw.skinOffset[0]) || 0, Number(raw.skinOffset[1]) || 0];
  if (Array.isArray(raw.skinSize) && raw.skinSize.length >= 2) {
    const sw = Math.round(Number(raw.skinSize[0]));
    const sh = Math.round(Number(raw.skinSize[1]));
    // 0 / negative / NaN all mean "native size" — same as omitting the key
    if (sw > 0 && sh > 0) out.skinSize = [sw, sh];
  }

  if (Array.isArray(raw.chrome)) {
    out.chrome = (raw.chrome as Record<string, unknown>[])
      .map((c, i) => normalizeChrome(c, i))
      .slice(0, CHROME_LIMIT);
  }

  const rc = raw.colors as Partial<HomeColors> | undefined;
  if (rc && typeof rc === 'object') {
    for (const k of Object.keys(out.colors) as (keyof HomeColors)[]) {
      if (typeof rc[k] === 'string') out.colors[k] = rc[k] as string;
    }
  }

  const rs = raw.slots as Record<string, Record<string, unknown>> | undefined;
  if (rs && typeof rs === 'object') {
    const merge = <T extends object>(target: T, src: Record<string, unknown> | undefined): T => {
      if (!src) return target;
      for (const [k, v] of Object.entries(src)) {
        if (v === undefined) continue;
        (target as Record<string, unknown>)[k] = v;
      }
      return target;
    };
    for (const id of Object.keys(out.slots) as SlotId[]) {
      merge(out.slots[id] as object, rs[id]);
    }
  }

  if (Array.isArray(raw.removedSlots)) {
    const want = new Set(raw.removedSlots as unknown[]);
    // normalised to canvas order, de-duped, junk ids dropped
    const removed = ALL_SLOT_IDS.filter((id) => want.has(id));
    if (removed.length) out.removedSlots = removed;
  }
  // a home.json written by the brief per-slot "show" build
  migrateLegacySlotShow(out);

  if (Array.isArray(raw.widgets)) {
    out.widgets = (raw.widgets as Record<string, unknown>[])
      .map((w, i) => normalizeWidget(w, i))
      .filter((w): w is Widget => w != null)
      .slice(0, WIDGET_LIMIT);
  }

  if (Array.isArray(raw.pages)) {
    out.pages = (raw.pages as Record<string, unknown>[])
      .map((p, i) => normalizePage(p, i))
      .slice(0, PAGE_LIMIT);
  }

  if (raw.theme && typeof raw.theme === 'object') {
    const rt = raw.theme as Record<string, unknown>;
    const theme = defaultThemeColors();
    for (const k of Object.keys(theme) as (keyof ThemeColors)[]) {
      if (typeof rt[k] === 'string') theme[k] = rt[k] as string;
    }
    out.theme = theme;
  }
  return out;
}

function normalizeChrome(c: Record<string, unknown>, i: number): ChromePanel {
  const r =
    Array.isArray(c.rect) && c.rect.length >= 4
      ? (c.rect.map((n) => Math.round(Number(n)) || 0) as Rect)
      : ([0, 0, 40, 20] as Rect);
  const panel: ChromePanel = {
    id: typeof c.id === 'string' && c.id ? c.id : `c${i + 1}`,
    rect: r,
    color: typeof c.color === 'string' && c.color ? c.color : 'panel',
  };
  if (typeof c.label === 'string' && c.label) panel.label = c.label;
  if (typeof c.border === 'string' && c.border) panel.border = c.border;
  const bw = Math.round(Number(c.borderW));
  if (bw > 0) panel.borderW = bw;
  const rad = Math.round(Number(c.radius));   // wire key is "radius" (matches home_config.c)
  if (rad > 0) panel.cornerRadius = rad;
  if (Array.isArray(c.corners)) {
    panel.corners = c.corners.filter((v): v is Corner => ALL_CORNERS.includes(v as Corner));
  }
  return panel;
}

function normalizePage(p: Record<string, unknown>, i: number): Page {
  const id = typeof p.id === 'string' && p.id ? p.id : `page${i + 1}`;
  const page: Page = { id, widgets: [] };
  if (typeof p.title === 'string' && p.title) page.title = p.title;
  if (typeof p.skin === 'string' && p.skin) page.skin = p.skin;
  if (typeof p.background === 'string' && p.background) page.background = p.background;
  if (typeof p.hint === 'string') page.hint = p.hint;
  if (Array.isArray(p.widgets)) {
    page.widgets = (p.widgets as Record<string, unknown>[])
      .map((w, j) => normalizeWidget(w, j))
      .filter((w): w is Widget => w != null)
      .slice(0, PAGE_WIDGET_LIMIT);
  }
  return page;
}

function normalizeWidget(w: Record<string, unknown>, i: number): Widget | null {
  const type = (w.type === 'image' || w.type === 'button' ? w.type : 'text') as WidgetType;
  const id = typeof w.id === 'string' && w.id ? w.id : `w${i + 1}`;
  const r = Array.isArray(w.rect) && w.rect.length >= 4 ? (w.rect.map(Number) as Rect) : ([0, 0, 80, 20] as Rect);
  const z = Number(w.z) || 0;
  if (type === 'image')
    return { id, type, rect: r, z, src: String(w.src ?? ''), fit: (w.fit as Fit) ?? 'contain' };
  if (type === 'button') {
    const focus = (w.focus as { order?: unknown; focusable?: unknown }) ?? {};
    return {
      id,
      type,
      rect: r,
      z,
      label: String(w.label ?? w.text ?? 'Button'),
      glyph: typeof w.glyph === 'string' ? w.glyph : undefined,
      action: (w.action as Action) ?? { kind: 'none' },
      focusOrder: typeof focus.order === 'number' ? focus.order : undefined,
      focusable: typeof focus.focusable === 'boolean' ? focus.focusable : undefined,
      fill: typeof w.fill === 'string' && w.fill ? w.fill : 'panel',
      border: typeof w.border === 'string' && w.border ? w.border : 'plate',
      borderW: typeof w.borderW === 'number' ? w.borderW : 2,
      color: typeof w.color === 'string' && w.color ? w.color : '#E7E9EF',
      cornerRadius: typeof w.cornerRadius === 'number' ? w.cornerRadius : 6,
      shape: BUTTON_SHAPES.includes(w.shape as ButtonShape) ? (w.shape as ButtonShape) : undefined,
    };
  }
  return {
    id,
    type: 'text',
    rect: r,
    z,
    text: String(w.text ?? ''),
    color: typeof w.color === 'string' ? w.color : '#E7E9EF',
    align: (w.align as Align) ?? 'left',
    wrap: Boolean(w.wrap),
  };
}

/** A widget as written to home.json: z-sorted upstream, app-only host paths dropped,
 *  button focus flattened into a `focus` object. */
function widgetForJson(w: Widget): Record<string, unknown> {
  const { srcHostPath, focusOrder, focusable, ...rest } = w as unknown as {
    srcHostPath?: string;
    focusOrder?: number;
    focusable?: boolean;
  } & Record<string, unknown>;
  void srcHostPath;
  if (focusOrder != null || focusable != null) {
    const focus: Record<string, unknown> = {};
    if (focusOrder != null) focus.order = focusOrder;
    if (focusable != null) focus.focusable = focusable;
    rest.focus = focus;
  }
  return rest;
}

/** A chrome panel as written to home.json — the editor-only label is kept (harmless,
 *  and it survives a round-trip through export/import). */
function chromeForJson(c: ChromePanel): Record<string, unknown> {
  const o: Record<string, unknown> = { id: c.id };
  if (c.label) o.label = c.label;
  o.rect = c.rect;
  o.color = c.color;
  if (c.border && (c.borderW ?? 0) > 0) {
    o.border = c.border;
    o.borderW = c.borderW;
  }
  if ((c.cornerRadius ?? 0) > 0) {
    o.radius = c.cornerRadius;
    if (c.corners) o.corners = c.corners;
  }
  return o;
}

/** Serialize a layout to the exact `home.json` the firmware parses (drops app-only fields). */
export function toHomeJson(layout: HomeLayout): string {
  // stable key order: format, skin, skinOffset, skinSize, colors, chrome, slots,
  // removedSlots, widgets, pages
  const ordered: Record<string, unknown> = { format: HOME_LAYOUT_FORMAT };
  if (layout.skin) ordered.skin = layout.skin;
  ordered.skinOffset = layout.skinOffset;
  if (layout.skinSize) ordered.skinSize = layout.skinSize;
  ordered.colors = layout.colors;
  // omitted entirely = the firmware's baked panels; [] = deliberately no chrome
  if (layout.chrome) ordered.chrome = layout.chrome.map(chromeForJson);
  // A deleted slot is dropped from "slots" AND named in "removedSlots" (below).
  // The firmware trusts "removedSlots"; dropping the object too just keeps the
  // file free of dead geometry (a re-added slot starts from baked defaults).
  const removed = new Set(layout.removedSlots ?? []);
  const slotsOut: Record<string, unknown> = {};
  for (const id of ALL_SLOT_IDS) if (!removed.has(id)) slotsOut[id] = layout.slots[id];
  ordered.slots = slotsOut;
  // Only written when non-empty: absent = "nothing deleted", which is also the
  // right fallback for every home.json predating this feature.
  const removedList = ALL_SLOT_IDS.filter((id) => removed.has(id));
  if (removedList.length) ordered.removedSlots = removedList;
  if (layout.widgets && layout.widgets.length) {
    ordered.widgets = layout.widgets.slice().sort((a, b) => a.z - b.z).map(widgetForJson);
  }
  // Written even when empty: an explicit "pages": [] is how a project says "no
  // pages at all" (e.g. the author removed the browser page and never added a
  // custom one) — omitting the key entirely would instead fall back to the
  // firmware's own baked default page list (which includes the browser marker),
  // silently overriding that choice. Only a layout that never touched pages at
  // all (pre-dates the page system) has `pages` be `undefined`, and for that
  // one case falling back to the firmware default is exactly right.
  if (layout.pages) {
    ordered.pages = layout.pages.map((p) => {
      const o: Record<string, unknown> = { id: p.id };
      if (p.title) o.title = p.title;
      if (p.skin) o.skin = p.skin;
      if (p.background) o.background = p.background;
      if (p.hint != null) o.hint = p.hint;
      o.widgets = p.widgets.slice().sort((a, b) => a.z - b.z).map(widgetForJson);
      return o;
    });
  }
  if (layout.theme) ordered.theme = layout.theme;
  return JSON.stringify(ordered, null, 2) + '\n';
}

/** Every draggable box on the canvas: the 9 slots plus the user widgets. */
export function isSlotId(id: string): id is SlotId {
  return SLOT_META.some((m) => m.id === id);
}
