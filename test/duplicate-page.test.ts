import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getState, setState } from '../src/renderer/store.ts';
import { duplicatePage, setDesignPage } from '../src/renderer/design/state.ts';
import { defaultMenuLayout } from '../src/shared/menu-schema.ts';
import type { Project } from '../src/shared/types.ts';

function load() {
  const layout = defaultMenuLayout();
  setState({
    project: {
      format: 2,
      name: 'T',
      storagePrefix: 'sd:/',
      targetCarts: [],
      romSources: [],
      settings: {},
      favorites: [],
      layout,
    } as unknown as Project,
  });
  setDesignPage(layout.pages[0]!.id);
  return layout;
}

test('duplicatePage: inserts a copy right after the source', () => {
  const layout = load();
  const src = layout.pages[1]!.id;
  const before = getState().project!.layout!.pages.map((p) => p.id);
  const newId = duplicatePage(src);
  const after = getState().project!.layout!.pages.map((p) => p.id);
  assert.equal(after[before.indexOf(src) + 1], newId);
  assert.equal(after.length, before.length + 1);
});

test('duplicatePage: clones every element and the background', () => {
  const layout = load();
  const src = getState().project!.layout!.pages.find((p) => p.elements.length > 0)!;
  const newId = duplicatePage(src.id)!;
  const copy = getState().project!.layout!.pages.find((p) => p.id === newId)!;
  assert.deepEqual(
    copy.elements.map((e) => e.type),
    src.elements.map((e) => e.type),
  );
  assert.equal(copy.background, src.background);
  assert.notEqual(copy, src); // a real deep copy, not a shared reference
});

test('duplicatePage: names the copy and never carries the start flag', () => {
  load();
  const start = getState().project!.layout!.pages.find((p) => p.start)!;
  const newId = duplicatePage(start.id)!;
  const copy = getState().project!.layout!.pages.find((p) => p.id === newId)!;
  assert.match(copy.title, /copy$/i);
  assert.ok(!copy.start);
  assert.equal(getState().project!.layout!.pages.filter((p) => p.start).length, 1);
});

test('duplicatePage: unique ids when duplicated repeatedly', () => {
  const layout = load();
  const src = layout.pages[0]!.id;
  const a = duplicatePage(src);
  const b = duplicatePage(src);
  assert.notEqual(a, b);
  const ids = getState().project!.layout!.pages.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});
