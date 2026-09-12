/**
 * Generates docs/examples/menu.json — "Grand Tour", a PAK-MEN showcase: every
 * element type, used more than once; grids and lists on many pages; a
 * control-explainer page and a favourites how-to; and a themed,
 * favourite-collection shelf per genre. 8 MB-friendly.
 *
 * This is the app's default layout (see templates/index.ts) — run `npm run gen`
 * afterward to refresh the bundled default-menu.json from it.
 *
 *   node gen-grand-tour.mjs   (from anywhere)
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { fileURLToPath } from 'node:url';
const MB = fileURLToPath(new URL('..', import.meta.url));
const { fromMenuJson, toMenuJson } = await import(
  pathToFileURL(join(MB, 'src/shared/menu-schema.ts')).href
);

/* ---------------------------------------------------------------- helpers */

let _z = 0;
const nextZ = () => _z++;
function page(id, title, background, hint, build) {
  _z = 0;
  const elements = [];
  const add = (e) => {
    elements.push({ z: nextZ(), ...e });
    return e;
  };
  build(add);
  return { id, title, kind: 'custom', background, hint, elements };
}

// a full-bleed decorative frame (two nested panels)
function frame(add, { fill, border, bw = 3, radius = 8, inner }) {
  add({ id: 'frame', type: 'panel', rect: [16, 12, 608, 456], text: '',
        box: { fill, border, borderW: bw, cornerRadius: radius } });
  if (inner)
    add({ id: 'frame2', type: 'panel', rect: [26, 22, 588, 436], text: '',
          box: { border: inner, borderW: 1, cornerRadius: Math.max(0, radius - 4) } });
}

// bottom hint strip
function hintBar(add, text, { fill, border, color, letter = 1 }) {
  add({ id: 'hintbar', type: 'panel', rect: [32, 424, 576, 30], text: '',
        box: { fill, border, borderW: 1, cornerRadius: 4 } });
  add({ id: 'hinttext', type: 'text', rect: [32, 424, 576, 30], text,
        align: 'center', valign: 'middle', color, letterSpacing: letter });
}

function heading(add, text, { font, size = 32, color, letter = 2, rect = [40, 22, 560, 40], box } = {}) {
  const e = { id: 'heading', type: 'text', rect, text, align: 'center', valign: 'middle',
              color, letterSpacing: letter };
  if (font) { e.font = font; e.fontSize = size; }
  else e.fontSize = 24;
  if (box) e.box = box;
  add(e);
}

// N64-controller-coloured key glyph (one panel that also holds its letter) + a caption
const KEY = {
  a:     { shape: 'circle', fill: '#3B38FF', border: '#2D2AC0' },
  b:     { shape: 'circle', fill: '#00A321', border: '#04811D' },
  c:     { shape: 'circle', fill: '#F0C000', border: '#A88400' },
  z:     { shape: 'rect',   fill: '#5B5B5B', border: '#3A3A3A' },
  lr:    { shape: 'rect',   fill: '#808080', border: '#5A5FB0' },
  start: { shape: 'circle', fill: '#C0392B', border: '#7A1F16' },
  dpad:  { shape: 'rect',   fill: '#3A3F4A', border: '#20242C' },
  stick: { shape: 'rect',   fill: '#2A2E38', border: '#454B58' },
};
function key(add, idp, x, y, glyph, kind, caption, { capColor = '#E7E9EF', size = 40, capW = 210 } = {}) {
  const k = KEY[kind];
  add({ id: idp, type: 'panel', rect: [x, y, size, size], aspectLock: true,
        text: glyph, align: 'center', valign: 'middle', color: '#FFFFFF', fontSize: 24,
        box: { shape: k.shape, fill: k.fill, border: k.border, borderW: 4, cornerRadius: 6 } });
  add({ id: idp + '-cap', type: 'text', rect: [x + size + 12, y, capW, size],
        text: caption, align: 'left', valign: 'middle', color: capColor, fontSize: 24 });
}

/* ---------------------------------------------------------------- pages */

const pages = [];

