import { useEffect, useState, type CSSProperties } from 'react';
import {
  BOXART_ASPECT,
  cornerRadiusCss,
  GRID_LABEL_BAND,
  gridLabelBand,
  type Align,
  type BoxStyle,
  type Element,
  type FileListElement,
  type GameListElement,
  type InfoPanelElement,
  type Shape,
  type TextStyle,
} from '../../shared/menu-schema.ts';
import { fetchArtInfo } from '../hooks.ts';
import {
  BUILTIN_NATIVE_PX,
  BUILTIN_UI_FONT,
  ensureMenuFontFaces,
  fontFamily,
  menuTextPx,
} from './menu-fonts.ts';
import { SAMPLE_GAMES } from './sample-games.ts';

ensureMenuFontFaces();

/** The console's built-in UI font (PixelMplus12-Bold), real face + metrics. */
const FONT = BUILTIN_UI_FONT;

const SAMPLE_ROWS = SAMPLE_GAMES.map((g) => g.title);
const SAMPLE_INFO = ['1996-09-29', 'Nintendo EAD', 'NTSC', 'Sample', 'Sample'];

/** Front-cover art:// URLs for the sample games, resolved once and cached. */
const artCache = new Map<string, string | null>();
function useSampleArt(): Map<string, string | null> {
  const [, bump] = useState(0);
  useEffect(() => {
    let live = true;
    const missing = SAMPLE_GAMES.filter((g) => !artCache.has(g.code));
    if (missing.length === 0) return;
    Promise.all(
      missing.map((g) =>
        fetchArtInfo(g.code).then((i) => artCache.set(g.code, i.url.front ?? i.url.box3d ?? null)),
      ),
    ).then(() => {
      if (live) bump((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, []);
  return artCache;
}

function Cover({
  code,
  px,
  size,
  fit = 'cover',
}: {
  code: string;
  px: (n: number) => number;
  size: number;
  fit?: 'contain' | 'cover' | 'stretch';
}) {
  const art = useSampleArt();
  const url = art.get(code);
  if (url) {
    return (
      <img
        src={url}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: fit === 'stretch' ? 'fill' : fit }}
      />
    );
  }
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg,#3a4a8a,#1a2340)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9fb0e0',
        fontFamily: FONT,
        fontSize: px(size),
      }}
    >
      cover
    </div>
  );
}

/** rough strftime on a fixed sample time, so a clock element previews as it
 *  will read on the console (Sat 06 Sep 2026, 14:20:07). */
/** Live `{token}` values are only known on the console — preview with plausible
 *  stand-ins so the designer sees roughly what fits. Mirrors menu_tokens.c. */
const TOKEN_SAMPLES: Record<string, string> = {
  fw_version: '2.20.2',
  menu_version: '3.0',
  menu_base: 'V0.3.2',
  libdragon: 'v16',
  cart: 'SummerCart64',
  fav_count: '12',
  history_count: '8',
  date: '2026-09-06',
  time: '14:20',
};
function sampleTokens(s: string): string {
  return s.replace(/\{([a-z_]+)\}/g, (m, name) => TOKEN_SAMPLES[name] ?? m);
}

function sampleStrftime(fmt: string): string {
  const map: Record<string, string> = {
    Y: '2026', y: '26', m: '09', d: '06', H: '14', M: '20', S: '07', I: '02', p: 'PM',
    a: 'Sat', A: 'Saturday', b: 'Sep', B: 'September', j: '249', e: ' 6',
  };
  return fmt.replace(/%([A-Za-z%])/g, (_, c) => (c === '%' ? '%' : map[c] ?? ''));
}

const just = (a: Align): CSSProperties['justifyContent'] =>
  a === 'left' ? 'flex-start' : a === 'right' ? 'flex-end' : 'center';

function radiusPx(r: number | undefined, px: (n: number) => number): string {
  return cornerRadiusCss(r, undefined)
    .split(' ')
    .map((v) => (v === '0' ? '0' : `${px(parseFloat(v))}px`))
    .join(' ');
}

/* ---------------------------------------------------------------- box shape */

/** Vertices of a regular N-gon (vertex 0 at top-centre, rotated by `rot`),
 *  scaled so the polygon's own bounding box fills the element box 0..100 — a
 *  triangle's base spans the full width, a hexagon touches all four edges, etc. */
