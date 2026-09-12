/**
 * PageTabs — the strip of screens above the canvas. Tab order = the console's
 * navigation order; drag a tab to reorder. The ＋ Page button adds a blank page.
 * A dot marks the start screen (the one the console boots to). Each tab has a
 * ⧉ button to duplicate that screen and a × to delete it.
 */

import { useState } from 'react';
import { useStore } from '../store.ts';
import { setDesignPage, addPage, duplicatePage, deletePage, reorderPages } from '../design/state.ts';

export function PageTabs() {
  const layout = useStore((s) => s.project?.layout);
  const active = useStore((s) => s.design.page);
  const pages = layout?.pages ?? [];
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div className="mb-pagetabs" role="tablist">
      {pages.map((p, i) => (
        <span
          key={p.id}
          className={`mb-tab${p.id === active ? ' on' : ''}${dragId && dragId !== p.id ? ' droptarget' : ''}`}
          draggable
          onDragStart={() => setDragId(p.id)}
          onDragEnd={() => setDragId(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId && dragId !== p.id) {
              const from = pages.findIndex((x) => x.id === dragId);
              reorderPages(from, i);
            }
            setDragId(null);
          }}
        >
          <button role="tab" aria-selected={p.id === active} className="mb-tab-label" onClick={() => setDesignPage(p.id)}>
            {p.start && <span className="mb-tab-star" title="Start screen — the console boots here">●</span>}
            {p.title}
          </button>
          <button
            className="mb-tab-dup"
            title={`Duplicate "${p.title}"`}
            onClick={() => duplicatePage(p.id)}
          >
            ⧉
          </button>
          {pages.length > 1 && (
            <button
              className="mb-tab-x"
              title={`Delete "${p.title}" (Ctrl+Z to undo)`}
              onClick={() => deletePage(p.id)}
            >
              ×
            </button>
          )}
        </span>
      ))}

      <button className="mb-tab mb-tab-plus" title="Add a blank page" onClick={() => addPage()}>
        ＋ Page
      </button>
    </div>
  );
}