/* ---- HOME : the hub + a wall of shapes ---- */
pages.push(page('home', 'PAK-MEN', '#0C1220', '  L R  flip pages      A  open      B  back  ', (add) => {
  frame(add, { fill: '#141C2E', border: '#5A5FB0', bw: 3, radius: 10, inner: '#2C3350' });
  add({ id: 'title', type: 'text', rect: [40, 30, 560, 40], text: 'PAK-MEN',
        font: 'PressStart2P-vaV7', fontSize: 32, align: 'center', valign: 'middle',
        color: '#EDEFF7', letterSpacing: 2 });
  add({ id: 'sub', type: 'text', rect: [40, 76, 560, 16], text: 'a menu you design yourself',
        align: 'center', valign: 'middle', color: '#8E97C8', letterSpacing: 3 });
  add({ id: 'clock', type: 'text', rect: [40, 100, 560, 14], text: '', clockFormat: '%a  %d %b  ·  %H:%M',
        align: 'center', valign: 'middle', color: '#5C6699', letterSpacing: 2 });

  // shape wall — one labelled panel per shape, so every shape shows somewhere
  const shapes = [
    ['circle', 'CIRCLE', '#5EE6D0'], ['ellipse', 'ELLIPSE', '#7FB2FF'],
    ['triangle', 'TRIANGLE', '#FFC24B'], ['diamond', 'DIAMOND', '#FF7FC4'],
    ['pentagon', 'PENTAGON', '#B98CFF'], ['hexagon', 'HEXAGON', '#8AE06B'],
    ['octagon', 'OCTAGON', '#FF8C6B'],
  ];
  shapes.forEach(([sh, lbl, col], i) => {
    const x = 44 + i * 79;
    add({ id: 's-' + sh, type: 'panel', rect: [x, 128, 56, 56], text: '',
          box: { shape: sh, fill: '#1B2338', border: col, borderW: 3 } });
    add({ id: 's-' + sh + '-l', type: 'text', rect: [x - 8, 188, 72, 12], text: lbl,
          align: 'center', valign: 'middle', color: col, letterSpacing: 1 });
  });
  add({ id: 'round-demo', type: 'panel', rect: [44, 210, 260, 46], text: 'ROUNDED  ·  BORDERED  ·  FILLED',
        align: 'center', valign: 'middle', color: '#CBD3F5', letterSpacing: 1,
        box: { fill: '#20305A', border: '#7C88D8', borderW: 2, cornerRadius: 16 } });
  add({ id: 'sharp-demo', type: 'panel', rect: [320, 210, 260, 46], text: 'OR SHARP AND FLAT',
        align: 'center', valign: 'middle', color: '#CBD3F5', letterSpacing: 1,
        box: { fill: '#20305A', border: '#7C88D8', borderW: 2, cornerRadius: 0 } });

  // navigation buttons -> each destination page
  const nav = [
    ['Zelda', { kind: 'goto', page: 'zelda' }], ['Mario', { kind: 'goto', page: 'mario' }],
    ['Racing', { kind: 'goto', page: 'racing' }], ['Party', { kind: 'goto', page: 'party' }],
    ['Shooters', { kind: 'goto', page: 'fps' }], ['All Games', { kind: 'goto', page: 'all' }],
    ['Recent', { kind: 'goto', page: 'recent' }], ['Files', { kind: 'goto', page: 'files' }],
    ['Controls', { kind: 'goto', page: 'controls' }], ['Favourites', { kind: 'goto', page: 'favourites' }],
    ['Settings', { kind: 'goto', page: 'settings' }],
  ];
  nav.forEach(([lbl, action], i) => {
    const col = i % 4, row = (i / 4) | 0;
    add({ id: 'nav-' + i, type: 'button', rect: [44 + col * 140, 272 + row * 40, 128, 32],
          label: lbl, color: '#EDEFF7', align: 'center', valign: 'middle', letterSpacing: 1,
          focusable: true, focusOrder: i,
          box: { fill: '#22305C', border: '#5A67B8', borderW: 2, cornerRadius: 8 },
          action });
  });
  add({ id: 'stat', type: 'text', rect: [44, 392, 536, 16], text: 'PAK-MEN {menu_version}   ·   {history_count} played   ·   {fav_count} saved   ·   {cart}',
        align: 'center', valign: 'middle', color: '#6B76AE', letterSpacing: 1 });
  hintBar(add, 'L R  FLIP PAGES        A  OPEN        Z  FAVOURITE        START  SETTINGS',
    { fill: '#182142', border: '#3A4478', color: '#9AA4D8' });
}));