function polyPoints(sides: number, rot: number): Array<[number, number]> {
  const raw: Array<[number, number]> = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (2 * Math.PI * i) / sides - Math.PI / 2;
    raw.push([Math.cos(a), Math.sin(a)]);
  }
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const minx = Math.min(...xs);
  const miny = Math.min(...ys);
  const sx = 100 / (Math.max(...xs) - minx || 1);
  const sy = 100 / (Math.max(...ys) - miny || 1);
  return raw.map(([x, y]) => [(x - minx) * sx, (y - miny) * sy]);
}

const POLY_SIDES: Partial<Record<Shape, [number, number]>> = {
  triangle: [3, 0],
  diamond: [4, 0],
  pentagon: [5, 0],
  hexagon: [6, Math.PI / 6],
  octagon: [8, Math.PI / 8],
};

/** rounded-corner SVG path through `pts` (percent coords), corner radius `r` %. */
function roundedPolyPath(pts: Array<[number, number]>, r: number): string {
  const n = pts.length;
  if (r <= 0) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ') + ' Z';
  let d = '';
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[(i - 1 + n) % n] ?? [0, 0];
    const [x1, y1] = pts[i] ?? [0, 0];
    const [x2, y2] = pts[(i + 1) % n] ?? [0, 0];
    const v1x = x0 - x1, v1y = y0 - y1, v2x = x2 - x1, v2y = y2 - y1;
    const l1 = Math.hypot(v1x, v1y) || 1;
    const l2 = Math.hypot(v2x, v2y) || 1;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = x1 + (v1x / l1) * rr, ay = y1 + (v1y / l1) * rr;
    const bx = x1 + (v2x / l2) * rr, by = y1 + (v2y / l2) * rr;
    d += `${i ? 'L' : 'M'}${ax.toFixed(2)} ${ay.toFixed(2)} Q${x1.toFixed(2)} ${y1.toFixed(2)} ${bx.toFixed(2)} ${by.toFixed(2)} `;
  }
  return d + 'Z';
}

/** True when the box's outline extends past the element rect (so the canvas
 *  wrapper must not clip it). */
export function boxOverflows(box: BoxStyle | undefined): boolean {
  return !!box && (box.borderW ?? 0) > 0 && (box.borderAlign ?? 'inside') !== 'inside';
}

function inset(px: (n: number) => number, grow: number): CSSProperties {
  return { position: 'absolute', top: px(-grow), left: px(-grow), right: px(-grow), bottom: px(-grow) };
}

function BoxLayer({ box, px }: { box: BoxStyle; px: (n: number) => number }) {
  const shape = box.shape ?? 'rect';
  const bw = box.borderW ?? 0;
  const fill = box.fill ?? 'transparent';
  const stroke = bw > 0 && box.border ? box.border : 'none';
  const align = box.borderAlign ?? 'inside';

  const poly = POLY_SIDES[shape];
  if (poly) {
    // SVG strokes are centred on the path, so grow/shrink the box by half the
    // stroke to land the outline inside / outside / astride the rect edge.
    const grow = bw > 0 ? (align === 'outside' ? bw / 2 : align === 'inside' ? -bw / 2 : 0) : 0;
    const [sides, baseRot] = poly;
    const d = roundedPolyPath(polyPoints(sides, baseRot), Math.max(0, box.cornerRadius ?? 0) / 2);
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ ...inset(px, grow), overflow: 'visible' }}>
        <path
          d={d}
          fill={fill}
          stroke={stroke}
          strokeWidth={bw > 0 && box.border ? px(bw) : 0}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  // box-sizing:border-box keeps the border inside the element; growing the div
  // pushes it out. inside: grow 0. outside: grow bw. center: grow bw/2.
  const grow = bw > 0 && align !== 'inside' ? (align === 'outside' ? bw : bw / 2) : 0;
  const round =
    shape === 'circle' || shape === 'ellipse' ? '50%' : radiusPx(box.cornerRadius, px);
  return (
    <div
      style={{
        ...inset(px, grow),
        background: fill,
        border: bw > 0 && box.border ? `${px(bw)}px solid ${box.border}` : undefined,
        borderRadius: round,
        boxSizing: 'border-box',
      }}
    />
  );
}

/* ---------------------------------------------------------------- text placement */

type Placeable = TextStyle;

/** the box that holds the text — inset by padding, aligned, clipped */
function placedStyle(p: Placeable, px: (n: number) => number): CSSProperties {
  const [t, r, b, l] = p.pad ?? [0, 0, 0, 0];
  return {
    position: 'absolute',
    top: px(t),
    right: px(r),
    bottom: px(b),
    left: px(l),
    display: 'flex',
    alignItems: p.valign === 'top' ? 'flex-start' : p.valign === 'bottom' ? 'flex-end' : 'center',
    justifyContent: just(p.align),
    overflow: 'hidden',
  };
}

