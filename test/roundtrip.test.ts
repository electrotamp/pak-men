import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildExport, commitExport } from '../src/main/exporter.ts';
import { importFromSd } from '../src/main/importer.ts';
import { defaultSettings } from '../src/shared/settings-schema.ts';
import type { Project } from '../src/shared/types.ts';

function project(): Project {
  const s = defaultSettings();
  s['menu.pal60'] = true;
  s['menu.screensaver_timeout_sec'] = 240;
  s['menu.image_view_grid'] = 2;
  return {
    format: 2,
    name: 'Roundtrip',
    storagePrefix: 'sd:/',
    targetCarts: [],
    romSources: [
      { hostDir: 'E:\\All n64', sdDir: '/All n64' },
      { hostDir: 'E:\\Disks', sdDir: '/Disks' },
    ],
    settings: s,
    favorites: [
      { sdPath: 'sd:/All n64/F-Zero X (USA).n64', type: 1, gameCode: 'CFZE' },
      {
        sdPath: 'sd:/All n64/Turok (USA).z64',
        type: 1,
        gameCode: 'NTWE',
        presentsAs: 2,
        boot: { cic: 6102, save: -1, tv: -1 },
        imageView: { grid: 3, inspect: -1, load: -1 },
        meta: { title: 'Turok: Dinosaur Hunter', developer: 'Iguana', description: 'Dino FPS.' },
      },
      { sdPath: 'sd:/Disks/F-Zero X Expansion Kit (Japan).ndd', type: 2, gameCode: 'EFZJ' },
    ],
    history: [{ sdPath: 'sd:/All n64/F-Zero X (USA).n64', type: 1, gameCode: 'CFZE' }],
    discLinks: [{ code: 'EFZJ', sdPath: 'sd:/All n64/F-Zero X (Japan).n64' }],
  };
}

test('export -> import -> export is stable (idempotent)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mb-rt-'));
  try {
    const p = project();
    const build1 = await buildExport(p, { resourcesDir: '/nonexistent' });
    await commitExport(build1, dir);

    // sanity: the key files exist
    for (const rel of [
      'menu/config.ini',
      'menu/n64ever/favorites.ini',
      'menu/n64ever/history.ini',
      'menu/n64ever/.migrated.v1',
      'menu/n64ever/gameconfigs/Turok (USA).ini',
      'menu/n64ever/gameconfigs/NTWE.meta.ini',
      'menu/n64ever/disclink_jp.ini',
    ]) {
      await readFile(join(dir, rel)); // throws if missing
    }

    const imported = await importFromSd(dir);
    assert.equal(imported.favorites.length, 3);
    assert.equal(imported.favorites[1]?.presentsAs, 2);
    assert.equal(imported.favorites[1]?.boot?.cic, 6102);
    assert.equal(imported.favorites[1]?.meta?.title, 'Turok: Dinosaur Hunter');
    assert.equal(imported.favorites[1]?.imageView?.grid, 3);
    assert.equal(imported.discLinks[0]?.code, 'EFZJ');
    assert.equal(imported.settings['menu.pal60'], true);
    assert.equal(imported.settings['menu.screensaver_timeout_sec'], 240);
    assert.equal(imported.settings['menu.image_view_grid'], 2);
    assert.deepEqual(
      [...imported.romSources.map((s) => s.sdDir)].sort(),
      ['/All n64', '/Disks'],
    );

    const build2 = await buildExport(imported, { resourcesDir: '/nonexistent' });
    const map1 = new Map(build1.files.map((f) => [f.rel, f.data.toString('base64')]));
    const map2 = new Map(build2.files.map((f) => [f.rel, f.data.toString('base64')]));
    assert.deepEqual([...map2.keys()].sort(), [...map1.keys()].sort());
    for (const [rel, data] of map2) {
      assert.equal(data, map1.get(rel), `file ${rel} differs after round-trip`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