/* ---- CONTROLS : the default button map, Elena-styled ---- */
pages.push(page('controls', 'Controls', '#F598B3', '', (add) => {
  add({ id: 'heading', type: 'text', rect: [70, 18, 420, 44], text: 'CONTROLS',
        fontSize: 36, align: 'center', valign: 'middle', color: '#FFFFFF', letterSpacing: 2,
        box: { border: '#5A5FB0', borderW: 2, cornerRadius: 4 } });
  add({ id: 'back', type: 'button', rect: [508, 22, 104, 34], label: 'HOME', glyph: '<',
        color: '#FFFFFF', align: 'center', valign: 'middle', letterSpacing: 1, focusable: true, focusOrder: 0,
        box: { fill: '#808080', border: '#5A5FB0', borderW: 4, cornerRadius: 4 },
        action: { kind: 'goto', page: 'home' } });
  add({ id: 'intro', type: 'text', rect: [40, 68, 560, 14], text: 'the stock buttons  —  remap any of them in the builder',
        align: 'center', valign: 'middle', color: '#7A2E63', letterSpacing: 1 });

  // one column, full-width captions
  const rows = [
    ['A', 'a', 'Open / launch the highlighted game'],
    ['B', 'b', 'Back  —  up a folder, or one page'],
    ['L', 'lr', 'Previous page'],
    ['R', 'lr', 'Next page'],
    ['Z', 'z', 'Favourite  —  add to or drop from a shelf'],
    ['>', 'start', 'Start  —  open the Settings screen'],
    ['C', 'c', 'C buttons  —  skip a page at a time'],
    ['+', 'dpad', 'D-pad / stick  —  move the highlight'],
  ];
  rows.forEach(([g, kind, cap], i) => {
    const y = 92 + i * 41;
    const k = KEY[kind];
    add({ id: 'k' + i, type: 'panel', rect: [58, y, 38, 38], aspectLock: true, text: g,
          align: 'center', valign: 'middle', color: '#FFFFFF', fontSize: 24,
          box: { shape: k.shape, fill: k.fill, border: k.border, borderW: 4, cornerRadius: 6 } });
    add({ id: 'c' + i, type: 'text', rect: [112, y, 496, 38], text: cap,
          align: 'left', valign: 'middle', color: '#3A1730', fontSize: 24 });
  });
}));

/* ---- FAVOURITES : how Z works + a live shelf ---- */
pages.push(page('favourites', 'Favourites', '#181423', '', (add) => {
  frame(add, { fill: '#221A33', border: '#F0C044', bw: 2, radius: 8 });
  add({ id: 'heading', type: 'text', rect: [40, 24, 560, 40], text: 'FAVOURITES',
        font: 'Foneitwu-R9yOW', fontSize: 32, align: 'center', valign: 'middle',
        color: '#F5E6B8', letterSpacing: 2 });
  add({ id: 'k-z', type: 'panel', rect: [40, 74, 40, 40], aspectLock: true, text: 'Z',
        align: 'center', valign: 'middle', color: '#FFFFFF', fontSize: 24,
        box: { shape: 'rect', fill: '#5B5B5B', border: '#3A3A3A', borderW: 4, cornerRadius: 6 } });
  add({ id: 'k-z-cap', type: 'text', rect: [92, 70, 508, 48],
        text: 'Press Z on any game to save it.\nPress Z again to remove it.',
        align: 'left', valign: 'middle', color: '#D8CBAF', fontSize: 24 });
  add({ id: 'sub', type: 'text', rect: [44, 122, 560, 14],
        text: 'collections keep separate shelves  —  Zelda, Racing, and so on',
        align: 'center', valign: 'middle', color: '#9C8F6E', letterSpacing: 1 });
  add({ id: 'grid-panel', type: 'panel', rect: [32, 144, 576, 236], text: '',
        box: { fill: '#1B1428', border: '#8A7430', borderW: 1, cornerRadius: 4 } });
  add({ id: 'favs', type: 'gameList', rect: [46, 156, 548, 212], source: 'favorites',
        style: 'grid', rowH: 24, textPadL: 10, textPadR: 8, textDy: 16,
        gridCols: 5, gridRows: 2, gridGap: 12, gridLabels: true, gridLabelPos: 'overlay',
        gridLabelWrap: false, highlight: '#F0C044', textColor: '#FFF3D0' });
  // Same treatment as the genre pages: one centred "back to home" button, no
  // gimmick action button. Favourites' own Z-to-save gesture (k-z / k-z-cap
  // above, and the hint bar below) already covers adding/removing a favourite
  // -- this button was a redundant second way to do it.
  add({ id: 'home', type: 'button', rect: [170, 388, 300, 32], label: 'BACK TO HOME', glyph: '<',
        color: '#F5E6B8', align: 'center', valign: 'middle', letterSpacing: 2, focusable: true, focusOrder: 0,
        box: { fill: '#3A2E17', border: '#8A7430', borderW: 2, cornerRadius: 6 },
        action: { kind: 'goto', page: 'home' } });
  hintBar(add, 'A  LAUNCH        Z  ADD TO / REMOVE FROM A SHELF        L R  FLIP PAGES',
    { fill: '#1B1428', border: '#8A7430', color: '#C9B98A' });
}));

