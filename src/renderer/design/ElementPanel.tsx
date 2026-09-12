import { useStore } from '../store.ts';
import { patchElement, elementOf, bumpZ, deleteSelected } from './layout-ops.ts';
import { Color } from './ColorField.tsx';
import { fontLabel } from './menu-fonts.ts';
import { validateMenuText } from '../../shared/validate.ts';
import {
  collectionsInLayout,
  gridBoxHeight,
  gridLabelBand,
  SETTING_KEYS,
  SETTING_LABEL,
  ELEMENT_LABEL,
  GRID_MAX_TILES,
  MENU_FONTS,
  SHAPES,
  SHAPE_LABEL,
  shapeAspect,
  nativeFontPx,
  sharpFontSizes,
  BORDER_ALIGNS,
  BORDER_ALIGN_LABEL,
  type Action,
  type ActionKind,
  type Align,
  type BorderAlign,
  type BoxStyle,
  type ButtonElement,
  type Element,
  type FileListElement,
  type Fit,
  type GameListElement,
  type GameSource,
  type ImageElement,
  type InfoPanelElement,
  type ListStyle,
  type Pad,
  type PanelElement,
  type SettingElement,
  type SettingKey,
  type Shape,
  type TextElement,
  type TextStyle,
  type VAlign,
} from '../../shared/menu-schema.ts';

const ACTIONS: { kind: ActionKind; label: string; arg?: 'page' | 'view' | 'key' | 'collection' }[] = [
  { kind: 'none', label: 'Nothing' },
  { kind: 'launch', label: 'Launch selected game' },
  { kind: 'goto', label: 'Go to page…', arg: 'page' },
  { kind: 'back', label: 'Back' },
  { kind: 'open', label: 'Open built-in screen…', arg: 'view' },
  { kind: 'favorite.toggle', label: 'Favourite / un-favourite game…', arg: 'collection' },
  { kind: 'toggleSetting', label: 'Toggle a setting…', arg: 'key' },
  { kind: 'setSetting', label: 'Force a setting on / off…', arg: 'key' },
  { kind: 'runSort', label: 'Sort games A–Z' },
  { kind: 'screensaver', label: 'Start screensaver' },
];
const OPEN_VIEWS = ['settings', 'files', 'history', 'credits', 'controllerpak', 'rtc', 'flashcart', 'sysinfo'];

function Num({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="np">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        // Don't commit while the field is mid-edit (empty / not a number) —
        // that used to clobber e.g. a grid's column count with 0 -> clamped to 1.
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(Math.round(n));
        }}
        onBlur={(e) => {
          if (e.target.value.trim() === '') e.target.value = String(value);
        }}
      />
    </div>
  );
}

