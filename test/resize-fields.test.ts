import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scalesWithBox, scaleElementFields } from '../src/renderer/design/geometry.ts';
import type { Element } from '../src/shared/menu-schema.ts';

test('scalesWithBox: text opts out, everything else scales with its box', () => {
  assert.equal(scalesWithBox('text'), false);
  for (const t of ['button', 'panel', 'image', 'boxArt', 'gameList', 'infoPanel', 'setting', 'fileList'])
    assert.equal(scalesWithBox(t), true, t);
});

test('scaleElementFields still scales font + metrics (used by the group transform)', () => {
  const orig = { type: 'text', id: 't', rect: [0, 0, 100, 40], fontSize: 20, lineHeight: 24 } as unknown as Element;
  const el = structuredClone(orig);
  scaleElementFields(el, orig, 2);
  assert.equal((el as unknown as { fontSize: number }).fontSize, 40);
  assert.equal((el as unknown as { lineHeight: number }).lineHeight, 48);
});