/* ---- helper: a themed genre shelf page ---- */
function genrePage(id, title, collection, pal, decor) {
  return page(id, title, pal.bg, '', (add) => {
    frame(add, { fill: pal.frameFill, border: pal.frameBorder, bw: pal.bw ?? 3, radius: pal.radius });
    // two logos, pinned to the top corners; heading centred between them
    const lg = pal.logos || [];
    if (lg[0]) add({ id: 'logo0', type: 'image', rect: [30, 22, 124, 54], src: `boxart/${lg[0]}/logo.png`, fit: 'contain' });
    if (lg[1]) add({ id: 'logo1', type: 'image', rect: [486, 22, 124, 54], src: `boxart/${lg[1]}/logo.png`, fit: 'contain' });
    add({ id: 'heading', type: 'text', rect: [166, 24, 308, 46], text: title.toUpperCase(),
          font: pal.font, fontSize: 32, align: 'center', valign: 'middle',
          color: pal.headingColor, letterSpacing: pal.letter ?? 2 });
    if (decor) decor(add, pal);
    add({ id: 'shelf-panel', type: 'panel', rect: [32, pal.shelfY, 576, pal.shelfH], text: '',
          box: { fill: pal.panelFill, border: pal.panelBorder, borderW: 1, cornerRadius: Math.max(0, pal.radius - 2) } });
    add(pal.list
      ? { id: 'shelf', type: 'gameList', rect: [46, pal.shelfY + 12, 300, pal.shelfH - 24],
          source: 'favorites', collection, style: 'list', rowH: 26, textPadL: 14, textPadR: 10, textDy: 17,
          highlight: pal.highlight, textColor: pal.listText }
      : { id: 'shelf', type: 'gameList', rect: [46, pal.shelfY + 12, 548, pal.shelfH - 24],
          source: 'favorites', collection, style: 'grid', rowH: 24, textPadL: 10, textPadR: 8, textDy: 16,
          gridCols: pal.cols ?? 5, gridRows: pal.rows ?? 2, gridGap: 12,
          gridLabels: true, gridLabelPos: 'overlay', gridLabelWrap: false,
          highlight: pal.highlight, textColor: pal.gridText ?? '#FFFFFF' });
    if (pal.list) {
      add({ id: 'cover-panel', type: 'panel', rect: [360, pal.shelfY, 248, 176], text: '',
            box: { fill: pal.panelFill, border: pal.panelBorder, borderW: 1, cornerRadius: Math.max(0, pal.radius - 2) } });
      add({ id: 'cover', type: 'boxArt', rect: [372, pal.shelfY + 12, 224, 152], fit: 'cover',
            bg: pal.panelFill, aspectLock: true });
      add({ id: 'info-panel', type: 'panel', rect: [360, pal.shelfY + 186, 248, pal.shelfH - 186], text: '',
            box: { fill: pal.panelFill, border: pal.panelBorder, borderW: 1, cornerRadius: Math.max(0, pal.radius - 2) } });
      add({ id: 'info', type: 'infoPanel', rect: [374, pal.shelfY + 196, 220, pal.shelfH - 206],
            rowH: 20, labelW: 92, baselineDy: 14,
            labels: ['RELEASED', 'MAKER', 'REGION', 'PLAYERS', ''],
            labelColor: pal.infoLabel, valueColor: pal.listText });
    }
    // add to a shelf from the All Games / Favourites pages; here Z only removes.
    add({ id: 'home', type: 'button', rect: [170, 386, 300, 32], label: 'BACK TO HOME', glyph: '<',
          color: pal.btnText, align: 'center', valign: 'middle', letterSpacing: 2, focusable: true, focusOrder: 0,
          box: { fill: pal.btnFill, border: pal.btnBorder, borderW: 2, cornerRadius: Math.max(0, pal.radius - 2) },
          action: { kind: 'goto', page: 'home' } });
    hintBar(add, pal.hint || 'A  LAUNCH        Z  REMOVE FROM SHELF        L R  FLIP PAGES',
      { fill: pal.panelFill, border: pal.panelBorder, color: pal.hintColor });
  });
}