/** The font's natural line pitch (`line-height: normal`) in px, at a given size —
 *  the same metric the firmware's baked `.font64` carries (mkfont reads it from
 *  the same TTF tables). Measured once per font+size and cached; the cache is
 *  cleared when the web-fonts finish loading so a cold first paint self-corrects.
 *  All measurement goes through one reused off-screen node — never appends or
 *  removes nodes from the document during a React render. */
const nlhCache = new Map<string, number>();
let nlhProbe: HTMLSpanElement | null = null;
if (typeof document !== 'undefined' && document.fonts)
  void document.fonts.ready.then(() => nlhCache.clear());
function naturalLineHeight(font: string | undefined, sizePx: number): number {
  const key = `${font ?? ''}@${sizePx}`;
  const hit = nlhCache.get(key);
  if (hit != null) return hit;
  if (typeof document === 'undefined') return sizePx * 1.1;
  if (!nlhProbe) {
    nlhProbe = document.createElement('span');
    nlhProbe.setAttribute('aria-hidden', 'true');
    nlhProbe.style.cssText =
      'position:absolute;left:-9999px;top:-9999px;visibility:hidden;white-space:pre;line-height:normal';
    nlhProbe.textContent = 'Hg';
    (document.body ?? document.documentElement).appendChild(nlhProbe);
  }
  nlhProbe.style.fontFamily = fontFamily(font, FONT);
  nlhProbe.style.fontSize = `${sizePx}px`;
  const v = nlhProbe.getBoundingClientRect().height || sizePx * 1.1;
  nlhCache.set(key, v);
  return v;
}

/** the text run itself — font, rotation, wrap. `size` is the true hardware px
    (explicit fontSize, else the font's native baked size). */
function textRunStyle(p: Placeable, rotation: number, px: (n: number) => number): CSSProperties {
  const spin = p.keepUpright ? -rotation : p.textRotation ?? 0;
  const size = menuTextPx(p.fontSize, p.font);
  return {
    fontFamily: fontFamily(p.font, FONT),
    fontSize: px(size),
    // the console adds `line height` on top of the font's own line pitch (like
    // letter spacing) — 0 means "the font's natural spacing". Match that exactly.
    lineHeight: `${px(naturalLineHeight(p.font, size) + (p.lineHeight ?? 0))}px`,
    letterSpacing: p.letterSpacing ? px(p.letterSpacing) : undefined,
    color: p.color,
    textAlign: p.align,
    // explicit newlines always break; auto-wrap only when Wrap is on
    whiteSpace: p.wrap ? 'pre-wrap' : 'pre',
    wordBreak: p.wrap ? 'break-word' : 'normal',
    transform: spin ? `rotate(${spin}deg)` : undefined,
  };
}

/* ---------------------------------------------------------------- element view */