export function ElementPanel() {
  const layout = useStore((s) => s.project?.layout);
  const selected = useStore((s) => s.design.selected);

  if (!layout || selected.length !== 1) return null;
  const el = elementOf(layout, selected[0]!);
  if (!el) return null;

  const aspectLocked =
    !!el.aspectLock && !(el.type === 'gameList' && (el as GameListElement).style !== 'grid');

  const setRect = (i: 0 | 1 | 2 | 3, v: number) =>
    patchElement(el.id, (e) => {
      if (aspectLocked && (i === 2 || i === 3)) {
        const ar = e.rect[2] / Math.max(1, e.rect[3]);
        if (i === 2) {
          e.rect[2] = Math.max(1, v);
          e.rect[3] = Math.max(1, Math.round(v / ar));
        } else {
          e.rect[3] = Math.max(1, v);
          e.rect[2] = Math.max(1, Math.round(v * ar));
        }
      } else {
        e.rect[i] = v;
      }
    });

  const DESC: Partial<Record<string, string>> = {
    gameList: 'The games from your card, as a scrolling list or a box-art grid.',
    boxArt: 'The cover of whichever game is highlighted.',
    infoPanel: 'Release date, developer and region for the highlighted game.',
    text: 'A fixed label, heading, or a live clock.',
    image: 'A PNG you supply, drawn over the screen.',
    button: 'Runs an action when it has focus and A is pressed.',
    panel: 'A filled or outlined box — build up the screen chrome with these.',
    setting: 'A focusable on/off row bound to a console setting.',
    fileList: 'Browse the SD card — open folders, launch games, view files.',
  };

  return (
    <div className="pane-body">
      <datalist id="mb-collections">
        {collectionsInLayout(layout).map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="mb-p-titlebar">
        <span className="mb-p-title">{ELEMENT_LABEL[el.type]}</span>
        <button className="mb-p-del" onClick={deleteSelected} title="Delete (Del) — Ctrl+Z to undo">
          Delete
        </button>
      </div>
      {DESC[el.type] && <p className="mb-p-lede">{DESC[el.type]}</p>}

      <h3>Position &amp; size</h3>
      <div className="rect-grid">
        <Num label="X" value={el.rect[0]} onChange={(n) => setRect(0, n)} />
        <Num label="Y" value={el.rect[1]} onChange={(n) => setRect(1, n)} />
        <Num label="W" value={el.rect[2]} onChange={(n) => setRect(2, n)} min={1} />
        <Num label="H" value={el.rect[3]} onChange={(n) => setRect(3, n)} min={1} />
      </div>
      <div className="np" title="Keep the width/height ratio when resizing (like Photoshop's chain link). Handles then need Shift to distort.">
        <span>Lock aspect</span>
        <input
          type="checkbox"
          checked={el.aspectLock ?? false}
          onChange={(e) => patchElement(el.id, (x) => (x.aspectLock = e.target.checked || undefined))}
        />
      </div>
      {el.type !== 'gameList' && el.type !== 'infoPanel' && el.type !== 'fileList' && (
        <Num
          label="Rotation°"
          value={(el as { rotation?: number }).rotation ?? 0}
          onChange={(n) =>
            patchElement(el.id, (x) => ((x as { rotation?: number }).rotation = ((n % 360) + 360) % 360 || undefined))
          }
        />
      )}
      <div className="np">
        <span>Layer</span>
        <button onClick={() => bumpZ(el.id, -1)}>Send back</button>
        <button onClick={() => bumpZ(el.id, 1)}>Bring forward</button>
      </div>

      {(el.type === 'text' || el.type === 'panel') && <TextishFields el={el as TextElement | PanelElement} />}
      {el.type === 'boxArt' && (
        <>
          <h3>Cover</h3>
          <FitField value={(el as { fit: Fit }).fit} onChange={(f) => patchElement(el.id, (e) => ((e as { fit: Fit }).fit = f))} />
          <div className="help">
            The frame defaults to the cover's shape so it fills edge to edge. <b>contain</b> letterboxes,
            <b> cover</b> fills &amp; crops, <b>stretch</b> distorts.
          </div>
          <Color label="Letterbox" value={(el as { bg: string }).bg} onChange={(v) => patchElement(el.id, (e) => ((e as { bg: string }).bg = v))} />
        </>
      )}
      {el.type === 'gameList' && <GameListFields el={el as GameListElement} />}
      {el.type === 'infoPanel' && <InfoFields el={el as InfoPanelElement} />}
      {el.type === 'image' && <ImageFields el={el as ImageElement} />}
      {el.type === 'button' && <ButtonFields el={el as ButtonElement} layout={layout} />}
      {el.type === 'setting' && <SettingFields el={el as SettingElement} />}
      {el.type === 'fileList' && <FileListFields el={el as FileListElement} />}
      {(el.type === 'boxArt' || el.type === 'gameList' || el.type === 'infoPanel' || el.type === 'image') && (
        <OptionalBox el={el} />
      )}
    </div>
  );
}

/* ---- shared: box style + text placement ---- */

function BoxFields({ elId, box }: { elId: string; box: BoxStyle }) {
  const set = (m: (b: BoxStyle) => void) =>
    patchElement(elId, (e) => {
      const x = e as { box?: BoxStyle };
      if (!x.box) x.box = {};
      m(x.box);
    });
  const shape = box.shape ?? 'rect';
  return (
    <>
      <div className="np">
        <span>Shape</span>
        <select
          value={shape}
          onChange={(e) => {
            const next = e.target.value === 'rect' ? undefined : (e.target.value as Shape);
            const aspect = shapeAspect(next);
            patchElement(elId, (el) => {
              const x = el as { box?: BoxStyle; rect?: [number, number, number, number] };
              if (!x.box) x.box = {};
              x.box.shape = next;
              // square the box so a regular polygon / circle isn't squashed
              if (aspect && x.rect) {
                const [rx, ry, rw, rh] = x.rect;
                const s = Math.round(Math.min(rw, rh));
                x.rect = [Math.round(rx + (rw - s) / 2), Math.round(ry + (rh - s) / 2), s, s];
              }
            });
          }}
        >
          {SHAPES.map((s) => (
            <option key={s} value={s}>
              {SHAPE_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="np">
        <span>Fill</span>
        <input
          type="checkbox"
          checked={box.fill != null}
          onChange={(e) => set((b) => (b.fill = e.target.checked ? '#0C122C' : undefined))}
        />
      </div>
      {box.fill != null && <Color label="Fill colour" value={box.fill} onChange={(v) => set((b) => (b.fill = v))} />}
      <div className="np">
        <span>Outline</span>
        <input
          type="number"
          min={0}
          max={32}
          value={box.borderW ?? 0}
          onChange={(e) => {
            const n = Math.max(0, Math.min(32, Math.round(Number(e.target.value))));
            set((b) => {
              b.borderW = n || undefined;
              if (n && !b.border) b.border = '#5A5FB0';
            });
          }}
        />
      </div>
      {(box.borderW ?? 0) > 0 && (
        <>
          <Color label="Outline colour" value={box.border ?? '#5A5FB0'} onChange={(v) => set((b) => (b.border = v))} />
          <div className="np" title="Where the outline sits relative to the shape edge.">
            <span>Outline position</span>
            <select
              value={box.borderAlign ?? 'inside'}
              onChange={(e) =>
                set((b) => (b.borderAlign = e.target.value === 'inside' ? undefined : (e.target.value as BorderAlign)))
              }
            >
              {BORDER_ALIGNS.map((a) => (
                <option key={a} value={a}>
                  {BORDER_ALIGN_LABEL[a]}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      {shape !== 'circle' && shape !== 'ellipse' && (
        <div className="np" title="Rounds a rectangle's corners or a polygon's vertices.">
          <span>Corner rounding</span>
          <input
            type="number"
            min={0}
            max={64}
            value={box.cornerRadius ?? 0}
            onChange={(e) => {
              const n = Math.max(0, Math.min(64, Math.round(Number(e.target.value))));
              set((b) => (b.cornerRadius = n || undefined));
            }}
          />
        </div>
      )}
    </>
  );
}

function OptionalBox({ el }: { el: Element }) {
  const box = 'box' in el ? el.box : undefined;
  return (
    <>
      <h3>Background</h3>
      <div className="np" title="A shaped box drawn behind this element.">
        <span>Show a box</span>
        <input
          type="checkbox"
          checked={!!box}
          onChange={(e) =>
            patchElement(el.id, (x) => {
              (x as { box?: BoxStyle }).box = e.target.checked ? { fill: '#0C122C' } : undefined;
            })
          }
        />
      </div>
      {box && <BoxFields elId={el.id} box={box} />}
    </>
  );
}

function PlacementFields({
  elId,
  el,
  showWrap,
  rotatable,
}: {
  elId: string;
  el: TextStyle;
  showWrap: boolean;
  rotatable: boolean;
}) {
  const set = (m: (x: TextStyle) => void) => patchElement(elId, (e) => m(e as unknown as TextStyle));
  const pad = el.pad ?? [0, 0, 0, 0];
  const setPad = (i: number, v: number) =>
    set((x) => {
      const p = [...(x.pad ?? [0, 0, 0, 0])] as Pad;
      p[i] = Math.max(0, Math.round(v));
      x.pad = p.some((n) => n) ? p : undefined;
    });
  return (
    <>
      <h3>Placement</h3>
      <div className="np">
        <span>Horizontal</span>
        <select value={el.align} onChange={(e) => set((x) => (x.align = e.target.value as Align))}>
          <option value="left">left</option>
          <option value="center">center</option>
          <option value="right">right</option>
        </select>
      </div>
      <div className="np">
        <span>Vertical</span>
        <select value={el.valign} onChange={(e) => set((x) => (x.valign = e.target.value as VAlign))}>
          <option value="top">top</option>
          <option value="middle">middle</option>
          <option value="bottom">bottom</option>
        </select>
      </div>
      {showWrap && (
        <div className="np">
          <span>Wrap</span>
          <input type="checkbox" checked={!!el.wrap} onChange={(e) => set((x) => (x.wrap = e.target.checked))} />
        </div>
      )}
      {rotatable && (
        <>
          <div className="np" title="Text stays screen-horizontal no matter how the element is rotated.">
            <span>Keep upright</span>
            <input
              type="checkbox"
              checked={!!el.keepUpright}
              onChange={(e) => set((x) => (x.keepUpright = e.target.checked || undefined))}
            />
          </div>
          {!el.keepUpright && (
            <Num
              label="Text angle°"
              value={el.textRotation ?? 0}
              onChange={(n) => set((x) => (x.textRotation = (((n % 360) + 360) % 360) || undefined))}
            />
          )}
        </>
      )}
      <div className="rect-grid">
        <Num label="Pad top" value={pad[0]} min={0} onChange={(n) => setPad(0, n)} />
        <Num label="Pad right" value={pad[1]} min={0} onChange={(n) => setPad(1, n)} />
        <Num label="Pad bottom" value={pad[2]} min={0} onChange={(n) => setPad(2, n)} />
        <Num label="Pad left" value={pad[3]} min={0} onChange={(n) => setPad(3, n)} />
      </div>
      <div className="help">Space between the box edge and the text, per side.</div>
    </>
  );
}

/** font family / size / typographic spacing — Text, Panel and Button */
function FontFields({ elId, el }: { elId: string; el: TextStyle }) {
  const set = (m: (x: TextStyle) => void) => patchElement(elId, (e) => m(e as unknown as TextStyle));
  return (
    <>
      <h3>Font</h3>
      <div className="np">
        <span>Family</span>
        <select
          value={el.font ?? ''}
          onChange={(e) => set((x) => (x.font = e.target.value || undefined))}
        >
          <option value="">Default (menu font)</option>
          {MENU_FONTS.map((f) => (
            <option key={f} value={f}>
              {fontLabel(f)}
            </option>
          ))}
        </select>
      </div>
      <Num
        label="Size (px)"
        value={el.fontSize ?? nativeFontPx(el.font)}
        min={1}
        onChange={(n) => set((x) => (x.fontSize = Math.max(1, Math.round(n)) || undefined))}
      />
      <SharpHint size={el.fontSize ?? nativeFontPx(el.font)} font={el.font} />
      <div className="rect-grid">
        <Num
          label="Line height"
          value={el.lineHeight ?? 0}
          min={0}
          onChange={(n) => set((x) => (x.lineHeight = Math.round(n) || undefined))}
        />
        <Num
          label="Letter space"
          value={el.letterSpacing ?? 0}
          min={0}
          onChange={(n) => set((x) => (x.letterSpacing = Math.round(n) || undefined))}
        />
      </div>
      <div className="help">
        Any whole-pixel size works. It renders crispest at the font's baked size and whole
        multiples of it; other sizes are drawn a touch soft. Family, size, letter spacing and
        line height all apply on the console.
      </div>
    </>
  );
}

/** "crisp / soft" marker for the current font size, with the sharp sizes listed. */
function SharpHint({ size, font }: { size: number; font?: string }) {
  const sharp = sharpFontSizes(font);
  const ok = sharp.includes(size);
  return (
    <div className={`help mb-sharp-hint${ok ? ' ok' : ' soft'}`}>
      <b>{ok ? '✓ crisp' : '~ soft'}</b> · sharpest at {sharp.join(' · ')} px
      {font ? '' : ' (menu font)'}
    </div>
  );
}

function FitField({ value, onChange }: { value: Fit; onChange: (f: Fit) => void }) {
  return (
    <div className="np">
      <span>Fit</span>
      <select value={value} onChange={(e) => onChange(e.target.value as Fit)}>
        <option value="contain">contain</option>
        <option value="cover">cover</option>
        <option value="stretch">stretch</option>
      </select>
    </div>
  );
}

function TextishFields({ el }: { el: TextElement | PanelElement }) {
  const err = validateMenuText(el.text);
  const set = (m: (x: TextElement | PanelElement) => void) =>
    patchElement(el.id, (e) => m(e as TextElement | PanelElement));
  const isClock = el.clockFormat != null;
  return (
    <>
      <h3>Text</h3>
      <div className="np" title="Draw the current date/time instead of fixed text.">
        <span>Live clock</span>
        <input
          type="checkbox"
          checked={isClock}
          onChange={(e) => set((x) => (x.clockFormat = e.target.checked ? '%Y-%m-%d   %H:%M' : undefined))}
        />
      </div>
      {isClock ? (
        <div className="field">
          <label>Time format</label>
          <input value={el.clockFormat ?? ''} onChange={(e) => set((x) => (x.clockFormat = e.target.value))} />
          <div className="help">strftime codes — %Y year, %m month, %d day, %H hour, %M minute, %S second.</div>
        </div>
      ) : (
        <div className={`field${err ? ' invalid' : ''}`}>
          <label>Text</label>
          <textarea
            value={el.text}
            placeholder="Leave empty for a plain decorative panel"
            onChange={(e) => set((x) => (x.text = e.target.value))}
          />
          {err && <div className="err">{err}</div>}
          <div className="help">
            Live values: <code>{'{fw_version}'}</code> <code>{'{menu_version}'}</code> <code>{'{cart}'}</code>{' '}
            <code>{'{fav_count}'}</code> <code>{'{history_count}'}</code> <code>{'{date}'}</code>{' '}
            <code>{'{time}'}</code> — filled in on the console.
          </div>
        </div>
      )}
      <Color label="Text colour" value={el.color} onChange={(v) => set((x) => (x.color = v))} />

      <PlacementFields elId={el.id} el={el} showWrap rotatable />
      <FontFields elId={el.id} el={el} />

      <h3>Box</h3>
      <div className="help">The shaped box behind the text. Turn Fill off for a transparent frame.</div>
      <BoxFields elId={el.id} box={el.box ?? {}} />
    </>
  );
}

/** Recompute the grid box height after any tile-metric change. */
function fitGrid(x: GameListElement): void {
  x.rect[3] = gridBoxHeight(x.rect[2], x.gridCols ?? 3, x.gridRows ?? 3, x.gridGap ?? 4, gridLabelBand(x));
}

function GameListFields({ el }: { el: GameListElement }) {
  const set = (m: (x: GameListElement) => void) => patchElement(el.id, (e) => m(e as GameListElement));
  const grid = el.style === 'grid';
  return (
    <>
      <h3>Display</h3>
      <div className="np" title="A scrolling list of names, or a lattice of box-art tiles.">
        <span>Style</span>
        <select
          value={el.style}
          onChange={(e) =>
            set((x) => {
              x.style = e.target.value as ListStyle;
              if (x.style === 'grid') {
                x.gridCols ??= 3;
                x.gridRows ??= 3;
                x.gridGap ??= 4;
                x.aspectLock = true; // covers must not stretch
                fitGrid(x);
              }
            })
          }
        >
          <option value="list">List (scrolling names)</option>
          <option value="grid">Grid (box-art tiles)</option>
        </select>
      </div>
      <div className="field">
        <label>Shows</label>
        <select value={el.source} onChange={(e) => set((x) => (x.source = e.target.value as GameSource))}>
          <option value="all">All games</option>
          <option value="favorites">Favourites</option>
          <option value="history">Recently played</option>
        </select>
        <div className="help">
          Every game on the card, the ones favourited on the console, or the games launched most recently (newest
          first).
        </div>
      </div>
      {el.source === 'favorites' && (
        <div className="field">
          <label>Collection</label>
          <input
            list="mb-collections"
            value={el.collection ?? ''}
            placeholder="all favourites"
            onChange={(e) => set((x) => (x.collection = e.target.value.trim() || undefined))}
          />
          <div className="help">
            Blank = every favourite. A name (e.g. <b>mario</b>) shows only that collection — favourite buttons can add
            straight into it.
          </div>
        </div>
      )}
      {grid ? (
        <>
          <div className="rect-grid">
            <Num
              label="Columns"
              value={el.gridCols ?? 4}
              min={1}
              max={GRID_MAX_TILES}
              onChange={(n) =>
                set((x) => {
                  const cols = Math.min(Math.max(1, n), GRID_MAX_TILES);
                  x.gridCols = cols;
                  // keep cols * rows within the firmware's cover-array ceiling
                  if (cols * (x.gridRows ?? 3) > GRID_MAX_TILES)
                    x.gridRows = Math.max(1, Math.floor(GRID_MAX_TILES / cols));
                  fitGrid(x);
                })
              }
            />
            <Num
              label="Rows"
              value={el.gridRows ?? 3}
              min={1}
              max={GRID_MAX_TILES}
              onChange={(n) =>
                set((x) => {
                  const cols = x.gridCols ?? 3;
                  const rows = Math.min(Math.max(1, n), Math.max(1, Math.floor(GRID_MAX_TILES / cols)));
                  x.gridRows = rows;
                  fitGrid(x);
                })
              }
            />
            <Num
              label="Tile gap"
              value={el.gridGap ?? 4}
              min={0}
              onChange={(n) =>
                set((x) => {
                  x.gridGap = n;
                  fitGrid(x);
                })
              }
            />
          </div>
          <div className="help">
            {(el.gridCols ?? 4) * (el.gridRows ?? 3)} tiles, max {GRID_MAX_TILES}. Every tile is exactly box-art
            shaped — resize the box to resize the tiles; the height follows the columns / rows / gap. 0 gap =
            touching.
          </div>
          <div className="np" title="Show each tile's game name. Off = art-only tiles (default).">
            <span>Name labels</span>
            <input
              type="checkbox"
              checked={el.gridLabels ?? false}
              onChange={(e) =>
                set((x) => {
                  x.gridLabels = e.target.checked || undefined;
                  fitGrid(x);
                })
              }
            />
          </div>
          {el.gridLabels && (
            <>
              <div className="field">
                <label>Label position</label>
                <select
                  value={el.gridLabelPos ?? 'bottom'}
                  onChange={(e) =>
                    set((x) => {
                      x.gridLabelPos = e.target.value as 'top' | 'bottom' | 'overlay';
                      fitGrid(x);
                    })
                  }
                >
                  <option value="bottom">Below the cover</option>
                  <option value="top">Above the cover</option>
                  <option value="overlay">Over the cover (bottom strip)</option>
                </select>
              </div>
              <div className="np" title="Wrap long names to two lines, or keep one line and marquee-scroll.">
                <span>Wrap long names</span>
                <input
                  type="checkbox"
                  checked={el.gridLabelWrap ?? true}
                  onChange={(e) => set((x) => (x.gridLabelWrap = e.target.checked ? undefined : false))}
                />
              </div>
              <div className="help">
                Unwrapped names that don't fit scroll sideways on the console. Box-art tiles keep their exact
                shape; the label sits in a fixed band so rows stay aligned.
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="rect-grid">
            <Num label="Row H" value={el.rowH} min={1} onChange={(n) => set((x) => (x.rowH = n))} />
            <Num label="Pad L" value={el.textPadL} onChange={(n) => set((x) => (x.textPadL = n))} />
            <Num label="Pad R" value={el.textPadR} onChange={(n) => set((x) => (x.textPadR = n))} />
            <Num label="Text dY" value={el.textDy} onChange={(n) => set((x) => (x.textDy = n))} />
          </div>
          <div className="help">Rows shown = box H ÷ Row H. Resize the box to show more or fewer.</div>
        </>
      )}
      <h3>Colour</h3>
      <Color label="Highlight" value={el.highlight} onChange={(v) => set((x) => (x.highlight = v))} />
      <Color label="Text colour" value={el.textColor} onChange={(v) => set((x) => (x.textColor = v))} />
    </>
  );
}

function InfoFields({ el }: { el: InfoPanelElement }) {
  const set = (m: (x: InfoPanelElement) => void) => patchElement(el.id, (e) => m(e as InfoPanelElement));
  return (
    <>
      <h3>Rows</h3>
      <div className="rect-grid">
        <Num label="Row H" value={el.rowH} min={1} onChange={(n) => set((x) => (x.rowH = n))} />
        <Num label="Label W" value={el.labelW} onChange={(n) => set((x) => (x.labelW = n))} />
        <Num label="Baseline dY" value={el.baselineDy} onChange={(n) => set((x) => (x.baselineDy = n))} />
      </div>
      {el.labels.map((lbl, i) => (
        <div className="field" key={i}>
          <label>Row {i + 1} label</label>
          <input value={lbl} onChange={(e) => set((x) => (x.labels[i] = e.target.value))} />
        </div>
      ))}
      <div className="help">
        A blank label hides that row entirely — no gap left behind. Only Released, Developer and Region have
        data today; the other two are for custom metadata.
      </div>
      <h3>Colour</h3>
      <Color label="Label colour" value={el.labelColor} onChange={(v) => set((x) => (x.labelColor = v))} />
      <Color label="Value colour" value={el.valueColor} onChange={(v) => set((x) => (x.valueColor = v))} />
    </>
  );
}

function ImageFields({ el }: { el: ImageElement }) {
  const set = (m: (x: ImageElement) => void) => patchElement(el.id, (e) => m(e as ImageElement));
  async function pick() {
    const file = await window.api.pickFile({
      title: 'Choose an image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
    });
    if (!file) return;
    const name = (file.split(/[\\/]/).pop() || 'image.png').replace(/\.(jpe?g|bmp)$/i, '.png');
    set((x) => {
      x.src = name;
      x.srcHostPath = file;
    });
  }
  return (
    <>
      <h3>Image</h3>
      <div className="field">
        <label>Source file</label>
        <div className="row">
          <input readOnly value={el.srcHostPath ?? el.src ?? '(none)'} />
          <button onClick={pick}>Choose…</button>
        </div>
        <div className="help">Copied onto the card on export (shrunk to fit 512×512).</div>
      </div>
      <FitField value={el.fit} onChange={(f) => set((x) => (x.fit = f))} />
    </>
  );
}

function ButtonFields({ el, layout }: { el: ButtonElement; layout: { pages: { id: string; title: string }[] } }) {
  const set = (m: (x: ButtonElement) => void) => patchElement(el.id, (e) => m(e as ButtonElement));
  const setAction = (m: (a: Action) => void) => set((x) => m(x.action));
  const spec = ACTIONS.find((a) => a.kind === el.action.kind);
  const err = validateMenuText(el.label);
  return (
    <>
      <h3>Label</h3>
      <div className={`field${err ? ' invalid' : ''}`}>
        <label>Text</label>
        <input value={el.label} onChange={(e) => set((x) => (x.label = e.target.value))} />
        {err && <div className="err">{err}</div>}
      </div>
      <div className="field">
        <label>Control glyph (optional)</label>
        <input value={el.glyph ?? ''} maxLength={3} onChange={(e) => set((x) => (x.glyph = e.target.value || undefined))} />
        <div className="help">A single letter shown before the label, e.g. A / B / Z.</div>
      </div>

      <h3>Appearance</h3>
      <Color label="Label colour" value={el.color} onChange={(v) => set((x) => (x.color = v))} />

      <PlacementFields
        elId={el.id}
        el={{ ...el, align: el.align ?? 'center', valign: el.valign ?? 'middle', wrap: el.wrap ?? false }}
        showWrap={false}
        rotatable
      />
      <FontFields elId={el.id} el={el} />

      <h3>Box</h3>
      <BoxFields elId={el.id} box={el.box ?? { fill: '#0C122C' }} />

      <h3>Action</h3>
      <div className="np" title="Whether the D-pad can land on this button.">
        <span>Focusable</span>
        <input
          type="checkbox"
          checked={el.focusable ?? true}
          onChange={(e) => set((x) => (x.focusable = e.target.checked ? undefined : false))}
        />
      </div>
      <div className="field">
        <label>When pressed</label>
        <select
          value={el.action.kind}
          onChange={(e) =>
            setAction((a) => {
              a.kind = e.target.value as ActionKind;
              a.page = a.view = a.key = a.collection = undefined;
              a.value = e.target.value === 'setSetting' ? 1 : undefined;
            })
          }
        >
          {ACTIONS.map((a) => (
            <option key={a.kind} value={a.kind}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      {spec?.arg === 'page' && (
        <div className="np">
          <span>Page</span>
          <select value={el.action.page ?? layout.pages[0]?.id} onChange={(e) => setAction((a) => (a.page = e.target.value))}>
            {layout.pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      )}
      {spec?.arg === 'view' && (
        <div className="np">
          <span>Screen</span>
          <select value={el.action.view ?? 'settings'} onChange={(e) => setAction((a) => (a.view = e.target.value))}>
            {OPEN_VIEWS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      )}
      {spec?.arg === 'key' && (
        <div className="field">
          <label>Setting key</label>
          <input value={el.action.key ?? ''} onChange={(e) => setAction((a) => (a.key = e.target.value))} placeholder="grid_square_tiles" />
        </div>
      )}
      {el.action.kind === 'setSetting' && (
        <div className="np">
          <span>Set to</span>
          <select
            value={el.action.value ? '1' : '0'}
            onChange={(e) => setAction((a) => (a.value = e.target.value === '1' ? 1 : 0))}
          >
            <option value="1">On</option>
            <option value="0">Off</option>
          </select>
        </div>
      )}
      {spec?.arg === 'collection' && (
        <div className="field">
          <label>Collection</label>
          <input
            list="mb-collections"
            value={el.action.collection ?? ''}
            placeholder="ask on the console"
            onChange={(e) => setAction((a) => (a.collection = e.target.value.trim() || undefined))}
          />
          <div className="help">
            Blank = the console pops up a list of collections to choose from. A name adds/removes straight into that one.
          </div>
        </div>
      )}
    </>
  );
}

function SettingFields({ el }: { el: SettingElement }) {
  const set = (m: (x: SettingElement) => void) => patchElement(el.id, (e) => m(e as SettingElement));
  return (
    <>
      <h3>Setting</h3>
      <div className="field">
        <label>Controls</label>
        <select
          value={el.settingKey}
          onChange={(e) =>
            set((x) => {
              const k = e.target.value as SettingKey;
              // keep the caption in sync if the user hadn't customised it
              if (x.label === SETTING_LABEL[x.settingKey]) x.label = SETTING_LABEL[k];
              x.settingKey = k;
            })
          }
        >
          {SETTING_KEYS.map((k) => (
            <option key={k} value={k}>
              {SETTING_LABEL[k]}
            </option>
          ))}
        </select>
        <div className="help">Pressing A on this row toggles the setting on the console and saves it.</div>
      </div>
      <div className="field">
        <label>Caption</label>
        <input value={el.label} onChange={(e) => set((x) => (x.label = e.target.value))} />
      </div>
      <div className="rect-grid">
        <div className="field">
          <label>On text</label>
          <input
            value={el.onText ?? ''}
            placeholder="ON"
            onChange={(e) => set((x) => (x.onText = e.target.value || undefined))}
          />
        </div>
        <div className="field">
          <label>Off text</label>
          <input
            value={el.offText ?? ''}
            placeholder="OFF"
            onChange={(e) => set((x) => (x.offText = e.target.value || undefined))}
          />
        </div>
      </div>

      <h3>Appearance</h3>
      <Color label="Caption colour" value={el.color} onChange={(v) => set((x) => (x.color = v))} />
      <Color
        label="Value colour"
        value={el.valueColor ?? el.color}
        onChange={(v) => set((x) => (x.valueColor = v))}
      />
      <PlacementFields
        elId={el.id}
        el={{ ...el, align: el.align ?? 'left', valign: el.valign ?? 'middle', wrap: false }}
        showWrap={false}
        rotatable
      />
      <FontFields elId={el.id} el={el} />

      <h3>Box</h3>
      <BoxFields elId={el.id} box={el.box ?? { fill: '#1B2440' }} />
    </>
  );
}

function FileListFields({ el }: { el: FileListElement }) {
  const set = (m: (x: FileListElement) => void) => patchElement(el.id, (e) => m(e as FileListElement));
  return (
    <>
      <h3>Browser</h3>
      <div className="field">
        <label>Start folder</label>
        <input
          value={el.root}
          onChange={(e) => set((x) => (x.root = e.target.value || 'sd:/'))}
          placeholder="sd:/"
        />
        <div className="help">Where it opens. Use <code>sd:/</code> for the card root or e.g. <code>sd:/ROMS</code>.</div>
      </div>
      <Num label="Row height" value={el.rowH} min={8} onChange={(n) => set((x) => (x.rowH = n))} />
      <div className="np" title="Show a file-size column on the right.">
        <span>File sizes</span>
        <input
          type="checkbox"
          checked={el.showSize ?? false}
          onChange={(e) => set((x) => (x.showSize = e.target.checked || undefined))}
        />
      </div>
      <div className="np" title="Let the player delete / rename / move files from this element.">
        <span>Allow file management</span>
        <input
          type="checkbox"
          checked={el.manage ?? false}
          onChange={(e) => set((x) => (x.manage = e.target.checked || undefined))}
        />
      </div>
      <div className="help">
        Management (delete, rename, move, extract) lives behind a mode toggle on the console, so it is
        never a stray button-press away.
      </div>

      <h3>Colour</h3>
      <Color label="File rows" value={el.fg} onChange={(v) => set((x) => (x.fg = v))} />
      <Color label="Folders" value={el.dirColor} onChange={(v) => set((x) => (x.dirColor = v))} />
      <Color label="Games" value={el.romColor} onChange={(v) => set((x) => (x.romColor = v))} />
      <Color label="Highlight" value={el.highlight} onChange={(v) => set((x) => (x.highlight = v))} />
      <Color label="Background" value={el.bg} onChange={(v) => set((x) => (x.bg = v))} />

      <h3>Box</h3>
      <BoxFields elId={el.id} box={el.box ?? { fill: '#0C122C' }} />
    </>
  );
}

void ((): Element | null => null);
