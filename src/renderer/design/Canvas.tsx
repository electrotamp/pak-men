import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore, clampZoom, zoomStep, zoomFit } from '../store.ts';
import { select, updateLayout, currentPageObj, setDesign } from './state.ts';
import {
  rectOf,
  setRectOf,
  deleteSelected,
  skinRectOf,
  setSkinNatural,
  selectAll,
  copySelection,
  cutSelection,
  pasteClipboard,
  SKIN_LAYER_ID,
} from './layout-ops.ts';
import { ElementView, boxOverflows } from './ElementView.tsx';
import {
  snapMove,
  resizeRect,
  rectsOverlap,
  scaleElementFields,
  scalesWithBox,
  type Guide,
  type ResizeHandle,
} from './geometry.ts';
import {
  FRAMEBUFFER,
  ELEMENT_LABEL,
  elementById,
  gridBoxHeight,
  gridLabelBand,
  overscanScale,
  type Element,
  type Rect,
} from '../../shared/menu-schema.ts';

/** The box's locked aspect (w/h) if it should hold ratio on resize, else undefined. */
function lockedAspect(el: Element | undefined): number | undefined {
  if (!el || !el.aspectLock) return undefined;
  if (el.type === 'gameList') {
    if (el.style !== 'grid') return undefined;
    // a grid of box-art-shaped tiles (+ optional name band): lock the box to the
    // lattice's ratio at its current width — exact for band-free grids, close
    // enough for labelled ones (the Columns/Rows fields recompute exactly).
    const h = gridBoxHeight(el.rect[2], el.gridCols ?? 3, el.gridRows ?? 3, el.gridGap ?? 4, gridLabelBand(el));
    return el.rect[2] / Math.max(1, h);
  }
  return el.rect[2] / Math.max(1, el.rect[3]);
}

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/* Overscan safe zone — the fixed inset a typical CRT hides (matches the
   firmware's OVERSCAN_WIDTH 32 / OVERSCAN_HEIGHT 24). Advisory: the design isn't
   scaled to fit it, the guide just marks where important content should stay. */
const SAFE_INSET_X = 32;
const SAFE_INSET_Y = 24;