export function ElementView({ el, px }: { el: Element; px: (n: number) => number }) {
  const bg = 'box' in el && el.box ? <BoxLayer box={el.box} px={px} /> : null;
  const rot = 'rotation' in el ? el.rotation ?? 0 : 0;

  switch (el.type) {
    case 'text':
    case 'panel': {
      const content = el.clockFormat
        ? sampleStrftime(el.clockFormat)
        : el.text
          ? sampleTokens(el.text)
          : el.type === 'text'
            ? '(empty text)'
            : '';
      return (
        <>
          {bg}
          {content !== '' && (
            <div style={placedStyle(el, px)}>
              <span style={textRunStyle(el, rot, px)}>{content}</span>
            </div>
          )}
        </>
      );
    }

    case 'boxArt':
      return (
        <>
          {bg}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: el.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
              <Cover code={SAMPLE_GAMES[0]!.code} px={px} size={11} fit={el.fit} />
            </div>
          </div>
        </>
      );

    case 'gameList':
      return (
        <>
          {bg}
          <GameListView el={el} px={px} />
        </>
      );

    case 'fileList':
      return (
        <>
          {bg}
          <FileListView el={el} px={px} />
        </>
      );

    case 'infoPanel':
      return (
        <>
          {bg}
          <InfoPanelView el={el} px={px} />
        </>
      );

    case 'image': {
      // srcHostPath is set once a file is picked / on SD import. A template /
      // theme instead points src at the bundled art library ("boxart/<CODE>/
      // <type>.png") — resolve that to the baked-art protocol so the packaged
      // app shows it, not just the dev preview. Any other bare src is a dev-only
      // example asset.
      const bx = /(?:^|[\\/])boxart[\\/]([A-Za-z0-9]{2,4})[\\/]([a-z0-9]+)\.png$/i.exec(el.src ?? '');
      const url = el.srcHostPath
        ? window.api.artUrlForFile(el.srcHostPath)
        : import.meta.env.DEV && el.src
          ? window.api.artUrlForFile(el.src)
          : bx
            ? `art://baked/${bx[1]!.toUpperCase()}/${bx[2]!.toLowerCase()}`
            : null;
      return (
        <>
          {bg}
          {url ? (
            <img
              src={url}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: el.fit === 'stretch' ? 'fill' : el.fit,
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(32,36,48,0.75)',
                color: '#8a92a8',
                fontFamily: FONT,
                fontSize: px(10),
              }}
            >
              no image
            </div>
          )}
        </>
      );
    }

    case 'button': {
      const box: BoxStyle = el.box ?? { fill: '#0C122C' };
      const ts: TextStyle = {
        color: el.color ?? '#E7E9EF',
        align: el.align ?? 'center',
        valign: el.valign ?? 'middle',
        wrap: false,
        pad: el.pad,
        font: el.font,
        fontSize: el.fontSize,
        lineHeight: el.lineHeight,
        letterSpacing: el.letterSpacing,
        textRotation: el.textRotation,
        keepUpright: el.keepUpright,
      };
      return (
        <>
          <BoxLayer box={box} px={px} />
          <div style={placedStyle(ts, px)}>
            <span style={{ ...textRunStyle(ts, rot, px), display: 'inline-flex', gap: px(6), alignItems: 'center' }}>
              {el.glyph && <b style={{ opacity: 0.85 }}>{el.glyph}</b>}
              {sampleTokens(el.label)}
            </span>
          </div>
        </>
      );
    }

    case 'setting': {
      const box: BoxStyle = el.box ?? { fill: '#1B2440' };
      const ts: TextStyle = {
        color: el.color ?? '#E7E9EF',
        align: el.align ?? 'left',
        valign: el.valign ?? 'middle',
        wrap: false,
        pad: el.pad,
        font: el.font,
        fontSize: el.fontSize,
        lineHeight: el.lineHeight,
        letterSpacing: el.letterSpacing,
      };
      // preview shows the "on" state so both colours are visible
      const value = el.onText || 'ON';
      return (
        <>
          <BoxLayer box={box} px={px} />
          <div style={{ ...placedStyle(ts, px), justifyContent: 'space-between' }}>
            <span style={textRunStyle(ts, 0, px)}>{el.label}</span>
            <span style={{ ...textRunStyle(ts, 0, px), color: el.valueColor ?? el.color ?? '#5EE6D0' }}>{value}</span>
          </div>
        </>
      );
    }

    default:
      return null;
  }
}

