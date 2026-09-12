import { FRAMEBUFFER, type Element, type Rect } from '../../shared/menu-schema.ts';

export interface Guide {
  axis: 'x' | 'y';
  at: number;
}

const SNAP_PX = 5; // guide snap threshold, in framebuffer px

const edgesX = (r: Rect) => [r[0], r[0] + r[2] / 2, r[0] + r[2]];
const edgesY = (r: Rect) => [r[1], r[1] + r[3] / 2, r[1] + r[3]];

/** Candidate snap lines: framebuffer edges + centre, and every other element's edges/centres. */
function snapLines(elements: Element[], exclude: Set<string>) {
  const xs = [0, FRAMEBUFFER.w / 2, FRAMEBUFFER.w];
  const ys = [0, FRAMEBUFFER.h / 2, FRAMEBUFFER.h];
  for (const e of elements) {
    if (exclude.has(e.id)) continue;
    xs.push(...edgesX(e.rect));
    ys.push(...edgesY(e.rect));
  }
  return { xs, ys };
}

export function gridSnap(v: number, grid: number): number {
  return grid > 0 ? Math.round(v / grid) * grid : Math.round(v);
}

/**
 * Move `rect` by (dx, dy).
 *
 * On each axis: if any alignment guide (another element's edge/centre, or a
 * framebuffer edge/centre) is within SNAP_PX of the raw dragged position, snap
 * exactly to the *closest* one — so two boxes line up pixel-perfect even when
 * that position is off the grid. Only an axis with no guide falls back to the
 * grid, so the grid never fights an alignment.
 */
export function snapMove(
  elements: Element[],
  movingIds: string[],
  rect: Rect,
  dx: number,
  dy: number,
  grid: number,
): { rect: Rect; guides: Guide[] } {
  const rawX = rect[0] + dx;
  const rawY = rect[1] + dy;
  const w = rect[2];
  const h = rect[3];
  const { xs, ys } = snapLines(elements, new Set(movingIds));
  const guides: Guide[] = [];

  const nearest = (edges: number[], cands: number[]) => {
    let best: { at: number; delta: number } | null = null;
    for (const cand of cands) {
      for (const e of edges) {
        const d = cand - e;
        if (Math.abs(d) <= SNAP_PX && (!best || Math.abs(d) < Math.abs(best.delta)))
          best = { at: cand, delta: d };
      }
    }
    return best;
  };

  const gx = nearest([rawX, rawX + w / 2, rawX + w], xs);
  const gy = nearest([rawY, rawY + h / 2, rawY + h], ys);

  let x = rawX;
  let y = rawY;
  if (gx) {
    x = rawX + gx.delta;
    guides.push({ axis: 'x', at: gx.at });
  } else {
    x = gridSnap(rawX, grid);
  }
  if (gy) {
    y = rawY + gy.delta;
    guides.push({ axis: 'y', at: gy.at });
  } else {
    y = gridSnap(rawY, grid);
  }

  return { rect: [Math.round(x), Math.round(y), w, h], guides };
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface ResizeOpts {
  /** Shift held. Toggles the constrain-proportions state (Photoshop). */
  shift?: boolean;
  /** Alt/Option held. Scales from the centre instead of the opposite edge. */
  alt?: boolean;
  /** A ratio (w/h) the box must always keep — box art, grid tiles. Overrides
   *  the Shift toggle (like Photoshop's options-bar chain link). */
  lockAspect?: number;
  /** Grid pitch to snap the dragged edge(s) to, or 0. Ignored under `alt`. */
  grid?: number;
}

const MIN = 4;

/**
 * Resize `rect` by dragging `handle` (dx, dy), matching Photoshop's Free
 * Transform:
 *  - corner handle: keeps proportions by default; Shift frees it
 *  - side handle:   one axis by default; Shift makes it proportional
 *  - Alt/Option:    scales from the centre (the opposite edge mirrors)
 *  - a `lockAspect` box always keeps its ratio, whatever the modifiers
 * The opposite corner / side stays put (the centre stays put under Alt).
 */
export function resizeRect(
  rect: Rect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  o: ResizeOpts = {},
): Rect {
  const [x0, y0, w0, h0] = rect;
  const dirX = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const dirY = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  const isCorner = dirX !== 0 && dirY !== 0;

  const constrain = o.lockAspect != null ? true : isCorner ? !o.shift : !!o.shift;
  const ratio = o.lockAspect && o.lockAspect > 0 ? o.lockAspect : w0 / Math.max(1, h0);

  // per-axis scale — Alt doubles the effect (both sides move) and halves the base
  const baseW = o.alt ? w0 / 2 : w0;
  const baseH = o.alt ? h0 / 2 : h0;
  let sx = dirX ? Math.max(MIN / baseW, (baseW + dx * dirX) / baseW) : 1;
  let sy = dirY ? Math.max(MIN / baseH, (baseH + dy * dirY) / baseH) : 1;

  if (constrain) {
    if (isCorner) {
      const s = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
      sx = sy = s;
    } else if (dirX) {
      sy = sx;
    } else {
      sx = sy;
    }
  }

  let w = Math.max(MIN, w0 * sx);
  let h = Math.max(MIN, h0 * sy);
  // a pure side drag (unconstrained) leaves the other axis alone
  if (!isCorner && !constrain) {
    if (!dirX) w = w0;
    if (!dirY) h = h0;
  }
  // keep the constrained corner honouring the ratio exactly
  if (constrain && (isCorner || o.lockAspect != null)) h = w / ratio;

  // anchor: opposite edge, or centre under Alt
  const ax = o.alt ? x0 + w0 / 2 : dirX < 0 ? x0 + w0 : x0;
  const ay = o.alt ? y0 + h0 / 2 : dirY < 0 ? y0 + h0 : y0;
  let x = ax - (o.alt ? w / 2 : dirX < 0 ? w : 0);
  let y = ay - (o.alt ? h / 2 : dirY < 0 ? h : 0);

  // snap the moving edge(s) to the grid (not while scaling from centre)
  if (o.grid && o.grid > 1 && !o.alt) {
    const g = o.grid;
    if (dirX > 0) w = Math.max(MIN, gridSnap(x + w, g) - x);
    else if (dirX < 0) {
      const r = x + w;
      x = gridSnap(x, g);
      w = Math.max(MIN, r - x);
    }
    if (dirY > 0) h = Math.max(MIN, gridSnap(y + h, g) - y);
    else if (dirY < 0) {
      const b = y + h;
      y = gridSnap(y, g);
      h = Math.max(MIN, b - y);
    }
    if (constrain && (isCorner || o.lockAspect != null)) {
      h = w / ratio;
      if (dirY < 0) y = ay - h;
    }
  }

  return [Math.round(x), Math.round(y), Math.round(w), Math.round(h)];
}

/** Do two [x,y,w,h] rects overlap at all? (marquee-select hit test) */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
}

