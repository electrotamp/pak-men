/**
 * Single source of truth for the menu's config.ini `[menu]` / `[rom_boot]` settings.
 *
 * The order of `SETTINGS_SCHEMA` is the exact order `settings_save()` writes keys
 * (src/menu/settings.c) so the exporter can produce a byte-identical file. The
 * `FEATURE_AUTOLOAD_ROM_ENABLED` compile flag is NOT set in this build, so the
 * `#else` key `reboot_rom_enabled` is emitted and there is no `[autoload]` section.
 *
 * UI metadata (`group`, `label`, `help`, `options`, `min`/`max`) drives the
 * Settings panel; it is not part of the file format.
 */

import { GRID_IMAGE_VIEW_LABELS, PRESENTS_AS_LABELS } from './enums.ts';

export type SettingKind = 'bool' | 'int' | 'string' | 'enum';

export interface SettingSpec {
  key: string;
  section: 'menu' | 'rom_boot';
  kind: SettingKind;
  default: boolean | number | string;
  /** UI grouping / copy. `hidden` settings are still written but not shown. */
  group?: string;
  label?: string;
  help?: string;
  options?: Array<{ value: number; label: string }>;
  min?: number;
  max?: number;
  hidden?: boolean;
}

const imageViewOptions = Object.entries(GRID_IMAGE_VIEW_LABELS).map(([v, label]) => ({
  value: Number(v),
  label,
}));
const regionOptions = Object.entries(PRESENTS_AS_LABELS).map(([v, label]) => ({
  value: Number(v),
  label,
}));

