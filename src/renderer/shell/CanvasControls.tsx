/**
 * CanvasControls — the canvas-editing controls that live on the right of the
 * top toolbar (App.tsx): snap grid, undo/redo, overscan compensation + the
 * safe-zone guide toggle, and the CRT filter menu. Plus the "Background layer"
 * handle, which only appears when the current page carries a skin.
 *
 * All of it no-ops gracefully when there's no editable page.
 */

import { useEffect, useRef, useState } from 'react';
import {
  useStore,
  writeCrt,
  writeSafeGuide,
  CRT_FILTERS,
  CRT_FILTER_LABEL,
  type CrtFilter,
} from '../store.ts';
import {
  undo,
  redo,
  canUndo,
  canRedo,
  setDesign,
  updateLayout,
  currentPageObj,
} from '../design/state.ts';
import { SKIN_LAYER_ID } from '../design/layout-ops.ts';
import { clampOverscanUnits } from '../../shared/menu-schema.ts';

export function CanvasControls() {
  const design = useStore((s) => s.design);
  const layout = useStore((s) => s.project?.layout);
  const page = currentPageObj(layout, design.page);
  const custom = !!page;

  if (!custom) return null;

  return (
    <div className="mb-canvasctl">
      {page?.skin && (
        <button
          className={design.skinEdit ? 'mb-mini on' : 'mb-mini'}
          onClick={() =>
            setDesign({ skinEdit: !design.skinEdit, selected: design.skinEdit ? [] : [SKIN_LAYER_ID] })
          }
          title="Move / resize the background image itself"
        >
          Background layer
        </button>
      )}

      <label className="mb-mini-check" title="Snap to the grid while dragging">
        <input type="checkbox" checked={design.snap} onChange={(e) => setDesign({ snap: e.target.checked })} />
        Snap
      </label>
      <select
        value={design.gridPx}
        onChange={(e) => setDesign({ gridPx: Number(e.target.value) })}
        className="mb-mini mb-grid-sel"
        title="Snap grid size"
      >
        {[1, 2, 4, 8, 16].map((n) => (
          <option key={n} value={n}>
            {n}px
          </option>
        ))}
      </select>

      <button className="mb-mini" onClick={undo} disabled={!canUndo()} title="Undo (Ctrl+Z)">
        ↶
      </button>
      <button className="mb-mini" onClick={redo} disabled={!canRedo()} title="Redo (Ctrl+Shift+Z)">
        ↷
      </button>

      <span className="mb-bar-div" />

      <OverscanInput units={layout?.overscan ?? 0} />
      <button
        className={design.safeGuide ? 'mb-mini on' : 'mb-mini'}
        onClick={() => {
          writeSafeGuide(!design.safeGuide);
          setDesign({ safeGuide: !design.safeGuide });
        }}
        title="Show the overscan safe zone — the box a typical CRT keeps visible — and dim outside it"
      >
        Overscan safe zone
      </button>

      <CrtMenu
        enabled={design.crt}
        onChange={(fs) => {
          writeCrt(fs);
          setDesign({ crt: fs });
        }}
      />
    </div>
  );
}

/** Overscan compensation — whole-number %, 0 = full frame at 1:1. A manual dial
 *  for a set that crops harder than the safe-zone guide; every +1 shrinks the
 *  whole menu 1% toward centre. Never changes an element's authored geometry. */
function OverscanInput({ units }: { units: number }) {
  const [draft, setDraft] = useState(String(units));
  useEffect(() => setDraft(String(units)), [units]);

  const commit = (raw: string) => {
    const v = clampOverscanUnits(Number(raw) || 0);
    updateLayout((l) => {
      if (v === 0) delete l.overscan;
      else l.overscan = v;
    });
  };

  return (
    <span className="mb-overscan" title="Overscan compensation — shrink the whole menu toward screen centre so nothing is lost past a hard-cropping TV. 0 draws the full frame 1:1 (bitmap text stays pixel-exact). Doesn't touch any element's size or position.">
      <span className="mb-overscan-lbl">Overscan</span>
      <input
        className="mb-mini mb-overscan-in"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className="mb-overscan-suffix">%</span>
    </span>
  );
}

/** CRT emulation menu — a dropdown of checkboxes; enable any combination. */
function CrtMenu({ enabled, onChange }: { enabled: CrtFilter[]; onChange: (fs: CrtFilter[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', off);
    return () => window.removeEventListener('pointerdown', off);
  }, [open]);

  const toggle = (f: CrtFilter) =>
    onChange(enabled.includes(f) ? enabled.filter((x) => x !== f) : [...enabled, f]);

  return (
    <div className="mb-crt-menu" ref={ref}>
      <button
        className={enabled.length ? 'mb-mini on' : 'mb-mini'}
        onClick={() => setOpen((o) => !o)}
        title="CRT filter — stack any combination of filters over the canvas"
      >
        CRT Filter{enabled.length ? ` · ${enabled.length}` : ''} ▾
      </button>
      {open && (
        <div className="mb-crt-pop">
          {CRT_FILTERS.map((f) => (
            <label key={f}>
              <input type="checkbox" checked={enabled.includes(f)} onChange={() => toggle(f)} />
              {CRT_FILTER_LABEL[f]}
            </label>
          ))}
          {enabled.length > 0 && (
            <button className="mb-crt-clear" onClick={() => onChange([])}>
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
