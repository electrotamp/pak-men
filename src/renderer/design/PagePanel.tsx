import { useEffect, useState } from 'react';
import { useStore } from '../store.ts';
import { currentPageObj, patchPage, renamePage, setDesign, setStartPage } from './state.ts';
import { SKIN_LAYER_ID, getSkinNatural, skinDefaultSize } from './layout-ops.ts';
import { Color } from './ColorField.tsx';
import { FRAMEBUFFER, type Page } from '../../shared/menu-schema.ts';
import { validateMenuText } from '../../shared/validate.ts';

/** Properties for the current page (shown when nothing on the canvas is selected). */
export function PagePanel() {
  const layout = useStore((s) => s.project?.layout);
  const pageId = useStore((s) => s.design.page);
  const page = currentPageObj(layout, pageId);
  const [idDraft, setIdDraft] = useState(pageId);

  useEffect(() => setIdDraft(pageId), [pageId]);

  if (!page) return <div className="pane-body">No page.</div>;

  const hintErr = page.hint ? validateMenuText(page.hint) : null;
  const bg = page.background ?? '#0C122C';

  async function pickSkin() {
    const file = await window.api.pickFile({
      title: 'Choose a 640×480 background image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
    });
    if (!file) return;
    const name = (file.split(/[\\/]/).pop() || 'page.png').replace(/\.(jpe?g|bmp)$/i, '.png');
    patchPage(pageId, (p) => {
      p.skin = name;
      p.skinHostPath = file;
    });
  }

  return (
    <div className="pane-body">
      <div className="mb-p-titlebar">
        <span className="mb-p-title">{page.title || 'Screen'}</span>
      </div>
      <p className="mb-p-lede">
        Nothing on the canvas is selected, so you're editing the screen itself. Click an element to edit that
        instead.
      </p>

      <h3>Screen</h3>
      <div className="field">
        <label>Title (tab label)</label>
        <input value={page.title} onChange={(e) => patchPage(pageId, (p) => (p.title = e.target.value))} />
      </div>

      <StartToggle pageId={pageId} isStart={!!page.start} />

      <div className="field">
        <label>Page id</label>
        <input
          className="page-id-input"
          value={idDraft}
          onChange={(e) => setIdDraft(e.target.value)}
          onBlur={() => {
            if (idDraft !== pageId) renamePage(pageId, idDraft);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <div className="help">Lowercase letters, digits, “-” and “_”. Renaming repoints existing “Go to page” buttons.</div>
      </div>

      <h3>Background</h3>
      <Color label="Colour" value={bg} onChange={(v) => patchPage(pageId, (p) => (p.background = v))} />
      <div className="help">Shown when there's no background image.</div>

      <div className="field">
        <label>Image (optional)</label>
        <div className="row">
          <input readOnly value={page.skinHostPath ?? page.skin ?? '(none)'} />
          <button onClick={pickSkin}>Choose…</button>
          {page.skin && (
            <button
              onClick={() =>
                patchPage(pageId, (p) => {
                  p.skin = undefined;
                  p.skinHostPath = undefined;
                  p.skinOffset = undefined;
                  p.skinSize = undefined;
                })
              }
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {page.skin && <SkinPlacement pageId={pageId} page={page} />}

      <h3>Hint bar</h3>
      <div className={`field${hintErr ? ' invalid' : ''}`}>
        <label>Text along the bottom</label>
        <input
          value={page.hint ?? ''}
          onChange={(e) => patchPage(pageId, (p) => (p.hint = e.target.value))}
          placeholder="A Select     B Back"
        />
        {hintErr && <div className="err">{hintErr}</div>}
        <div className="help">Leave empty for no hint bar.</div>
      </div>
    </div>
  );
}

function SkinPlacement({ pageId, page }: { pageId: string; page: Page }) {
  const editing = useStore((s) => s.design.skinEdit);
  const custom = !!page.skinSize;
  const [ox, oy] = page.skinOffset ?? [0, 0];
  const [w, h] = page.skinSize ?? skinDefaultSize(getSkinNatural());

  const num = (v: string, fallback: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? n : fallback;
  };
  const setOff = (x: number, y: number) => patchPage(pageId, (p) => (p.skinOffset = [x, y]));
  const setSize = (nw: number, nh: number) =>
    patchPage(pageId, (p) => (p.skinSize = [Math.max(1, nw), Math.max(1, nh)]));

  return (
    <div className="field mb-skin-place">
      <label>Background position &amp; size</label>
      <div className="help">
        By default the image sits at the top-left at its own size (shrunk to fit
        the 640×480 screen if it's larger). Drag and resize it on the canvas, or
        type exact values; the flat colour above shows through any gaps.
      </div>
      <div className="np" style={{ marginTop: 6 }}>
        <button
          className={editing ? 'on' : ''}
          onClick={() =>
            setDesign({ skinEdit: !editing, selected: editing ? [] : [SKIN_LAYER_ID] })
          }
        >
          {editing ? 'Done editing' : 'Move / resize on canvas'}
        </button>
        <button
          disabled={!custom}
          onClick={() => patchPage(pageId, (p) => { p.skinOffset = undefined; p.skinSize = undefined; })}
        >
          Original size
        </button>
        <button
          onClick={() => patchPage(pageId, (p) => { p.skinOffset = [0, 0]; p.skinSize = [FRAMEBUFFER.w, FRAMEBUFFER.h]; })}
        >
          Fill screen
        </button>
      </div>
      <div className="rect-grid" style={{ marginTop: 6 }}>
        <label>X<input type="number" value={ox} onChange={(e) => setOff(num(e.target.value, ox), oy)} /></label>
        <label>Y<input type="number" value={oy} onChange={(e) => setOff(ox, num(e.target.value, oy))} /></label>
        <label>W<input type="number" value={w} onChange={(e) => setSize(num(e.target.value, w), h)} /></label>
        <label>H<input type="number" value={h} onChange={(e) => setSize(w, num(e.target.value, h))} /></label>
      </div>
    </div>
  );
}

function StartToggle({ pageId, isStart }: { pageId: string; isStart: boolean }) {
  return (
    <div className="field">
      <label>Start screen</label>
      <label className="np" title="The screen the console boots to.">
        <input type="checkbox" checked={isStart} disabled={isStart} onChange={() => setStartPage(pageId)} />
        <span style={{ minWidth: 0 }}>This is the screen the console boots to</span>
      </label>
    </div>
  );
}
