import { useEffect } from 'react';
import { useStore, clampZoom, zoomStep, ZOOM_STEPS } from '../store.ts';
import { Canvas } from './Canvas.tsx';
import { ElementPanel } from './ElementPanel.tsx';
import { PagePanel } from './PagePanel.tsx';
import { PageTabs } from '../shell/PageTabs.tsx';
import { ensureLayout, setDesign, undo, redo, resetHistory, currentPageObj } from './state.ts';
import { SKIN_LAYER_ID } from './layout-ops.ts';
import { ELEMENT_LABEL, elementById } from '../../shared/menu-schema.ts';

function nearestStep(z: number): number {
  const hit = ZOOM_STEPS.find((s) => Math.abs(s - z) < 0.005);
  return hit ?? z;
}

export function DesignTab() {
  const design = useStore((s) => s.design);
  const layout = useStore((s) => s.project?.layout);

  const pageId = design.page;
  const page = currentPageObj(layout, pageId);
  const custom = !!page;

  const sel = design.selected;
  const only = sel.length === 1 ? sel[0]! : null;
  const skinSelected = only === SKIN_LAYER_ID;
  const selEl = only && page ? elementById(page, only) : undefined;

  const zoom = design.zoomFit ? design.fitZoom : design.zoom;
  const setZoom = (z: number) => setDesign({ zoom: clampZoom(z), zoomFit: false });

  useEffect(() => {
    ensureLayout();
    resetHistory();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // let a focused text field keep its own native undo/redo
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!e.ctrlKey && !e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (k === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!page?.skin && design.skinEdit) setDesign({ skinEdit: false });
  }, [page?.skin, design.skinEdit]);

  let title = 'Screen';
  let body: React.ReactNode;
  if (skinSelected) {
    title = 'Background image';
    body = <PagePanel />;
  } else if (selEl) {
    title = ELEMENT_LABEL[selEl.type];
    body = <ElementPanel />;
  } else if (sel.length > 1) {
    title = `${sel.length} elements`;
    body = <div className="mb-props-empty">{sel.length} elements selected — drag or arrow-key to move them together.</div>;
  } else {
    title = page ? page.title : 'Screen';
    body = <PagePanel />;
  }

  return (
    <>
      <div className="pane mb-canvas-pane">
        <PageTabs />

        <div className="mb-canvas-stage">
          <Canvas />
          {custom && (
            <div className="mb-zoom-pill">
              <button onClick={() => setZoom(zoomStep(zoom, -1))} title="Zoom out (Ctrl+−)">−</button>
              <select
                value={design.zoomFit ? 'fit' : String(nearestStep(design.zoom))}
                onChange={(e) =>
                  e.target.value === 'fit' ? setDesign({ zoomFit: true }) : setZoom(Number(e.target.value))
                }
                title="Canvas zoom"
              >
                <option value="fit">Fit</option>
                {!design.zoomFit && !ZOOM_STEPS.includes(nearestStep(design.zoom) as never) && (
                  <option value={String(design.zoom)}>{Math.round(design.zoom * 100)}%</option>
                )}
                {ZOOM_STEPS.map((z) => (
                  <option key={z} value={z}>
                    {Math.round(z * 100)}%
                  </option>
                ))}
              </select>
              <button onClick={() => setZoom(zoomStep(zoom, 1))} title="Zoom in (Ctrl+=)">＋</button>
            </div>
          )}
        </div>
      </div>

      <div className="pane mb-props">
        <div className="mb-props-head">
          <span className="t">{title}</span>
          {(selEl || skinSelected) && <span className="mb-props-badge">selected</span>}
        </div>
        <div
          className="mb-props-body"
          onPointerDown={(e) => {
            // clicking the neutral space between controls does nothing and
            // drops focus out of whatever field you were editing
            if (!(e.target as HTMLElement).closest('input, select, textarea, button, [contenteditable]')) {
              (document.activeElement as HTMLElement | null)?.blur();
            }
          }}
        >
          {body}
        </div>
      </div>
    </>
  );
}
