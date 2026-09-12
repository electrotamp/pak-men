import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.ts';
import type { MenuLayout } from '../../shared/menu-schema.ts';

/**
 * Colour picker: a swatch + hex box, and a popover with the native wheel plus
 * two reuse rows — Recent (persisted across sessions) and In this project
 * (every colour the current layout already uses). Replaces the bare
 * <input type="color">; drop-in for the old `Color` component.
 */

const RECENT_KEY = 'mb.recentColors';
const RECENT_MAX = 12;
const HEX = /^#?([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/;

function normHex(v: string): string {
  const m = HEX.exec(v.trim());
  return m ? `#${(m[1] + (m[2] ?? '')).toUpperCase()}` : v;
}
/** #RRGGBB for the native input, which rejects an alpha byte */
function swatch6(v: string): string {
  const m = /^#?([0-9a-fA-F]{6})/.exec(v.trim());
  return m ? `#${m[1]}` : '#000000';
}
function isHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(v.trim());
}

function readRecent(): string[] {
  try {
    const a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(a) ? a.filter((c) => typeof c === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}
export function pushRecent(hex: string): void {
  if (!isHex(hex)) return;
  const h = normHex(hex);
  try {
    const next = [h, ...readRecent().filter((c) => normHex(c) !== h)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode / disabled storage — recent list just won't persist */
  }
}

const COLOR_KEYS = ['fill', 'border', 'color', 'bg', 'highlight', 'textColor', 'labelColor', 'valueColor'];
function projectColors(layout: MenuLayout | undefined): string[] {
  if (!layout) return [];
  const seen = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === 'string' && isHex(v)) seen.add(normHex(v));
  };
  for (const p of layout.pages) {
    add(p.background);
    for (const e of p.elements) {
      const rec = e as unknown as Record<string, unknown>;
      for (const k of COLOR_KEYS) add(rec[k]);
    }
  }
  return [...seen];
}

function Chip({ c, onPick }: { c: string; onPick: (c: string) => void }) {
  return (
    <button type="button" className="mb-cf-chip" style={{ background: swatch6(c) }} title={c} onClick={() => onPick(c)} />
  );
}

export function Color({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const layout = useStore((s) => s.project?.layout);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);

  // latest value + the value the picker opened on, so we record ONLY the colour
  // you settled on — not every hue you dragged the wheel past.
  const valueRef = useRef(value);
  valueRef.current = value;
  const openedOn = useRef(value);

  // Record the current colour if it differs from where the wheel opened, then
  // advance the baseline so a later close() (or another change) won't re-record.
  const recordSettled = () => {
    const v = valueRef.current;
    if (isHex(v) && normHex(v) !== normHex(openedOn.current)) pushRecent(normHex(v));
    openedOn.current = valueRef.current;
  };
  const close = () => {
    setOpen(false);
    recordSettled();
  };
  const openPop = () => {
    openedOn.current = valueRef.current;
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const nativeEngaged = () =>
      !!nativeRef.current && document.activeElement === nativeRef.current;
    const onDoc = (e: MouseEvent) => {
      // The native colour popup renders in the top layer, so clicks inside the
      // wheel look "outside" this div — but its host <input> keeps focus while
      // the popup is up. Ignore outside-clicks until the wheel has closed.
      if (nativeEngaged()) return;
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && !nativeEngaged() && close();
    // The native <input type="color"> fires 'change' once, when its popup closes
    // with a committed value — i.e. exactly when you leave the wheel.
    const n = nativeRef.current;
    const onNativeChange = () => recordSettled();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    n?.addEventListener('change', onNativeChange);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
      n?.removeEventListener('change', onNativeChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** live preview only — never touches the recent list */
  const preview = (v: string) => onChange(isHex(v) ? normHex(v) : v);
  /** a deliberate final choice (typed hex, or a reuse chip): apply + remember */
  const commit = (v: string) => {
    const h = isHex(v) ? normHex(v) : v;
    onChange(h);
    pushRecent(h);
  };
  const pick = (c: string) => {
    commit(c);
    setOpen(false);
  };

  const recent = readRecent();
  const proj = projectColors(layout).filter((c) => !recent.some((r) => normHex(r) === normHex(c)));

  return (
    <div className="np color-row mb-cf" ref={ref}>
      <span>{label}</span>
      <button
        type="button"
        className="mb-cf-swatch"
        style={{ background: swatch6(value) }}
        title={value}
        onClick={() => (open ? close() : openPop())}
      />
      <input
        className="hex"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
      />
      {open && (
        <div className="mb-cf-pop">
          <input
            ref={nativeRef}
            type="color"
            value={swatch6(value)}
            onChange={(e) => preview(e.target.value)}
          />
          {recent.length > 0 && (
            <>
              <div className="mb-cf-cap">Recent</div>
              <div className="mb-cf-grid">
                {recent.map((c) => (
                  <Chip key={c} c={c} onPick={pick} />
                ))}
              </div>
            </>
          )}
          {proj.length > 0 && (
            <>
              <div className="mb-cf-cap">In this project</div>
              <div className="mb-cf-grid">
                {proj.map((c) => (
                  <Chip key={c} c={c} onPick={pick} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