/* ---- ZELDA ---- */
pages.push(genrePage('zelda', 'Zelda', 'Zelda', {
  bg: '#0E1F16', frameFill: '#16281C', frameBorder: '#C8A24A', bw: 3, radius: 6,
  panelFill: '#12211A', panelBorder: '#8A7A3E',
  font: 'Triforce-y07d', headingColor: '#E8D9A0', letter: 3,
  logos: ['CZLE', 'NZSE'], highlight: '#C8A24A', gridText: '#F1E7C6',
  btnFill: '#2E4A2E', btnBorder: '#5E7A3E', btnText: '#F3EAD0',
  hintColor: '#B7A876', shelfY: 108, shelfH: 272, cols: 5, rows: 2,
}, (add) => {
  // Triforce, centred under the heading
  add({ id: 'tri-t', type: 'panel', rect: [309, 74, 22, 18], text: '', box: { shape: 'triangle', fill: '#E8C84A' } });
  add({ id: 'tri-l', type: 'panel', rect: [298, 92, 22, 18], text: '', box: { shape: 'triangle', fill: '#E8C84A' } });
  add({ id: 'tri-r', type: 'panel', rect: [320, 92, 22, 18], text: '', box: { shape: 'triangle', fill: '#E8C84A' } });
  add({ id: 'rule-l', type: 'panel', rect: [120, 84, 160, 2], text: '', box: { fill: '#8A7A3E' } });
  add({ id: 'rule-r', type: 'panel', rect: [360, 84, 160, 2], text: '', box: { fill: '#8A7A3E' } });
}));

/* ---- MARIO ---- */
pages.push(genrePage('mario', 'Mario', 'Mario', {
  bg: '#2C74B8', frameFill: '#C33C2C', frameBorder: '#F4C542', bw: 4, radius: 8,
  panelFill: '#9E2E22', panelBorder: '#F4C542',
  font: 'SuperMario286-18qg', headingColor: '#FFFFFF', letter: 1,
  logos: ['NSME', 'NMWE'], highlight: '#F4C542', gridText: '#FFF3D0',
  btnFill: '#1F8A3E', btnBorder: '#0E6A2A', btnText: '#FFFFFF',
  hintColor: '#FCE7B0', shelfY: 108, shelfH: 272, cols: 5, rows: 2,
}, (add) => {
  // a row of coins under the heading
  [280, 312, 344].forEach((x, i) =>
    add({ id: 'coin' + i, type: 'panel', rect: [x, 78, 20, 20], text: '',
          box: { shape: 'circle', fill: '#F4C542', border: '#B98A16', borderW: 3 } }));
  add({ id: 'cloud1', type: 'panel', rect: [140, 78, 76, 20], text: '', box: { shape: 'ellipse', fill: '#EAF4FF' } });
  add({ id: 'cloud2', type: 'panel', rect: [424, 78, 76, 20], text: '', box: { shape: 'ellipse', fill: '#EAF4FF' } });
}));

/* ---- RACING (list + cover + info) ---- */
pages.push(genrePage('racing', 'Racing', 'Racing', {
  bg: '#17171B', frameFill: '#24242A', frameBorder: '#E8B900', bw: 3, radius: 2,
  panelFill: '#1E1E24', panelBorder: '#5A5A20',
  font: 'RoBlueShellBold-gxn35', headingColor: '#E8B900', letter: 2,
  logos: ['NKTE', 'NDYE'], highlight: '#E8B900', listText: '#E6E6E6', infoLabel: '#8A8A3A',
  btnFill: '#B01818', btnBorder: '#7A0F0F', btnText: '#FFFFFF',
  hintColor: '#C9C98A', shelfY: 108, shelfH: 272, list: true,
}, (add) => {
  // a checkered strip + speed chevrons under the heading
  for (let i = 0; i < 10; i++)
    add({ id: 'ck' + i, type: 'panel', rect: [232 + i * 18, 80, 18, 12], text: '',
          box: { fill: i % 2 ? '#E8E8E8' : '#1A1A1E' } });
  for (let i = 0; i < 3; i++)
    add({ id: 'chev' + i, type: 'panel', rect: [196 - i * 13, 78, 16, 16], text: '',
          rotation: 90, box: { shape: 'triangle', fill: '#E8B900' } });
}));

