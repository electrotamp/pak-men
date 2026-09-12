import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampSkinRect, skinRectOf, skinDefaultSize } from '../src/renderer/design/layout-ops.ts';
import { FRAMEBUFFER, type Page } from '../src/shared/menu-schema.ts';

const page = (over: Partial<Page> = {}): Page =>
  ({ id: 'p', title: 'P', elements: [], ...over }) as Page;

test('skinDefaultSize: small image keeps its own pixels (never upscaled)', () => {
  assert.deepEqual(skinDefaultSize([200, 150]), [200, 150]);
});

test('skinDefaultSize: large image shrinks to fit the frame, aspect kept', () => {
  assert.deepEqual(skinDefaultSize([2000, 1000]), [640, 320]);
});

test('skinRectOf: no skinSize → the image at its default (fit) size, top-left', () => {
  assert.deepEqual(skinRectOf(page(), [800, 600]), [0, 0, 640, 480]);
  assert.deepEqual(skinRectOf(page(), [300, 200]), [0, 0, 300, 200]);
});

test('skinRectOf: an explicit skinSize wins over the image size', () => {
  const r = skinRectOf(page({ skinOffset: [10, 20], skinSize: [400, 260] }), [3000, 2000]);
  assert.deepEqual(r, [10, 20, 400, 260]);
});

test('clampSkinRect: caps a runaway size, never returns NaN', () => {
  const [, , w, h] = clampSkinRect(0, 0, 999999, 999999);
  assert.ok(w <= 5120 && h <= 5120 && w > 0 && h > 0);
  const r = clampSkinRect(NaN, Infinity, NaN, -Infinity);
  assert.ok(r.every((n) => Number.isFinite(n)));
});

test('clampSkinRect: offset can pan off-frame but not run away', () => {
  assert.deepEqual(clampSkinRect(99999, 99999, 640, 480), [FRAMEBUFFER.w, FRAMEBUFFER.h, 640, 480]);
  assert.deepEqual(clampSkinRect(-99999, -99999, 640, 480), [-640, -480, 640, 480]);
});
