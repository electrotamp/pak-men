import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExport, configIni, effectiveSettings, MENU_DATA_VERSION } from '../src/main/exporter.ts';
import { defaultSettings } from '../src/shared/settings-schema.ts';
import type { Project } from '../src/shared/types.ts';

function baseProject(over: Partial<Project> = {}): Project {
  return {
    format: 2,
    name: 'Test',
    storagePrefix: 'sd:/',
    targetCarts: [],
    romSources: [{ hostDir: 'E:\\All n64', sdDir: '/All n64' }],
    favorites: [],
    history: [],
    settings: defaultSettings(),
    discLinks: [],
    ...over,
  };
}

test('config.ini: exact key order and format matches settings_save()', () => {
  const p = baseProject();
  const text = configIni(p.settings, effectiveSettings(p));
  const expected = [
    '[menu]',
    'schema_revision = 1',
    'first_run = false',
    'pal60 = false',
    'force_progressive_scan = false',
    'show_protected_entries = false',
    'default_directory = /',
    'disc_folder = ',
    'use_saves_folder = true',
    'show_saves_folder = false',
    'show_save_files = false',
    'show_cheat_files = false',
    'show_rom_configuration_files = false',
    'soundfx_enabled = false',
    'bgm_enabled = false',
    'reboot_rom_enabled = false',
    'grid_square_tiles = false',
    'grid_large_tiles = false',
    'splash_enabled = false',
    'background_image_enabled = false',
    'custom_splash_enabled = false',
    'use_custom_files = false',
    'always_sort_az = false',
    'use_legacy_font = false',
    'show_file_size = false',
    'screensaver_mode = 1',
    'screensaver_favorites_only = false',
    'screensaver_timeout_sec = 180',
    'image_view_grid = 0',
    'image_view_inspect = 1',
    'image_view_load = 3',
    'image_region_default = 0',
    'rom_boot_enabled = false',
    'first_boot_choose_folder = false',
    'rom_folder_chosen = false',
    '',
    '[rom_boot]',
    'path = ',
    'filename = ',
    'countdown_sec = 5',
    '',
  ].join('\n');
  assert.equal(text, expected);
});

test('effectiveSettings turns on use_custom_files when overrides exist', () => {
  const p = baseProject({
    favorites: [{ sdPath: 'sd:/All n64/x.z64', type: 1, gameCode: 'NSME', meta: { title: 'X' } }],
  });
  assert.equal(effectiveSettings(p)['menu.use_custom_files'], true);
  assert.equal(effectiveSettings(baseProject())['menu.use_custom_files'], false);
});

test('favorites.ini: shape, ordering, optional keys', async () => {
  const p = baseProject({
    favorites: [
      { sdPath: 'sd:/All n64/F-Zero X (USA).n64', type: 1, gameCode: 'CFZE' },
      { sdPath: 'sd:/All n64/Doshin.ndd', type: 2, gameCode: 'DDKJ', presentsAs: 3 },
    ],
  });
  const { files } = await buildExport(p, { resourcesDir: '/nonexistent' });
  const fav = files.find((f) => f.rel === 'menu/n64ever/favorites.ini')!;
  assert.equal(
    fav.data.toString(),
    '[favorite]\n' +
      '0_primary_path = sd:/All n64/F-Zero X (USA).n64\n' +
      '0_secondary_path = \n' +
      '0_type = 1\n' +
      '0_game_code = CFZE\n' +
      '1_primary_path = sd:/All n64/Doshin.ndd\n' +
      '1_secondary_path = \n' +
      '1_type = 2\n' +
      '1_game_code = DDKJ\n' +
      '1_presents_as = 3\n',
  );
});

test('migration marker is written and empty', async () => {
  const { files } = await buildExport(baseProject(), { resourcesDir: '/nonexistent' });
  const marker = files.find((f) => f.rel === `menu/n64ever/.migrated.v${MENU_DATA_VERSION}`)!;
  assert.ok(marker);
  assert.equal(marker.data.length, 0);
});

test('gameconfigs: only written when non-default; sections in firmware order', async () => {
  const p = baseProject({
    favorites: [
      { sdPath: 'sd:/All n64/Plain.z64', type: 1, gameCode: 'NSME' },
      {
        sdPath: 'sd:/All n64/Tweaked (USA).z64',
        type: 1,
        gameCode: 'NKTE',
        presentsAs: 2,
        boot: { cic: 6102, save: -1, tv: 1 },
        imageView: { grid: 3, inspect: -1 },
      },
    ],
  });
  const { files } = await buildExport(p, { resourcesDir: '/nonexistent' });
  assert.equal(files.find((f) => f.rel === 'menu/n64ever/gameconfigs/Plain.ini'), undefined);
  const gc = files.find((f) => f.rel === 'menu/n64ever/gameconfigs/Tweaked (USA).ini')!;
  assert.equal(
    gc.data.toString(),
    'presents_as = 2\n' +
      '\n[custom_boot]\n' +
      'cic_type = 6102\n' +
      'tv_type = 1\n' +
      '\n[presentation]\n' +
      'image_view_grid = 3\n',
  );
});

test('meta.ini keyed by uppercased 4-char code; disclink split by region', async () => {
  const p = baseProject({
    favorites: [
      {
        sdPath: 'sd:/All n64/Custom.z64',
        type: 1,
        gameCode: 'abcd',
        meta: { title: 'Custom Game', description: 'Hi; there' },
      },
    ],
    discLinks: [
      { code: 'EFZJ', sdPath: 'sd:/All n64/F-Zero X (Japan).n64' },
      { code: 'EFZE', sdPath: 'sd:/All n64/F-Zero X (USA).n64' },
    ],
  });
  const { files } = await buildExport(p, { resourcesDir: '/nonexistent' });
  const meta = files.find((f) => f.rel === 'menu/n64ever/gameconfigs/ABCD.meta.ini')!;
  assert.equal(meta.data.toString(), '[meta]\ntitle = Custom Game\ndescription = "Hi; there"\n');
  assert.equal(
    files.find((f) => f.rel === 'menu/n64ever/disclink_jp.ini')!.data.toString(),
    'EFZJ = sd:/All n64/F-Zero X (Japan).n64\n',
  );
  assert.equal(
    files.find((f) => f.rel === 'menu/n64ever/disclink_us.ini')!.data.toString(),
    'EFZE = sd:/All n64/F-Zero X (USA).n64\n',
  );
});