/* ---- PARTY (grid, very round, confetti) ---- */
pages.push(genrePage('party', 'Party', 'Party', {
  bg: '#271640', frameFill: '#392552', frameBorder: '#FF5EC4', bw: 3, radius: 16,
  panelFill: '#2C1B44', panelBorder: '#8A4FB0',
  font: 'PolygonParty-3KXM', headingColor: '#FFE84D', letter: 1,
  logos: ['NMWE', 'NALE'], highlight: '#FF5EC4', gridText: '#F3E9FF',
  btnFill: '#E23EA8', btnBorder: '#A01E76', btnText: '#FFFFFF',
  hintColor: '#D8B8F0', shelfY: 110, shelfH: 270, cols: 4, rows: 2,
}, (add) => {
  const conf = [
    ['diamond', '#FF5EC4', 250, 76, 18], ['circle', '#4DE8D0', 286, 82, 12],
    ['pentagon', '#FFE84D', 320, 74, 18], ['circle', '#7FB2FF', 356, 82, 12],
    ['diamond', '#8AE06B', 388, 76, 16],
    ['circle', '#FF5EC4', 36, 398, 14], ['diamond', '#4DE8D0', 592, 396, 16],
  ];
  conf.forEach(([sh, col, x, y, s], i) =>
    add({ id: 'cf' + i, type: 'panel', rect: [x, y, s, s], text: '', box: { shape: sh, fill: col } }));
}));

/* ---- FPS (list + cover + info, sharp, crosshair) ---- */
pages.push(genrePage('fps', 'Shooters', 'FPS', {
  bg: '#090C09', frameFill: '#12180F', frameBorder: '#7F9E3A', bw: 2, radius: 0,
  panelFill: '#0E130C', panelBorder: '#4A5A26',
  font: 'Nes2Regular-yxyd', headingColor: '#C9A227', letter: 3,
  logos: ['NGEE', 'NPDE'], highlight: '#C9A227', listText: '#B8C99A', infoLabel: '#6A7A3A',
  btnFill: '#5A6E1E', btnBorder: '#3A4A12', btnText: '#E8F0D0',
  hintColor: '#9AAE6A', shelfY: 108, shelfH: 272, list: true,
  hint: 'A  DEPLOY        Z  REMOVE FROM SQUAD        L R  CYCLE PAGES',
}, (add) => {
  // crosshair centred under the heading + hexagon HUD ticks
  add({ id: 'xh', type: 'panel', rect: [304, 72, 32, 32], text: '', box: { shape: 'octagon', border: '#7F9E3A', borderW: 3 } });
  add({ id: 'xh-dot', type: 'panel', rect: [316, 84, 8, 8], text: '', box: { shape: 'circle', fill: '#C9A227' } });
  add({ id: 'xh-l', type: 'panel', rect: [270, 87, 26, 2], text: '', box: { fill: '#7F9E3A' } });
  add({ id: 'xh-r', type: 'panel', rect: [344, 87, 26, 2], text: '', box: { fill: '#7F9E3A' } });
  add({ id: 'hex1', type: 'panel', rect: [176, 78, 20, 18], text: '', box: { shape: 'hexagon', fill: '#1A2410', border: '#4A5A26', borderW: 2 } });
  add({ id: 'hex2', type: 'panel', rect: [444, 78, 20, 18], text: '', box: { shape: 'hexagon', fill: '#1A2410', border: '#4A5A26', borderW: 2 } });
}));

