import { test } from 'node:test';
import assert from 'node:assert/strict';

import { defaultHomeLayout, toHomeJson } from '../src/shared/layout-schema.ts';
import {
  defaultMenuLayout,
  migrateV1,
  fromMenuJson,
  toMenuJson,
  normalizeMenu,
  newPage,
  newElement,
  startPage,
  overscanScale,
  MENU_FORMAT,
  type MenuLayout,
} from '../src/shared/menu-schema.ts';

test('the default layout is the multi-page showcase, exactly one start page', () => {
  const m = defaultMenuLayout();
  assert.equal(m.format, MENU_FORMAT);
  assert.ok(m.pages.length >= 4, 'several pages');
  assert.equal(m.pages.filter((p) => p.start).length, 1, 'one start page');
  const start = m.pages.find((p) => p.start)!;
  assert.equal(start.kind, 'custom');
  // z is contiguous on every page after normalisation
  for (const p of m.pages) p.elements.forEach((e, i) => assert.equal(e.z, i));
});

test('the default layout exercises every element type across its pages', () => {
  const m = defaultMenuLayout();
  const types = new Set(m.pages.flatMap((p) => p.elements.map((e) => e.type)));
  for (const t of ['gameList', 'boxArt', 'infoPanel', 'text', 'image', 'button', 'panel', 'setting', 'fileList'])
    assert.ok(types.has(t as never), `has a ${t} somewhere`);
  assert.ok(m.pages.every((p) => p.kind === 'custom'), 'every page is a custom, laid-out page');
  assert.ok(
    m.pages.some((p) => p.elements.some((e) => e.type === 'gameList' && (e as { source?: string }).source === 'favorites')),
    'a game list is bound to favourites',
  );
});

test('migrateV1 turns a legacy browser page into a page with a File Browser element', () => {
  const v1 = defaultHomeLayout(); // has a baked browser page
  const m = migrateV1(v1);
  assert.ok(m.pages.every((p) => p.kind === 'custom'));
  assert.ok(
    m.pages.some((p) => p.elements.some((e) => e.type === 'fileList')),
    'the browser page became a File Browser element',
  );
  assert.equal(m.pages.filter((p) => p.start).length, 1);
});

test('menu.json round-trips (export -> import -> export is stable)', () => {
  const m = defaultMenuLayout();
  const json1 = toMenuJson(m);
  const back = fromMenuJson(json1);
  const json2 = toMenuJson(back);
  assert.equal(json1, json2);
});

test('a legacy home.json still imports (via v1 migration)', () => {
  const homeJson = toHomeJson(defaultHomeLayout());
  const m = fromMenuJson(homeJson);
  assert.equal(m.format, MENU_FORMAT);
  assert.ok(m.pages[0]!.elements.length > 5);
  assert.equal(m.pages.filter((p) => p.start).length, 1);
});

test('normalizeMenu enforces exactly one start page', () => {
  const m: MenuLayout = {
    format: MENU_FORMAT,
    pages: [
      { id: 'a', title: 'A', kind: 'custom', start: true, elements: [] },
      { id: 'b', title: 'B', kind: 'custom', start: true, elements: [] },
    ],
  };
  normalizeMenu(m);
  assert.equal(m.pages.filter((p) => p.start).length, 1);
});

test('normalizeMenu de-dupes page ids and per-page element ids', () => {
  const m: MenuLayout = {
    format: MENU_FORMAT,
    pages: [
      {
        id: 'p',
        title: 'P',
        kind: 'custom',
        start: true,
        elements: [newElement('text', 'x'), { ...newElement('text', 'x'), text: 'two' }],
      },
      { id: 'p', title: 'P2', kind: 'custom', elements: [] },
    ],
  };
  normalizeMenu(m);
  assert.notEqual(m.pages[0]!.id, m.pages[1]!.id);
  assert.notEqual(m.pages[0]!.elements[0]!.id, m.pages[0]!.elements[1]!.id);
});

test('newPage picks a free id and a Page N title', () => {
  const p = newPage(['page1', 'page2']);
  assert.equal(p.id, 'page3');
  assert.equal(p.kind, 'custom');
  assert.equal(p.elements.length, 0);
});

test('legacy panel/plate colour tokens resolve to hex on import', () => {
  const json = JSON.stringify({
    format: MENU_FORMAT,
    colors: { panel: '#123456', plate: '#abcdef' },
    pages: [
      {
        id: 'p', title: 'P', kind: 'custom', start: true,
        elements: [
          { id: 'a', type: 'panel', rect: [0, 0, 10, 10], fill: 'panel' },
          { id: 'b', type: 'button', rect: [0, 0, 10, 10], label: 'x', fill: 'plate', border: '#ffffff' },
        ],
      },
    ],
  });
  const m = fromMenuJson(json);
  const [a, b] = m.pages[0]!.elements as [
    { box?: { fill?: string } },
    { box?: { fill?: string; border?: string } },
  ];
  assert.equal(a.box?.fill, '#123456');
  assert.equal(b.box?.fill, '#abcdef');
  assert.equal(b.box?.border, '#ffffff');
  // and it doesn't write a colors block back out
  assert.ok(!toMenuJson(m).includes('"colors"'));
});