export const SETTINGS_SCHEMA: SettingSpec[] = [
  { key: 'schema_revision', section: 'menu', kind: 'int', default: 1, hidden: true },
  { key: 'first_run', section: 'menu', kind: 'bool', default: false, hidden: true },

  {
    key: 'pal60',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Video',
    label: 'PAL60',
    help: 'Run a PAL console at 60 Hz. On hardware the menu shows a revert countdown.',
  },
  {
    key: 'force_progressive_scan',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Video',
    label: 'Force progressive scan (240p)',
    help: 'For displays that struggle with interlaced video.',
  },
  {
    key: 'show_protected_entries',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'File browser',
    label: 'Show protected / filtered entries',
  },
  {
    key: 'default_directory',
    section: 'menu',
    kind: 'string',
    default: '/',
    group: 'ROM library',
    label: 'ROM folder',
    help:
      'SD folder the menu scans for games and the file browser opens to, relative to the storage prefix. Leave as / to auto-detect sd:/ROMS/ (falling back to the card root).',
  },
  {
    key: 'disc_folder',
    section: 'menu',
    kind: 'string',
    default: '',
    group: 'ROM library',
    label: '64DD disc folder',
    help: 'Folder the grid "Link disc" picker starts in. Blank = unset.',
  },
  {
    key: 'use_saves_folder',
    section: 'menu',
    kind: 'bool',
    default: true,
    group: 'Saves',
    label: 'Put saves in a "saves" folder',
  },
  {
    key: 'show_saves_folder',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Saves',
    label: 'Show the saves folder',
  },
  {
    key: 'show_save_files',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Saves',
    label: 'Show save files',
  },
  {
    key: 'show_cheat_files',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'File browser',
    label: 'Show cheat files',
  },
  {
    key: 'show_rom_configuration_files',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'File browser',
    label: 'Show ROM configuration files',
  },
  {
    key: 'soundfx_enabled',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Audio',
    label: 'Menu sound effects',
  },
  {
    key: 'bgm_enabled',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Audio',
    label: 'Background music',
  },
  {
    key: 'reboot_rom_enabled',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Start-up & boot',
    label: 'Fast reboot ROM on reset button',
  },
  {
    key: 'grid_square_tiles',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Games grid',
    label: 'Square tiles (letterbox art)',
  },
  {
    key: 'grid_large_tiles',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Games grid',
    label: 'Large tiles',
    help: 'Bigger covers, roughly one less row.',
  },
  {
    key: 'splash_enabled',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Start-up & boot',
    label: 'Show boot splash',
  },
  {
    key: 'background_image_enabled',
    section: 'menu',
    kind: 'bool',
    default: false,
    hidden: true,
  },
  {
    key: 'custom_splash_enabled',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Start-up & boot',
    label: 'Use custom splash image',
    help: 'Set automatically when you add a splash image on the Assets tab.',
  },
  {
    key: 'use_custom_files',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'ROM library',
    label: 'Honor per-game override files',
    help:
      'Required for custom art / metadata in menu/n64ever/gameconfigs/. The exporter turns this on automatically when your project has any per-game overrides.',
  },
  {
    key: 'always_sort_az',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Games grid',
    label: 'Always sort grid A-Z',
  },
  {
    key: 'use_legacy_font',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Games grid',
    label: 'Use legacy font (Firple)',
  },
  {
    key: 'show_file_size',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'File browser',
    label: 'Show file sizes',
  },
  {
    key: 'screensaver_mode',
    section: 'menu',
    kind: 'enum',
    default: 1,
    group: 'Screensaver',
    label: 'Screensaver',
    options: [
      { value: 0, label: 'Off' },
      { value: 1, label: 'On (cover-art marquee)' },
    ],
  },
  {
    key: 'screensaver_favorites_only',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Screensaver',
    label: 'Screensaver: favorites only',
  },
  {
    key: 'screensaver_timeout_sec',
    section: 'menu',
    kind: 'int',
    default: 180,
    min: 30,
    max: 3600,
    group: 'Screensaver',
    label: 'Screensaver idle timeout (seconds)',
  },
  {
    key: 'image_view_grid',
    section: 'menu',
    kind: 'enum',
    default: 0,
    options: imageViewOptions,
    group: 'Games grid',
    label: 'Grid image',
  },
  {
    key: 'image_view_inspect',
    section: 'menu',
    kind: 'enum',
    default: 1,
    options: imageViewOptions,
    group: 'Games grid',
    label: 'Inspect popup image',
  },
  {
    key: 'image_view_load',
    section: 'menu',
    kind: 'enum',
    default: 3,
    options: imageViewOptions,
    group: 'Games grid',
    label: 'Load screen image',
  },
  {
    key: 'image_region_default',
    section: 'menu',
    kind: 'enum',
    default: 0,
    options: regionOptions,
    group: 'Games grid',
    label: 'Default box-art region',
  },
  {
    key: 'rom_boot_enabled',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'Start-up & boot',
    label: 'ROM boot on power-on',
    help: 'Show a chosen ROM with a countdown at power-on. Configure the ROM on the Boot tab.',
  },
  {
    key: 'first_boot_choose_folder',
    section: 'menu',
    kind: 'bool',
    default: false,
    group: 'ROM library',
    label: 'Let me choose the ROM folder on first boot',
    help:
      "Off (default): the menu auto-detects sd:/ROMS/, falling back to the ROM folder above, then the card root. On: right after a fresh flash, the menu shows a folder picker before it loads, and that choice becomes the ROM folder. This menu requires a reflash either way, so it's safe to turn on or off at any time.",
  },
  { key: 'rom_folder_chosen', section: 'menu', kind: 'bool', default: false, hidden: true },

  {
    key: 'path',
    section: 'rom_boot',
    kind: 'string',
    default: '',
    group: 'Start-up & boot',
    label: 'ROM boot: directory',
    help: 'Directory of the boot ROM, relative to the storage prefix.',
  },
  {
    key: 'filename',
    section: 'rom_boot',
    kind: 'string',
    default: '',
    group: 'Start-up & boot',
    label: 'ROM boot: filename',
  },
  {
    key: 'countdown_sec',
    section: 'rom_boot',
    kind: 'int',
    default: 5,
    min: 1,
    max: 15,
    group: 'Start-up & boot',
    label: 'ROM boot: countdown (seconds)',
  },
];

export type SettingsValues = Record<string, boolean | number | string>;

export function defaultSettings(): SettingsValues {
  const v: SettingsValues = {};
  for (const s of SETTINGS_SCHEMA) v[settingId(s)] = s.default;
  return v;
}

/** Stable id for a setting across the two sections (e.g. "rom_boot.path"). */
export function settingId(s: Pick<SettingSpec, 'section' | 'key'>): string {
  return `${s.section}.${s.key}`;
}