export function Canvas() {
  const layout = useStore((s) => s.project?.layout);
  const design = useStore((s) => s.design);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fit = design.fitZoom;
  const [guides, setGuides] = useState<Guide[]>([]);
  // the background image's own pixel size, learned when it loads — the default
  // wallpaper rect follows it (fit to frame), same as the exporter does
  const [skinNat, setSkinNat] = useState<[number, number]>([FRAMEBUFFER.w, FRAMEBUFFER.h]);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  // element outlines stay hidden until the pointer is over the artboard (an
  // individual element still reveals its own outline on hover, even off-board)
  const [overBoard, setOverBoard] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const anchor = useRef<{ px: number; py: number; lx: number; ly: number; ratio: number } | null>(null);

  const pageId = design.page;
  const page = currentPageObj(layout, pageId);
  const zoom = design.zoomFit ? fit : design.zoom;
  /* Overscan compensation: a display-time uniform scale about screen centre.
     Element geometry is authored untouched; this only changes how the preview
     (and, on export, the console) draws it. Pointer deltas divide by `view` so
     dragging still moves an element by the on-screen amount. */
  const oscK = overscanScale(layout?.overscan);
  const oscStyle: React.CSSProperties =
    oscK === 1 ? {} : { transform: `scale(${oscK})`, transformOrigin: '50% 50%' };
  const view = zoom * oscK;
  /* The artboard is a real 640x480 surface; a CSS transform scales it as one
     unit (transform-origin 0 0). So element geometry is authored in true
     framebuffer pixels — px() is identity — and there's a single, consistent
     scale instead of every element carrying a fractional multiply. */
  const px = (n: number) => n;

  // ---- fit-to-pane + whole-pixel centring ----
  const hasPage = page != null;
  const [pad, setPad] = useState<[number, number]>([24, 24]);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 80 || h < 80) return;
      const s = Math.min((w - 48) / FRAMEBUFFER.w, (h - 48) / FRAMEBUFFER.h);
      // land on the largest zoom stop that still fits, so +/- steps cleanly from Fit
      const z = zoomFit(s);
      if (z !== design.fitZoom) setDesign({ fitZoom: z });
      // whole-pixel centring — `margin: auto` can park the pixel-perfect layer
      // on a half-pixel, which smears the whole canvas
      const scale = design.zoomFit ? z : design.zoom;
      const nextPad: [number, number] = [
        Math.max(24, Math.floor((w - FRAMEBUFFER.w * scale) / 2)),
        Math.max(24, Math.floor((h - FRAMEBUFFER.h * scale) / 2)),
      ];
      setPad((p) => (p[0] === nextPad[0] && p[1] === nextPad[1] ? p : nextPad));
    };
    // always run the measurement on a fresh frame, never synchronously inside
    // this commit — otherwise a setDesign here re-runs the effect right away and
    // any layout wobble (a scrollbar toggling) becomes an infinite loop (#185)
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    schedule();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [hasPage, pageId, zoom, design.zoom, design.zoomFit, design.fitZoom]);

  const zoomTo = useCallback(
    (next: number, clientX?: number, clientY?: number) => {
      const el = wrapRef.current;
      const cur = design.zoomFit ? fit : design.zoom;
      const z = clampZoom(next);
      if (el && z !== cur) {
        const r = el.getBoundingClientRect();
        const lx = (clientX ?? r.left + r.width / 2) - r.left;
        const ly = (clientY ?? r.top + r.height / 2) - r.top;
        anchor.current = { px: el.scrollLeft + lx, py: el.scrollTop + ly, lx, ly, ratio: z / cur };
      }
      setDesign({ zoom: z, zoomFit: false });
    },
    [design.zoom, design.zoomFit, fit],
  );

  useLayoutEffect(() => {
    const el = wrapRef.current;
    const a = anchor.current;
    anchor.current = null;
    if (!el || !a) return;
    el.scrollLeft = a.px * a.ratio - a.lx;
    el.scrollTop = a.py * a.ratio - a.ly;
  }, [zoom]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cur = design.zoomFit ? fit : design.zoom;
      zoomTo(zoomStep(cur, e.deltaY < 0 ? 1 : -1), e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [design.zoom, design.zoomFit, fit, zoomTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey) {
        const cur = design.zoomFit ? fit : design.zoom;
        const k = e.key.toLowerCase();
        if (e.key === '=' || e.key === '+') return e.preventDefault(), zoomTo(zoomStep(cur, 1));
        if (e.key === '-' || e.key === '_') return e.preventDefault(), zoomTo(zoomStep(cur, -1));
        if (e.key === '0') return e.preventDefault(), setDesign({ zoomFit: true });
        if (e.key === '1') return e.preventDefault(), zoomTo(1);
        if (k === 'a') return e.preventDefault(), selectAll();
        if (k === 'c') return e.preventDefault(), copySelection();
        if (k === 'x') return e.preventDefault(), cutSelection();
        if (k === 'v') return e.preventDefault(), pasteClipboard();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && design.selected.length) {
        e.preventDefault();
        return deleteSelected();
      }
      if (design.selected.length === 0) return;
      const step = e.shiftKey ? design.gridPx : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'Escape') return select([]);
      else return;
      e.preventDefault();
      updateLayout((l) => {
        for (const id of design.selected) {
          const r = rectOf(l, id);
          if (r) setRectOf(l, id, [r[0] + dx, r[1] + dy, r[2], r[3]]);
        }
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [design.selected, design.gridPx, design.zoom, design.zoomFit, fit, zoomTo]);

  function startPan(e: React.PointerEvent) {
    const el = wrapRef.current;
    if (!el) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const l0 = el.scrollLeft;
    const t0 = el.scrollTop;
    el.classList.add('panning');
    const move = (ev: PointerEvent) => {
      el.scrollLeft = l0 - (ev.clientX - sx);
      el.scrollTop = t0 - (ev.clientY - sy);
    };
    const up = () => {
      el.classList.remove('panning');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  if (!layout || !page) return <div className="design-canvas-wrap" ref={wrapRef} />;

  const elements = page.elements;

  // multi-selection → one transform box around the union; dragging a handle
  // scales every selected element proportionally about the opposite corner
  // (position, size, and px-based type fields), the way a group scales in a
  // vector editor. A single selection keeps its own per-element handles.
  const groupIds = design.selected.filter((id) => elementById(page!, id));
  const groupRect: Rect | null =
    groupIds.length > 1
      ? (() => {
          let x0 = Infinity,
            y0 = Infinity,
            x1 = -Infinity,
            y1 = -Infinity;
          for (const id of groupIds) {
            const r = elementById(page!, id)!.rect;
            x0 = Math.min(x0, r[0]);
            y0 = Math.min(y0, r[1]);
            x1 = Math.max(x1, r[0] + r[2]);
            y1 = Math.max(y1, r[1] + r[3]);
          }
          return [x0, y0, x1 - x0, y1 - y0];
        })()
      : null;

  const skinUrl = page.skin && page.skinHostPath ? window.api.artUrlForFile(page.skinHostPath) : null;
  // one source of truth for the wallpaper's rect — same fallback the drag/resize
  // math uses (skinRectOf), so a handle always sits where the box is drawn.
  const skinRect: Rect = skinRectOf(page, skinNat);

  function startDrag(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    const additive = e.shiftKey;
    const sel = additive
      ? design.selected.includes(id)
        ? design.selected
        : [...design.selected, id]
      : design.selected.includes(id) && design.selected.length > 1
        ? design.selected
        : [id];
    select(sel);

    const startX = e.clientX;
    const startY = e.clientY;
    const origin = new Map<string, Rect>();
    for (const sid of sel) {
      const r = rectOf(layout!, sid);
      if (r) origin.set(sid, [...r] as Rect);
    }
    let moved = false;
    let pushed = false;
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* no active pointer (synthetic event) — the window listeners still work */
    }

    const move = (ev: PointerEvent) => {
      let dx = (ev.clientX - startX) / view;
      let dy = (ev.clientY - startY) / view;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 1.5) return;
      moved = true;
      // Shift constrains the move to horizontal / vertical / 45° (Photoshop)
      if (ev.shiftKey) {
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        if (ax > ay * 2) dy = 0;
        else if (ay > ax * 2) dx = 0;
        else {
          const m = (ax + ay) / 2;
          dx = Math.sign(dx) * m;
          dy = Math.sign(dy) * m;
        }
      }
      // snapping a rotated bounding box is a rabbit hole — skip it while any
      // selected element is rotated (grid snap on position still applies)
      const anyRotated = sel.some((s) => {
        const se = elementById(page!, s) as { rotation?: number } | undefined;
        return se && (se.rotation ?? 0) !== 0;
      });
      const snap = design.snap && !ev.altKey && !anyRotated; // hold Alt for free placement
      let allGuides: Guide[] = [];
      updateLayout(
        (l) => {
          for (const sid of sel) {
            const base = origin.get(sid);
            if (!base) continue;
            const res = snap
              ? snapMove(elements, sel, base, dx, dy, design.gridPx)
              : {
                  rect: [Math.round(base[0] + dx), Math.round(base[1] + dy), base[2], base[3]] as Rect,
                  guides: [],
                };
            setRectOf(l, sid, res.rect);
            allGuides = res.guides;
          }
        },
        { coalesce: pushed },
      );
      pushed = true;
      setGuides(allGuides);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setGuides([]);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Resize one element by dragging a handle — Photoshop Free Transform rules
      (corner keeps proportions, Shift frees it; side is one axis, Shift makes it
      proportional; Alt scales from the centre). Scales the element's px-valued
      fields (spacing, radius…) so its content tracks the box — except a text
      element's type size, which stays put: its box is just the wrap / clip area
      and the Font size control owns the size. */
  function startResize(e: React.PointerEvent, id: string, handle: ResizeHandle) {
    e.stopPropagation();
    if (!design.selected.includes(id) || design.selected.length !== 1) select([id]);

    const from = rectOf(layout!, id);
    if (!from) return;
    const origin = [...from] as Rect;
    const tel = id === SKIN_LAYER_ID ? undefined : elementById(page!, id);
    const orig = tel ? structuredClone(tel) : undefined;
    const rot = (((tel as { rotation?: number } | undefined)?.rotation ?? 0) * Math.PI) / 180;
    const cx = origin[0] + origin[2] / 2;
    const cy = origin[1] + origin[3] / 2;
    const startX = e.clientX;
    const startY = e.clientY;

    let moved = false;
    let pushed = false;
    const move = (ev: PointerEvent) => {
      let dx = (ev.clientX - startX) / view;
      let dy = (ev.clientY - startY) / view;
      moved = moved || Math.abs(dx) + Math.abs(dy) > 1;
      if (!moved) return;
      if (rot) {
        const c = Math.cos(-rot), s = Math.sin(-rot);
        [dx, dy] = [dx * c - dy * s, dx * s + dy * c];
      }
      const r = resizeRect(origin, handle, dx, dy, {
        shift: ev.shiftKey,
        alt: ev.altKey,
        lockAspect: lockedAspect(tel),
        grid: design.snap && !rot ? design.gridPx : 0,
      });
      if (rot) {
        r[0] = Math.round(cx - r[2] / 2);
        r[1] = Math.round(cy - r[3] / 2);
      }
      updateLayout(
        (l) => {
          setRectOf(l, id, r);
          const el = orig && elementById(currentPageObj(l, pageId)!, id);
          if (el && orig && scalesWithBox(orig.type))
            scaleElementFields(el, orig, Math.sqrt((r[2] / origin[2]) * (r[3] / origin[3])));
        },
        { coalesce: pushed },
      );
      pushed = true;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Resize the whole multi-selection — identical Free-Transform rules, applied
      to the selection's bounding box, then every element scaled about the same
      anchor with the same factors (rect + px fields). */
  function startGroupResize(e: React.PointerEvent, handle: ResizeHandle) {
    e.stopPropagation();
    if (!groupRect) return;
    const box: Rect = [...groupRect];
    const startX = e.clientX;
    const startY = e.clientY;
    const targets = groupIds
      .map((id) => {
        const el = elementById(page!, id);
        return el ? { id, r: [...el.rect] as Rect, orig: structuredClone(el) } : null;
      })
      .filter((t): t is { id: string; r: Rect; orig: Element } => t != null);

    let pushed = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / view;
      const dy = (ev.clientY - startY) / view;
      const nb = resizeRect(box, handle, dx, dy, { shift: ev.shiftKey, alt: ev.altKey });
      const sx = nb[2] / box[2];
      const sy = nb[3] / box[3];
      // the point the box scaled about: its centre under Alt, else the opposite edge
      const ax = ev.altKey ? box[0] + box[2] / 2 : handle.includes('w') ? box[0] + box[2] : box[0];
      const ay = ev.altKey ? box[1] + box[3] / 2 : handle.includes('n') ? box[1] + box[3] : box[1];
      const fs = Math.sqrt(sx * sy);
      updateLayout(
        (l) => {
          const pg = currentPageObj(l, pageId);
          if (!pg) return;
          for (const t of targets) {
            const el = elementById(pg, t.id);
            if (!el) continue;
            el.rect = [
              Math.round(ax + (t.r[0] - ax) * sx),
              Math.round(ay + (t.r[1] - ay) * sy),
              Math.max(4, Math.round(t.r[2] * sx)),
              Math.max(4, Math.round(t.r[3] * sy)),
            ];
            scaleElementFields(el, t.orig, fs);
          }
        },
        { coalesce: pushed },
      );
      pushed = true;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function startMarquee(e: React.PointerEvent) {
    const board = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const additive = e.shiftKey;
    // screen -> authored coords: undo the zoom, then the overscan scale (about centre)
    const ax = (cx: number) => FRAMEBUFFER.w / 2 + ((cx - board.left) / zoom - FRAMEBUFFER.w / 2) / oscK;
    const ay = (cy: number) => FRAMEBUFFER.h / 2 + ((cy - board.top) / zoom - FRAMEBUFFER.h / 2) / oscK;
    const x0 = ax(e.clientX);
    const y0 = ay(e.clientY);
    const base = additive ? [...design.selected] : [];
    let dragged = false;
    const move = (ev: PointerEvent) => {
      const x1 = ax(ev.clientX);
      const y1 = ay(ev.clientY);
      const r: Rect = [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)];
      dragged = dragged || r[2] + r[3] > 4;
      setMarquee(r);
      const hit = elements.filter((el) => rectsOverlap(el.rect, r)).map((el) => el.id);
      select([...new Set([...base, ...hit])]);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setMarquee(null);
      if (!dragged && !additive) select([]);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const box = (id: string, r: Rect, label: string, content: React.ReactNode, cls = '', rot = 0, clip = true) => {
    const selected = design.selected.includes(id);
    return (
      <div
        key={id}
        className={`slot-box${cls}${selected ? ' sel' : ''}`}
        style={{
          left: px(r[0]),
          top: px(r[1]),
          width: px(r[2]),
          height: px(r[3]),
          transform: rot ? `rotate(${rot}deg)` : undefined,
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          startDrag(e, id);
        }}
        onMouseEnter={() => setHoverId(id)}
        onMouseLeave={() => setHoverId((h) => (h === id ? null : h))}
        title={label}
      >
        {/* the element's own drawing is clipped to its box. An outline set to
            sit OUTSIDE the box opts out of the clip so it isn't cropped. The
            title tag renders up in the chrome layer, above the CRT filters. */}
        <div style={{ position: 'absolute', inset: 0, overflow: clip ? 'hidden' : 'visible' }}>{content}</div>
      </div>
    );
  };

  /* Element outlines render in the unclipped chrome layer (above the CRT / overscan
     overlays) — faint for every element while the pointer is over the board, bright
     for the hovered one. The selected element(s) show sel-chrome / the group box
     instead. */
  const outlines = () => {
    if (!overBoard && !hoverId) return null;
    return elements.map((e) => {
      if (design.selected.includes(e.id)) return null;
      if (!overBoard && hoverId !== e.id) return null;
      const rot = ('rotation' in e ? e.rotation : 0) ?? 0;
      const hot = hoverId === e.id;
      return (
        <div
          key={e.id}
          className={`el-outline${hot ? ' hot' : ''} el-${e.type}`}
          style={{
            left: e.rect[0],
            top: e.rect[1],
            width: e.rect[2],
            height: e.rect[3],
            transform: rot ? `rotate(${rot}deg)` : undefined,
          }}
        >
          {hot && <span className="slot-tag">{`${ELEMENT_LABEL[e.type]} · ${e.id}`}</span>}
        </div>
      );
    });
  };

  /* Selection chrome (outline + resize handles) lives in an UNCLIPPED layer above
     the CRT/overscan overlays, so handles show past the frame edge and aren't
     tinted. Single-selection only — a multi-selection uses the group box. */
  const selChrome = (id: string, r: Rect, rot = 0, label?: string) => (
    <div
      key={id}
      className="sel-chrome"
      style={{ left: r[0], top: r[1], width: r[2], height: r[3], transform: rot ? `rotate(${rot}deg)` : undefined }}
    >
      {label && <span className="slot-tag sel">{label}</span>}
      {HANDLES.map((h) => (
        <span key={h} className={`rz rz-${h}`} onPointerDown={(e) => startResize(e, id, h)} />
      ))}
    </div>
  );

  return (
    <div
      className="design-canvas-wrap"
      ref={wrapRef}
      onPointerDown={(e) => {
        if (e.button === 1) return startPan(e);
        if (e.button === 0) select([]);
      }}
      onAuxClick={(e) => e.preventDefault()}
    >
      <div
        className="artboard-sizer"
        style={{
          width: FRAMEBUFFER.w * zoom,
          height: FRAMEBUFFER.h * zoom,
          margin: `${pad[1]}px ${pad[0]}px`,
        }}
      >
      <div
        className={`artboard${overBoard ? ' outlines' : ''}${zoom >= 1 && Number.isInteger(zoom) ? ' pixel' : ''}`}
        style={{
          width: FRAMEBUFFER.w,
          height: FRAMEBUFFER.h,
          transform: `scale(${zoom})`,
        }}
        onMouseEnter={() => setOverBoard(true)}
        onMouseLeave={() => setOverBoard(false)}
        onMouseMove={() => setOverBoard(true)}
        onPointerDown={(e) => {
          if (e.button === 1) return;
          e.stopPropagation();
          if (e.button === 0) startMarquee(e);
        }}
      >
        {/* content layer: clipped to the frame like the console, and the CRT /
            overscan overlays tint it. Selection chrome sits above, outside. */}
        <div className="artboard-clip" style={{ background: page.background ?? '#0C122C' }}>
          {/* the design itself — scaled in for overscan; the CRT / overscan
              overlays below stay pinned to the real frame edge */}
          <div className="artboard-osc" style={oscStyle}>
          {skinUrl && (
            <img
              className="artboard-skin"
              src={skinUrl}
              alt=""
              style={{ left: px(skinRect[0]), top: px(skinRect[1]), width: px(skinRect[2]), height: px(skinRect[3]) }}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (!img.naturalWidth || !img.naturalHeight) return;
                const nat: [number, number] = [img.naturalWidth, img.naturalHeight];
                setSkinNat(nat);
                setSkinNatural(nat[0], nat[1]); // keep the module copy (used mid-drag) in step
              }}
              draggable={false}
            />
          )}

          {skinUrl && design.skinEdit && box(SKIN_LAYER_ID, skinRect, 'Background image', null, ' skin-box')}

          {elements.map((e) =>
            box(
              e.id,
              e.rect,
              `${ELEMENT_LABEL[e.type]} · ${e.id}`,
              <ElementView el={e} px={px} />,
              ' widget-box',
              ('rotation' in e ? e.rotation : 0) ?? 0,
              !boxOverflows('box' in e ? e.box : undefined),
            ),
          )}
          </div>

          {design.crt.map((f) => (
            <div key={f} className={`mb-crt mb-crt-${f}`} style={{ ['--crt-line' as string]: '2px' }} />
          ))}

          {design.safeGuide && (
            <div
              className="mb-safe-zone"
              style={{ left: SAFE_INSET_X, top: SAFE_INSET_Y, right: SAFE_INSET_X, bottom: SAFE_INSET_Y }}
              title="Overscan safe zone — a typical CRT hides everything outside this box. Keep text, buttons and anything important inside it; backgrounds can bleed past. Toggle from the toolbar."
            />
          )}
        </div>

        {/* chrome layer: never clipped, above the overlays — tracks the same
            overscan scale as the design so handles land on what's drawn */}
        <div className="artboard-chrome" style={oscStyle}>
          {outlines()}

          {design.skinEdit && skinUrl && !design.selected.includes(SKIN_LAYER_ID) && (
            <div
              className="el-outline el-skin"
              style={{ left: skinRect[0], top: skinRect[1], width: skinRect[2], height: skinRect[3] }}
            >
              {hoverId === SKIN_LAYER_ID && <span className="slot-tag">Background image</span>}
            </div>
          )}

          {marquee && (
            <div
              className="marquee"
              style={{ left: marquee[0], top: marquee[1], width: marquee[2], height: marquee[3] }}
            />
          )}

          {!groupRect &&
            elements
              .filter((e) => design.selected.includes(e.id))
              .map((e) =>
                selChrome(
                  e.id,
                  e.rect,
                  ('rotation' in e ? e.rotation : 0) ?? 0,
                  `${ELEMENT_LABEL[e.type]} · ${e.id}`,
                ),
              )}
          {!groupRect &&
            design.skinEdit &&
            design.selected.includes(SKIN_LAYER_ID) &&
            selChrome(SKIN_LAYER_ID, skinRect, 0, 'Background image')}

          {groupRect && (
            <div
              className="group-box"
              style={{ left: groupRect[0], top: groupRect[1], width: groupRect[2], height: groupRect[3] }}
            >
              {HANDLES.map((h) => (
                <span key={h} className={`rz rz-${h}`} onPointerDown={(e) => startGroupResize(e, h)} />
              ))}
            </div>
          )}

          {guides.map((g, i) =>
            g.axis === 'x' ? (
              <div key={i} className="guide v" style={{ left: g.at }} />
            ) : (
              <div key={i} className="guide h" style={{ top: g.at }} />
            ),
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