function GameListView({ el, px }: { el: GameListElement; px: (n: number) => number }) {
  if (el.style === 'grid') {
    const cols = el.gridCols ?? 4;
    const rows = el.gridRows ?? 3;
    const gap = el.gridGap ?? 4;
    const band = gridLabelBand(el);
    const labels = el.gridLabels ?? false;
    const pos = el.gridLabelPos ?? 'bottom';
    const wrap = el.gridLabelWrap ?? true;
    const tileW = (el.rect[2] - (cols - 1) * gap) / cols;
    const artH = tileW / BOXART_ASPECT;
    const cellH = artH + band;
    const tiles = Math.min(cols * rows, SAMPLE_GAMES.length);

    const nameStyle: CSSProperties = {
      fontFamily: FONT,
      fontSize: px(BUILTIN_NATIVE_PX),
      lineHeight: 1.05,
      color: el.textColor,
      textAlign: 'center',
      overflow: 'hidden',
      ...(wrap
        ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }
        : { whiteSpace: 'nowrap', textOverflow: 'ellipsis' }),
    };

    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: tiles }).map((_, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cellLeft = px(col * (tileW + gap));
          const cellTop = px(row * (cellH + gap));
          const artTop = pos === 'top' && band ? band : 0;
          const name = SAMPLE_GAMES[i]!.title;
          return (
            <div key={i} style={{ position: 'absolute', left: cellLeft, top: cellTop, width: px(tileW), height: px(cellH) }}>
              <div
                style={{
                  position: 'absolute',
                  top: px(artTop),
                  width: px(tileW),
                  height: px(artH),
                  outline: i === 0 ? `${Math.max(1, px(2))}px solid ${el.highlight}` : undefined,
                  display: 'flex',
                }}
              >
                <Cover code={SAMPLE_GAMES[i]!.code} px={px} size={8} fit="contain" />
              </div>
              {labels && i === 0 && pos === 'overlay' && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: px(artTop + artH - GRID_LABEL_BAND),
                    height: px(GRID_LABEL_BAND),
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    padding: px(2),
                  }}
                >
                  <span style={nameStyle}>{name}</span>
                </div>
              )}
              {labels && i === 0 && pos !== 'overlay' && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: pos === 'top' ? 0 : px(artH),
                    height: px(band),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: `0 ${px(2)}px`,
                  }}
                >
                  <span style={nameStyle}>{name}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  const rowCount = Math.min(Math.max(1, Math.floor(el.rect[3] / Math.max(1, el.rowH))), SAMPLE_ROWS.length);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {Array.from({ length: rowCount }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            top: px(i * el.rowH),
            width: '100%',
            height: px(el.rowH - 2),
            background: i === 0 ? el.highlight : 'transparent',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: px(el.textPadL),
              right: px(el.textPadR),
              top: px(el.textDy - BUILTIN_NATIVE_PX),
              fontFamily: FONT,
              fontSize: px(BUILTIN_NATIVE_PX),
              color: i === 0 ? '#ffff70' : el.textColor,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {SAMPLE_ROWS[i]}
          </div>
        </div>
      ))}
    </div>
  );
}

function FileListView({ el, px }: { el: FileListElement; px: (n: number) => number }) {
  const rows: { name: string; kind: 'dir' | 'rom' | 'file' }[] = [
    { name: '..', kind: 'dir' },
    { name: 'ROMS', kind: 'dir' },
    { name: 'Super Mario 64.z64', kind: 'rom' },
    { name: 'Zelda OoT.z64', kind: 'rom' },
    { name: 'notes.txt', kind: 'file' },
    { name: 'cover.png', kind: 'file' },
  ];
  const rowCount = Math.min(rows.length, Math.max(1, Math.floor(el.rect[3] / Math.max(1, el.rowH))));
  const colour = (k: 'dir' | 'rom' | 'file') => (k === 'dir' ? el.dirColor : k === 'rom' ? el.romColor : el.fg);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: FONT }}>
      {Array.from({ length: rowCount }).map((_, i) => {
        const r = rows[i]!;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: px(i * el.rowH),
              height: px(el.rowH),
              display: 'flex',
              alignItems: 'center',
              padding: `0 ${px(8)}px`,
              background: i === 2 ? el.highlight : 'transparent',
              color: i === 2 ? '#fff' : colour(r.kind),
              fontSize: px(BUILTIN_NATIVE_PX),
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
            {el.showSize && r.kind !== 'dir' && (
              <span style={{ opacity: 0.7, fontSize: px(10) }}>{i === 2 ? '8 MB' : '12 kB'}</span>
            )}
          </div>
        );
      })}
      {el.manage && (
        <div
          style={{
            position: 'absolute',
            right: px(6),
            top: px(4),
            fontSize: px(9),
            padding: `${px(1)}px ${px(5)}px`,
            borderRadius: px(3),
            background: 'rgba(255,90,124,0.25)',
            color: '#FF9CB0',
          }}
        >
          Manage
        </div>
      )}
    </div>
  );
}

function InfoPanelView({ el, px }: { el: InfoPanelElement; px: (n: number) => number }) {
  const visible = el.labels.map((lbl, i) => ({ lbl, sample: SAMPLE_INFO[i], i })).filter((r) => r.lbl);
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: FONT }}>
      {visible.map((row, k) => (
        <div
          key={row.i}
          style={{ position: 'absolute', left: 0, top: px(k * el.rowH + el.baselineDy - 12), width: '100%' }}
        >
          <span style={{ position: 'absolute', left: 0, fontSize: px(12), color: el.labelColor }}>{row.lbl}</span>
          <span style={{ position: 'absolute', left: px(el.labelW), fontSize: px(12), color: el.valueColor }}>
            {row.sample}
          </span>
        </div>
      ))}
      {visible.length === 0 && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: px(el.baselineDy - 12),
            fontSize: px(11),
            color: '#5a6178',
            fontStyle: 'italic',
          }}
        >
          (no rows — every label is empty)
        </span>
      )}
    </div>
  );
}
