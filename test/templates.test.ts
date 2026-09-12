import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  toMenuJson,
  fromMenuJson,
  defaultMenuLayout,
  startPage,
  MENU_FORMAT,
  MENU_FONTS,
  PAGE_LIMIT,
  PAGE_ELEMENT_LIMIT,
} from '../src/shared/menu-schema.ts';
import { TEMPLATES, templateLayout } from '../src/renderer/design/templates/index.ts';

const IDS = [
  'grand-tour',
  'blank',
  'minimal',
  'gallery',
  'command',
  'hyrule',
  'mushroom',
  'arcade',
];

/** The six styled themes all share this screen set. */
const THEME_IDS = ['minimal', 'gallery', 'command', 'hyrule', 'mushroom', 'arcade'];
const THEME_PAGES = ['home', 'library', 'grid', 'favourites', 'settings'];

test('the manifest lists exactly the first-batch templates, ids unique', () => {
  assert.deepEqual(
    TEMPLATES.map((t) => t.meta.id),
    IDS,
  );
  assert.equal(new Set(TEMPLATES.map((t) => t.meta.id)).size, TEMPLATES.length);
  for (const t of TEMPLATES) {
    assert.ok(t.meta.name.length > 0, `${t.meta.id} has a name`);
    assert.ok(t.meta.blurb.length > 0, `${t.meta.id} has a blurb`);
  }
});

test('grand-tour resolves to the same layout as the built-in default', () => {
  assert.equal(toMenuJson(templateLayout('grand-tour')), toMenuJson(defaultMenuLayout()));
});

for (const { meta } of TEMPLATES) {
  test(`template "${meta.id}" is a valid, stable format-2 layout`, () => {
    const layout = templateLayout(meta.id);

    assert.equal(layout.format, MENU_FORMAT);
    assert.ok(layout.pages.length >= 1 && layout.pages.length <= PAGE_LIMIT, 'page count in range');
    assert.equal(layout.pages.filter((p) => p.start).length, 1, 'exactly one start page');

    // serialize -> parse -> serialize is a fixed point
    const once = toMenuJson(layout);
    const twice = toMenuJson(fromMenuJson(once));
    assert.equal(twice, once, 'menu.json round-trip is stable');

    const pageIds = new Set(layout.pages.map((p) => p.id));

    for (const page of layout.pages) {
      assert.ok(page.elements.length <= PAGE_ELEMENT_LIMIT, `${page.id}: element count in range`);
      page.elements.forEach((e, i) => assert.equal(e.z, i, `${page.id}/${e.id}: contiguous z`));

      for (const el of page.elements) {
        const font = (el as { font?: string }).font;
        if (font) assert.ok(MENU_FONTS.includes(font), `${page.id}/${el.id}: font "${font}" is bundled`);

        if (el.type === 'button' && el.action.kind === 'goto') {
          assert.ok(pageIds.has(el.action.page), `${page.id}/${el.id}: goto -> "${el.action.page}" exists`);
        }
      }
    }
  });
}

test('blank template is a single empty page', () => {
  const layout = templateLayout('blank');
  assert.equal(layout.pages.length, 1);
  assert.equal(startPage(layout).elements.length, 0);
});

for (const id of THEME_IDS) {
  test(`theme "${id}" has the shared five-screen structure`, () => {
    const layout = templateLayout(id);
    assert.deepEqual(
      layout.pages.map((p) => p.id),
      THEME_PAGES,
      `${id} page ids`,
    );
    assert.equal(startPage(layout).id, 'home', `${id} boots to home`);
    // every theme decorates with at least one real image
    const imgs = layout.pages.flatMap((p) => p.elements.filter((e) => e.type === 'image'));
    assert.ok(imgs.length > 0, `${id} uses images`);
    for (const el of imgs) {
      assert.match((el as { src: string }).src, /^boxart\/[A-Z0-9]{4}\/[a-z0-9]+\.png$/, `${id}/${el.id} src`);
    }
  });
}
