import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_BUTTON_MAP,
  applyEssentials,
  mapConflicts,
  mapUnbound,
  resolveButtonMap,
  trimButtonMap,
  normalizeButtonMap,
} from '../src/shared/input-map.ts';

test('resolveButtonMap layers stock -> global -> page', () => {
  const m = resolveButtonMap({ z: 'focusNext' }, { z: 'focusFiles', start: 'screensaver' });
  assert.equal(m.z, 'focusFiles', 'page override wins');
  assert.equal(m.start, 'screensaver', 'global-then-page inherit');
  assert.equal(m.a, 'enter', 'untouched stays stock');
});

test('applyEssentials guarantees select / back / a direction', () => {
  // unbind everything
  const bare = Object.fromEntries(Object.keys(DEFAULT_BUTTON_MAP).map((k) => [k, 'none'])) as Record<
    keyof typeof DEFAULT_BUTTON_MAP,
    'none'
  >;
  const fixed = applyEssentials(bare);
  assert.equal(fixed.a, 'enter');
  assert.equal(fixed.b, 'back');
  assert.ok(['up', 'down', 'left', 'right'].includes(fixed.d_up));
});

test('mapConflicts flags a discrete action on two controls, ignores directions', () => {
  const m = resolveButtonMap({ l: 'enter' }); // A and L both = enter
  const c = mapConflicts(m);
  assert.equal(c.length, 1);
  assert.equal(c[0]!.action, 'enter');
  assert.deepEqual(c[0]!.inputs.sort(), ['a', 'l']);

  // d_up + s_up both = up is NOT a conflict
  assert.equal(mapConflicts(resolveButtonMap()).length, 0);
});

test('mapUnbound reports missing essentials before the fallback hides them', () => {
  assert.deepEqual(mapUnbound({ a: 'none' }), ['enter']);
  assert.deepEqual(mapUnbound(), []);
});

test('trimButtonMap drops entries equal to the base', () => {
  assert.deepEqual(trimButtonMap({ a: 'enter', z: 'focusNext' }, DEFAULT_BUTTON_MAP), { z: 'focusNext' });
});

test('normalizeButtonMap keeps only known keys + values', () => {
  assert.deepEqual(normalizeButtonMap({ a: 'back', bogus: 'x', z: 'notReal' }), { a: 'back' });
  assert.deepEqual(normalizeButtonMap(null), {});
});