/* ---- ALL GAMES : the whole library — and where you build the shelves ---- */
pages.push(page('all', 'All Games', '#101014', '', (add) => {
  add({ id: 'heading', type: 'text', rect: [40, 16, 560, 26], text: 'ALL GAMES',
        font: 'Emulogic-zrEw', fontSize: 16, align: 'center', valign: 'middle',
        color: '#D8D8E0', letterSpacing: 4 });
  add({ id: 'rule', type: 'panel', rect: [270, 42, 100, 2], text: '', box: { fill: '#3A3A48' } });
  add({ id: 'grid', type: 'gameList', rect: [28, 54, 584, 318], source: 'all', style: 'grid',
        rowH: 24, textPadL: 10, textPadR: 8, textDy: 16, gridCols: 6, gridRows: 4, gridGap: 8,
        gridLabels: false, highlight: '#5EE6D0', textColor: '#FFFFFF' });
  add({ id: 'note', type: 'text', rect: [40, 378, 560, 12], text: 'highlight a game and press Z to file it on a genre shelf',
        align: 'center', valign: 'middle', color: '#5C5C6C', letterSpacing: 1 });
  add({ id: 'shelf', type: 'button', rect: [28, 394, 300, 30], label: 'ADD TO A SHELF', glyph: 'Z',
        color: '#0B120B', align: 'center', valign: 'middle', letterSpacing: 1, focusable: true, focusOrder: 0,
        box: { fill: '#5EE6D0', border: '#2FA593', borderW: 2, cornerRadius: 6 },
        action: { kind: 'favorite.toggle' } });
  add({ id: 'home', type: 'button', rect: [336, 394, 276, 30], label: 'HOME', glyph: '<',
        color: '#D8D8E0', align: 'center', valign: 'middle', letterSpacing: 2, focusable: true, focusOrder: 1,
        box: { fill: '#1C1C24', border: '#3A3A48', borderW: 2, cornerRadius: 6 },
        action: { kind: 'goto', page: 'home' } });
  add({ id: 'count', type: 'text', rect: [40, 430, 560, 14], text: '{history_count} PLAYED   ·   {fav_count} SAVED   ·   {cart}',
        align: 'center', valign: 'middle', color: '#666676', letterSpacing: 2 });
}));

/* ---- RECENT : history list + info ---- */
pages.push(page('recent', 'Recent', '#14181C', '', (add) => {
  add({ id: 'frame', type: 'panel', rect: [16, 12, 608, 456], text: '',
        box: { fill: '#1B2026', border: '#3E4650', borderW: 2, cornerRadius: 3 } });
  add({ id: 'heading', type: 'text', rect: [40, 24, 560, 32], text: 'RECENTLY PLAYED',
        font: 'PixelEmulator-xq08', fontSize: 16, align: 'center', valign: 'middle',
        color: '#CFE8FF', letterSpacing: 3 });
  add({ id: 'list-panel', type: 'panel', rect: [32, 66, 340, 316], text: '',
        box: { fill: '#161B20', border: '#333B44', borderW: 1, cornerRadius: 3 } });
  add({ id: 'list', type: 'gameList', rect: [44, 78, 316, 292], source: 'history', style: 'list',
        rowH: 26, textPadL: 12, textPadR: 8, textDy: 17, highlight: '#2E5A78', textColor: '#D6E4F0' });
  add({ id: 'cover-panel', type: 'panel', rect: [384, 66, 224, 190], text: '',
        box: { fill: '#161B20', border: '#333B44', borderW: 1, cornerRadius: 3 } });
  add({ id: 'cover', type: 'boxArt', rect: [396, 78, 200, 166], fit: 'cover', bg: '#161B20', aspectLock: true });
  add({ id: 'info-panel', type: 'panel', rect: [384, 266, 224, 116], text: '',
        box: { fill: '#161B20', border: '#333B44', borderW: 1, cornerRadius: 3 } });
  add({ id: 'info', type: 'infoPanel', rect: [398, 276, 196, 96], rowH: 20, labelW: 84, baselineDy: 14,
        labels: ['RELEASED', 'MAKER', 'REGION', 'PLAYERS', 'GENRE'],
        labelColor: '#5E6A76', valueColor: '#D6E4F0' });
  add({ id: 'home', type: 'button', rect: [170, 388, 300, 30], label: 'BACK TO HOME', glyph: '<',
        color: '#CFE8FF', align: 'center', valign: 'middle', letterSpacing: 2, focusable: true, focusOrder: 0,
        box: { fill: '#1E3140', border: '#3E5A72', borderW: 2, cornerRadius: 3 },
        action: { kind: 'goto', page: 'home' } });
  hintBar(add, 'A  PLAY AGAIN        L R  FLIP PAGES', { fill: '#161B20', border: '#333B44', color: '#7E8C98' });
}));

/* ---- FILES : the SD-card browser ---- */
pages.push(page('files', 'Files', '#0D0F13', '', (add) => {
  add({ id: 'frame', type: 'panel', rect: [16, 12, 608, 456], text: '',
        box: { fill: '#14171C', border: '#2E3640', borderW: 2, cornerRadius: 2 } });
  add({ id: 'heading', type: 'text', rect: [40, 22, 560, 30], text: 'SD CARD',
        font: 'RoSpritendoSemiboldBeta-vmVwZ', fontSize: 16, align: 'center', valign: 'middle',
        color: '#B7C4D0', letterSpacing: 4 });
  add({ id: 'files', type: 'fileList', rect: [32, 60, 576, 356], root: 'sd:/', rowH: 22,
        showSize: true, manage: true, fg: '#C6D2DE', dirColor: '#7FB2FF', romColor: '#7FE0B0',
        highlight: '#28323E', bg: '#101317' });
  hintBar(add, 'A  OPEN        START  MANAGE        B  UP A FOLDER        L R  PAGES',
    { fill: '#101317', border: '#2E3640', color: '#8592A0' });
}));