test('pre-2a flat box fields fold into box, round-trip stable', () => {
  const json = JSON.stringify({
    format: MENU_FORMAT,
    pages: [
      {
        id: 'p', title: 'P', kind: 'custom', start: true,
        elements: [
          { id: 'pn', type: 'panel', rect: [0, 0, 10, 10], fill: '#111111', cornerRadius: 8 },
          { id: 'bt', type: 'button', rect: [0, 0, 40, 20], label: 'Go', fill: '#222222', border: '#333333', borderW: 2, shape: 'circle' },
        ],
      },
    ],
  });
  const m = fromMenuJson(json);
  const [pn, bt] = m.pages[0]!.elements as [
    { box?: { fill?: string; cornerRadius?: number }; fill?: unknown },
    { box?: { shape?: string; borderW?: number }; shape?: unknown },
  ];
  assert.equal(pn.box?.fill, '#111111');
  assert.equal(pn.box?.cornerRadius, 8);
  assert.equal(pn.fill, undefined, 'flat fill removed');
  assert.equal(bt.box?.shape, 'circle');
  assert.equal(bt.box?.borderW, 2);
  assert.equal(bt.shape, undefined, 'flat shape removed');

  const j1 = toMenuJson(m);
  assert.equal(j1, toMenuJson(fromMenuJson(j1)));
});

test('rotation / font / text-rotation survive a round-trip; gameList never rotates', () => {
  const json = JSON.stringify({
    format: MENU_FORMAT,
    pages: [
      {
        id: 'p', title: 'P', kind: 'custom', start: true,
        elements: [
          {
            id: 't', type: 'text', rect: [0, 0, 100, 20], text: 'hi',
            rotation: 30, font: 'Emulogic-zrEw', fontSize: 20, lineHeight: 24,
            letterSpacing: 2, textRotation: -30, keepUpright: true,
          },
          { id: 'g', type: 'gameList', rect: [0, 0, 100, 100], source: 'all', style: 'list', rotation: 45 },
        ],
      },
    ],
  });
  const m = fromMenuJson(json);
  const [t, g] = m.pages[0]!.elements as [Record<string, unknown>, Record<string, unknown>];
  assert.equal(t.rotation, 30);
  assert.equal(t.font, 'Emulogic-zrEw');
  assert.equal(t.fontSize, 20, 'any whole-pixel fontSize is kept as authored');
  assert.equal(t.keepUpright, true);
  assert.equal(g.rotation, undefined, 'gameList rotation stripped');
  const j1 = toMenuJson(m);
  assert.equal(j1, toMenuJson(fromMenuJson(j1)));
});

test('migrateV1 chrome panels carry a box with a fill', () => {
  const m = migrateV1(defaultHomeLayout());
  const panels = m.pages[0]!.elements.filter((e) => e.type === 'panel') as { box?: { fill?: string } }[];
  assert.ok(panels.length > 0);
  assert.ok(panels.every((p) => typeof p.box?.fill === 'string'));
});

test('named favourites collections round-trip and are discoverable', async () => {
  const { collectionsInLayout } = await import('../src/shared/menu-schema.ts');
  const json = JSON.stringify({
    format: MENU_FORMAT,
    pages: [
      {
        id: 'p', title: 'P', kind: 'custom', start: true,
        elements: [
          { id: 'ml', type: 'gameList', rect: [0, 0, 100, 100], source: 'favorites', collection: 'mario', style: 'list' },
          { id: 'bt', type: 'button', rect: [0, 0, 40, 20], label: 'Fav', action: { kind: 'favorite.toggle', collection: 'zelda' } },
          { id: 'bt2', type: 'button', rect: [0, 0, 40, 20], label: 'Fav?', action: { kind: 'favorite.toggle' } },
        ],
      },
    ],
  });
  const m = fromMenuJson(json);
  const ml = m.pages[0]!.elements[0] as { collection?: string };
  const bt = m.pages[0]!.elements[1] as { action: { kind: string; collection?: string } };
  assert.equal(ml.collection, 'mario');
  assert.equal(bt.action.kind, 'favorite.toggle');
  assert.equal(bt.action.collection, 'zelda');
  assert.deepEqual(collectionsInLayout(m), ['mario', 'zelda']);
  const j1 = toMenuJson(m);
  assert.equal(j1, toMenuJson(fromMenuJson(j1)));
});

