/**
 * TemplatePicker — the dropdown at the left of the canvas bar (DesignTab.tsx).
 * The button shows the last-applied template's name; opening it drops a grid of
 * cards, each a live <TemplateThumb> of that template's start page. Picking a
 * card replaces the whole design via applyTemplate() (undoable, prompts if the
 * project has unsaved edits).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store.ts';
import { applyTemplate } from '../design/state.ts';
import { TEMPLATES, templateLayout, templateMeta } from '../design/templates/index.ts';
import { TemplateThumb } from '../design/TemplateThumb.tsx';

export function TemplatePicker() {
  const current = useStore((s) => s.design.template);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', off);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', off);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const name = templateMeta(current)?.name ?? 'Custom';

  // parse the template payloads only while the menu is open
  const cards = useMemo(
    () => (open ? TEMPLATES.map((t) => ({ ...t, layout: templateLayout(t.meta.id) })) : []),
    [open],
  );

  return (
    <div className="mb-tpl-menu" ref={ref}>
      <button
        className={open ? 'mb-tpl-btn on' : 'mb-tpl-btn'}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Start from a ready-made menu design"
      >
        <span className="mb-tpl-ico" aria-hidden>
          ▦
        </span>
        <span className="mb-tpl-name">{name}</span>
        <span aria-hidden>▾</span>
      </button>

      {open && (
        <div className="mb-tpl-pop" role="menu">
          <div className="mb-tpl-pop-head">Templates</div>
          <div className="mb-tpl-grid">
            {cards.map((t) => (
              <button
                key={t.meta.id}
                className={t.meta.id === current ? 'mb-tpl-card on' : 'mb-tpl-card'}
                role="menuitem"
                onClick={() => {
                  applyTemplate(t.meta.id);
                  setOpen(false);
                }}
              >
                <TemplateThumb layout={t.layout} width={208} />
                <span className="mb-tpl-card-name">{t.meta.name}</span>
                <span className="mb-tpl-card-blurb">{t.meta.blurb}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