/* ---- SETTINGS : every toggle ---- */
pages.push(page('settings', 'Settings', '#0F1728', '', (add) => {
  add({ id: 'frame', type: 'panel', rect: [16, 12, 608, 456], text: '',
        box: { fill: '#16203A', border: '#4A5A8A', borderW: 2, cornerRadius: 3 } });
  add({ id: 'heading', type: 'text', rect: [40, 22, 560, 34], text: 'SETTINGS',
        font: 'GamecubenDualset-L85D', fontSize: 32, align: 'center', valign: 'middle',
        color: '#D6E0F5', letterSpacing: 3 });
  const secs = [
    ['SOUND', 64, [['bgm_enabled', 'Music'], ['soundfx_enabled', 'Sound FX'], ['rumble_enabled', 'Rumble Pak']]],
    ['VIDEO', 172, [['pal60_enabled', 'PAL 60 Hz'], ['force_progressive_scan', '240p scan']]],
    ['LIBRARY', 246, [['use_custom_files', 'Custom art'], ['always_sort_az', 'Sort A–Z'], ['use_legacy_font', 'Legacy font']]],
    ['MISC', 354, [['screensaver_favorites_only', 'Saver: favs only'], ['rom_boot_enabled', 'Direct ROM boot']]],
  ];
  let fo = 0;
  secs.forEach(([name, y, items], si) => {
    add({ id: 'sec' + si, type: 'text', rect: [52, y, 500, 14], text: name, align: 'left', valign: 'middle',
          color: '#7C8AB8', letterSpacing: 3 });
    items.forEach(([kkey, lbl], i) => {
      const col = i % 2, r = (i / 2) | 0;
      add({ id: 'set-' + kkey, type: 'setting', rect: [52 + col * 282, y + 18 + r * 34, 268, 30],
            label: lbl, settingKey: kkey, color: '#D6E0F5', valueColor: '#6BE6C0',
            align: 'left', valign: 'middle', pad: [0, 0, 0, 12], focusOrder: fo++,
            box: { fill: '#1B2748', border: '#3E4E80', borderW: 1, cornerRadius: 3 } });
    });
  });
  add({ id: 'home', type: 'button', rect: [52, 414, 536, 32], label: 'RETURN HOME', color: '#EDEFF7',
        align: 'center', valign: 'middle', letterSpacing: 3, focusable: true, focusOrder: fo,
        box: { fill: '#2A3A66', border: '#5A6AA8', borderW: 2, cornerRadius: 4 },
        action: { kind: 'goto', page: 'home' } });
}));

/* ---------------------------------------------------------------- emit */

const raw = {
  format: 2,
  pages: pages.map((p, i) => (i === 0 ? { ...p, start: true } : p)),
  // Elena cue: D-pad L/R step the focus ring; L/R shoulders flip pages (stock)
  buttons: { d_up: 'none', d_down: 'none', d_left: 'focusPrev', d_right: 'focusNext' },
};

const normalized = toMenuJson(fromMenuJson(JSON.stringify(raw)));
// Grand Tour is the app's default layout, so it's written straight to the
// single source of truth (see templates/index.ts) — the same file the SD-card
// example and the app's fresh-project/Reset layout are generated from via
// `npm run gen`. There is no separate templates/grand-tour.json to keep in sync.
const outPath = join(MB, '..', '..', 'docs/examples/menu.json');
writeFileSync(outPath, normalized);

// quick sanity report
const parsed = JSON.parse(normalized);
console.log('pages:', parsed.pages.length);
for (const p of parsed.pages) {
  const types = {};
  for (const e of p.elements) types[e.type] = (types[e.type] || 0) + 1;
  console.log(`  ${p.id.padEnd(11)} ${String(p.elements.length).padStart(2)} els  ${Object.entries(types).map(([t, n]) => `${t}:${n}`).join(' ')}`);
}
const allTypes = new Set();
for (const p of parsed.pages) for (const e of p.elements) allTypes.add(e.type);
console.log('element types used:', [...allTypes].sort().join(', '));
console.log('wrote', outPath);