test('grid name-label fields round-trip; band affects box height', async () => {
  const { gridBoxHeight, gridLabelBand } = await import('../src/shared/menu-schema.ts');
  const json = JSON.stringify({
    format: MENU_FORMAT,
    pages: [
      {
        id: 'p', title: 'P', kind: 'custom', start: true,
        elements: [
          {
            id: 'g', type: 'gameList', rect: [0, 0, 600, 400], source: 'all', style: 'grid',
            gridCols: 4, gridRows: 3, gridGap: 8, gridLabels: true, gridLabelPos: 'bottom', gridLabelWrap: false,
          },
        ],
      },
    ],
  });
  const m = fromMenuJson(json);
  const g = m.pages[0]!.elements[0] as {
    gridLabels?: boolean; gridLabelPos?: string; gridLabelWrap?: boolean;
  };
  assert.equal(g.gridLabels, true);
  assert.equal(g.gridLabelPos, 'bottom');
  assert.equal(g.gridLabelWrap, false);
  assert.ok(gridLabelBand(g as never) > 0);
  assert.ok(gridBoxHeight(600, 4, 3, 8, gridLabelBand(g as never)) > gridBoxHeight(600, 4, 3, 8, 0));
  const j1 = toMenuJson(m);
  assert.equal(j1, toMenuJson(fromMenuJson(j1)));
});

test('gameList source: history round-trips', () => {
  const json = JSON.stringify({
    format: MENU_FORMAT,
    pages: [
      {
        id: 'p', title: 'P', kind: 'custom', start: true,
        elements: [{ id: 'recent', type: 'gameList', rect: [0, 0, 100, 100], source: 'history', style: 'list' }],
      },
    ],
  });
  const m = fromMenuJson(json);
  const g = m.pages[0]!.elements[0] as { source?: string };
  assert.equal(g.source, 'history');
  const j1 = toMenuJson(m);
  assert.equal(j1, toMenuJson(fromMenuJson(j1)));
});

test('overscan compensation round-trips, clamps, and drops zero', () => {
  const mk = (overscan: unknown) =>
    JSON.stringify({
      format: MENU_FORMAT,
      overscan,
      pages: [{ id: 'p', title: 'P', kind: 'custom', start: true, elements: [] }],
    });

  // a real value survives and is stable
  const m = fromMenuJson(mk(3));
  assert.equal(m.overscan, 3);
  const j1 = toMenuJson(m);
  assert.ok(j1.includes('"overscan": 3'));
  assert.equal(j1, toMenuJson(fromMenuJson(j1)));

  // 0 is the default — never written
  assert.ok(!toMenuJson(fromMenuJson(mk(0))).includes('overscan'));
  assert.equal(fromMenuJson(mk(0)).overscan, undefined);

  // out-of-range is clamped, fractions round, negatives are dropped (0 = default)
  assert.equal(fromMenuJson(mk(999)).overscan, 30);
  assert.equal(fromMenuJson(mk(-999)).overscan, undefined);
  assert.equal(fromMenuJson(mk(2.6)).overscan, 3);

  // the scale: 0 -> full frame 1:1, +1 shrinks 1% toward centre, floored at 0.70
  assert.equal(overscanScale(0), 1);
  assert.equal(Math.round(overscanScale(5) * 100) / 100, 0.95);
  assert.equal(overscanScale(30), 0.7);
});

test('startPage falls back to the first page when none is flagged', () => {
  const m = defaultMenuLayout();
  delete m.pages[0]!.start;
  assert.equal(startPage(m), m.pages[0]);
});

test('controller map (global + per-page buttons) round-trips; empty is omitted', () => {
  const json = JSON.stringify({
    format: MENU_FORMAT,
    buttons: { z: 'focusNext', junk: 'nope', a: 'not-an-action' },
    pages: [
      {
        id: 'p', title: 'P', kind: 'custom', start: true,
        buttons: { z: 'focusFiles', start: 'screensaver' },
        elements: [],
      },
      { id: 'q', title: 'Q', kind: 'custom', buttons: {}, elements: [] },
    ],
  });
  const m = fromMenuJson(json);
  assert.deepEqual(m.buttons, { z: 'focusNext' }, 'unknown keys/values dropped from global');
  assert.deepEqual(m.pages[0]!.buttons, { z: 'focusFiles', start: 'screensaver' });
  assert.equal(m.pages[1]!.buttons, undefined, 'empty page buttons object is dropped');

  const j1 = toMenuJson(m);
  assert.equal(j1, toMenuJson(fromMenuJson(j1)), 'byte-stable round-trip');
  assert.ok(!j1.includes('"buttons": {}'), 'no empty buttons object emitted');
});