const SCALE_FIELDS = [
  'lineHeight',
  'letterSpacing',
  'rowH',
  'textPadL',
  'textPadR',
  'textDy',
  'gridGap',
  'labelW',
  'baselineDy',
];

/** Whether a solo box-resize should also scale an element's px content fields
 *  (font size, spacing, radius…). A plain text element opts out: its box is a
 *  wrap / clip frame and the Font size control owns the type size, so a corner
 *  drag that also changed the number would just fight that control. Group
 *  transforms still scale everything — that's a deliberate "resize it all". */
export function scalesWithBox(type: string): boolean {
  return type !== 'text';
}

/** Set `el`'s px-valued layout fields to `orig`'s values scaled by `f` (used by
 *  the group transform, alongside a rect scale). Reads from `orig` — a snapshot
 *  taken when the drag began — so repeated calls during one drag don't compound.
 *  Leaves colours / keys / text alone. */
export function scaleElementFields(el: Element, orig: Element, f: number): void {
  if (!(f > 0)) return;
  const e = el as unknown as Record<string, unknown>;
  const o = orig as unknown as Record<string, unknown>;
  if (typeof o.fontSize === 'number' && o.fontSize > 0) {
    e.fontSize = Math.max(1, Math.round((o.fontSize as number) * f));
  }
  for (const k of SCALE_FIELDS) {
    if (typeof o[k] === 'number') e[k] = Math.max(1, Math.round((o[k] as number) * f));
  }
  if (Array.isArray(o.pad)) e.pad = (o.pad as number[]).map((v) => Math.round(v * f));
  const eb = e.box as Record<string, unknown> | undefined;
  const ob = o.box as Record<string, unknown> | undefined;
  if (eb && ob) {
    if (typeof ob.borderW === 'number') eb.borderW = Math.max(0, Math.round((ob.borderW as number) * f));
    if (typeof ob.cornerRadius === 'number')
      eb.cornerRadius = Math.max(0, Math.round((ob.cornerRadius as number) * f));
  }
}
