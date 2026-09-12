import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExport } from '../src/main/exporter.ts';
import { importFromSd } from '../src/main/importer.ts';
import { commitExport } from '../src/main/exporter.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultSettings } from '../src/shared/settings-schema.ts';
import { defaultMenuLayout, newElement, toMenuJson, fromMenuJson } from '../src/shared/menu-schema.ts';
import type { Project } from '../src/shared/types.ts';

const BASE_PAGES = defaultMenuLayout().pages.length;

function proj(): Project {
  const layout = defaultMenuLayout();
  layout.buttons = { z: 'focusNext' };
  layout.pages.push({
    id: 'extra',
    title: 'Extra',
    kind: 'custom',
    buttons: { r: 'focusFiles' },
    elements: [newElement('gameList', 'g'), newElement('fileList', 'fb'), { ...newElement('image', 'pic'), src: 'logo.png' }],
  });
  layout.pages.push({ id: 'more', title: 'More', kind: 'custom', elements: [newElement('text', 't')] });
  return { format: 3, name: 'X', storagePrefix: 'sd:/', targetCarts: ['sc64'], romSources: [], favorites: [], history: [], settings: defaultSettings(), discLinks: [], layout };
}

test('export emits a valid menu.json and warns about the missing image', async () => {
  const b = await buildExport(proj(), { resourcesDir: '/nonexistent' });
  const mj = b.files.find((f) => f.rel === 'menu/n64ever/ui/menu.json');
  assert.ok(mj, 'menu.json is emitted');
  const parsed = JSON.parse(mj!.data.toString());
  assert.equal(parsed.format, 2);
  assert.equal(parsed.pages.length, BASE_PAGES + 2);
  assert.deepEqual(parsed.buttons, { z: 'focusNext' }, 'global buttons emitted');
  assert.deepEqual(parsed.pages.find((p: { id: string }) => p.id === 'extra').buttons, { r: 'focusFiles' });
  assert.ok(
    parsed.pages.some((p: { elements: { type: string }[] }) => p.elements.some((e) => e.type === 'fileList')),
    'fileList element emitted',
  );
  assert.ok(b.warnings.some((w) => w.includes('logo.png') || w.toLowerCase().includes('image')), 'warns about missing image source: ' + JSON.stringify(b.warnings));
});

test('export -> commit -> import -> export is stable for a layout', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mb-exp-'));
  try {
    const b1 = await buildExport(proj(), { resourcesDir: '/nonexistent' });
    await commitExport(b1, dir);
    const imported = await importFromSd(dir);
    assert.ok(imported.layout, 'layout re-imported');
    assert.equal(imported.layout!.pages.length, BASE_PAGES + 2);
    assert.equal(imported.layout!.pages.filter((p) => p.start).length, 1);
    const b2 = await buildExport(imported, { resourcesDir: '/nonexistent' });
    const m1 = b1.files.find((f) => f.rel.endsWith('menu.json'))!.data.toString();
    const m2 = b2.files.find((f) => f.rel.endsWith('menu.json'))!.data.toString();
    assert.equal(m1, m2, 'menu.json round-trips identically');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