test('box borderAlign round-trips; inside is the omitted default', () => {
  const json = JSON.stringify({
    format: MENU_FORMAT,
    pages: [
      {
        id: 'p', title: 'P', kind: 'custom', start: true,
        elements: [
          { id: 'a', type: 'panel', rect: [0, 0, 80, 40], box: { fill: '#111', border: '#eee', borderW: 3, borderAlign: 'outside' } },
          { id: 'b', type: 'panel', rect: [90, 0, 80, 40], box: { fill: '#111', border: '#eee', borderW: 3, borderAlign: 'inside' } },
        ],
      },
    ],
  });
  const m = fromMenuJson(json);
  const a = m.pages[0]!.elements[0] as { box?: { borderAlign?: string } };
  const b = m.pages[0]!.elements[1] as { box?: { borderAlign?: string } };
  assert.equal(a.box?.borderAlign, 'outside');
  assert.equal(b.box?.borderAlign, undefined, 'inside is the default, not stored');
  const j1 = toMenuJson(m);
  assert.equal(j1, toMenuJson(fromMenuJson(j1)));
  assert.ok(!j1.includes('"borderAlign": "inside"'));
});

test('fileList element round-trips', () => {
  const json = JSON.stringify({
    format: MENU_FORMAT,
    pages: [
      {
        id: 'p', title: 'P', kind: 'custom', start: true,
        elements: [
          {
            id: 'browser', type: 'fileList', rect: [20, 40, 600, 380],
            root: 'sd:/ROMS', rowH: 24, showSize: true, manage: true,
            fg: '#E7E9EF', dirColor: '#FFC828', romColor: '#3C8CFF', highlight: '#2C44D8', bg: '#000000',
          },
        ],
      },
    ],
  });
  const m = fromMenuJson(json);
  const fl = m.pages[0]!.elements[0] as { type: string; root?: string; manage?: boolean };
  assert.equal(fl.type, 'fileList');
  assert.equal(fl.root, 'sd:/ROMS');
  assert.equal(fl.manage, true);
  const j1 = toMenuJson(m);
  assert.equal(j1, toMenuJson(fromMenuJson(j1)));
});

test('popup theme: valid hex kept, junk dropped, empty omitted, round-trip stable', () => {
  const m = fromMenuJson(
    JSON.stringify({
      format: 2,
      theme: { popupBg: '#101820', popupText: '#c9d2f0', highlight: 'nope', junk: 1 },
      pages: [{ id: 'p', title: 'P', start: true, elements: [] }],
    }),
  );
  assert.deepEqual(m.theme, { popupBg: '#101820', popupText: '#C9D2F0' });
  const j1 = toMenuJson(m);
  assert.equal(JSON.parse(j1).theme.popupText, '#C9D2F0');
  assert.equal(j1, toMenuJson(fromMenuJson(j1)));

  const empty = fromMenuJson(
    JSON.stringify({ format: 2, theme: {}, pages: [{ id: 'p', title: 'P', start: true, elements: [] }] }),
  );
  assert.equal(empty.theme, undefined);
  assert.ok(!('theme' in JSON.parse(toMenuJson(empty))));
});

test('page background: skinOffset + skinSize round-trip', () => {
  const m = fromMenuJson(
    JSON.stringify({
      format: 2,
      pages: [
        {
          id: 'p', title: 'P', start: true,
          skin: 'bg.png', skinOffset: [-40, 12], skinSize: [800, 600],
          elements: [],
        },
      ],
    }),
  );
  assert.deepEqual(m.pages[0]!.skinOffset, [-40, 12]);
  assert.deepEqual(m.pages[0]!.skinSize, [800, 600]);
  const j1 = toMenuJson(m);
  assert.deepEqual(JSON.parse(j1).pages[0].skinSize, [800, 600]);
  assert.equal(j1, toMenuJson(fromMenuJson(j1)));
});

test('page background: skinHostPath survives a project-file round-trip', () => {
  // .n64menu keeps the source image's absolute path per page; loading a project
  // re-reads its layout through fromMenuJson, which must not drop it
  const layout = {
    format: 2,
    pages: [
      {
        id: 'p', title: 'P', start: true,
        skin: 'bg.png', skinHostPath: 'E:\\art\\bg.png', skinSize: [640, 480],
        elements: [],
      },
    ],
  };
  const m = fromMenuJson(JSON.stringify(layout));
  assert.equal(m.pages[0]!.skinHostPath, 'E:\\art\\bg.png');
  // …but it never leaks into the menu.json shipped to the card
  assert.equal(JSON.parse(toMenuJson(m)).pages[0].skinHostPath, undefined);
});
