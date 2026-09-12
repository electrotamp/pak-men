// Copy the bundled art library and (if built) the menu ROMs into resources/ so
// electron-builder can package them. Safe to run repeatedly. NOT needed for `dev`
// (art.ts reads assets/images/boxart straight from the repo when unpackaged).

import { cpSync, mkdirSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const REPO = join(APP, '..', '..');
const RES = join(APP, 'resources');
mkdirSync(RES, { recursive: true });

const artSrc = join(REPO, 'assets', 'images', 'boxart');
if (existsSync(artSrc)) {
  cpSync(artSrc, join(RES, 'boxart'), { recursive: true });
  console.log('staged boxart ->', join(RES, 'boxart'));
} else {
  console.warn('! assets/images/boxart not found — packaged app will have no baked art');
}

// menu fonts for the Design-tab canvas preview
const fontSrc = join(REPO, 'assets', 'fonts');
if (existsSync(fontSrc)) {
  mkdirSync(join(RES, 'fonts'), { recursive: true });
  for (const f of ['PixelMplus12-Bold.ttf', 'Firple-Bold.ttf']) {
    if (existsSync(join(fontSrc, f))) copyFileSync(join(fontSrc, f), join(RES, 'fonts', f));
  }
  console.log('staged menu fonts -> resources/fonts');
}

// The bundled emulator for the "Test Menu" preview — just the single portable
// gopher64.exe (~62 MB). Its config + SD images are created at runtime in a
// per-user dir; the sample ROMs are compiled into src/main/emulator.ts.
const emuSrc = join(REPO, 'tools', 'emulator', 'gopher64.exe');
if (existsSync(emuSrc)) {
  mkdirSync(join(RES, 'emulator'), { recursive: true });
  copyFileSync(emuSrc, join(RES, 'emulator', 'gopher64.exe'));
  console.log('staged emulator -> resources/emulator/gopher64.exe');
} else {
  console.warn('! tools/emulator/gopher64.exe not found — run scripts/fetch-emulator.sh; "Test Menu" will be unavailable in this build');
}

// Only sc64menu.n64 is bundled — this is the SC64 repo and the primary target, and
// the four cart menu files are ~47 MB each (they carry the whole baked art DFS).
// Users on ED64 / 64drive get an export warning telling them to add their menu ROM;
// drop the other files into resources/menu-rom/ before `npm run dist` to bundle them.
const romDir = join(RES, 'menu-rom');
mkdirSync(romDir, { recursive: true });
const roms = (process.env.MENU_BUILDER_BUNDLE_ALL_ROMS ? ['sc64menu.n64', 'OS64.v64', 'OS64P.v64', 'menu.bin'] : ['sc64menu.n64']);

// Raw firmware artifacts live in build/rom/ (Makefile OUTPUT_DIR). This used to
// read REPO/output/, which is now the *release* folder — the mismatch silently
// left a months-old ROM in resources/menu-rom/, and since every Export writes the
// bundled ROM to the SD root, exporting quietly downgraded the card's firmware.
const ROM_BUILD_DIR = join(REPO, 'build', 'rom');
let staged = 0;
const missing = [];
for (const name of roms) {
  const src = join(ROM_BUILD_DIR, name);
  if (existsSync(src) && statSync(src).isFile()) {
    copyFileSync(src, join(romDir, name));
    console.log(`staged menu ROM ${name} <- build/rom/`);
    staged++;
  } else {
    missing.push(name);
  }
}

// Fail loudly rather than shipping whatever stale ROM happens to be sitting in
// resources/menu-rom/ — a silently stale bundle is indistinguishable from a
// correct one until it overwrites a user's working firmware.
if (!staged) {
  const stale = existsSync(join(romDir, 'sc64menu.n64'));
  console.error(
    `\n! No menu ROM found in build/rom/ (looked for: ${missing.join(', ')}).\n` +
      `  Build the firmware first:  build-wsl.bat   (or ./build-rom.sh)\n` +
      (stale
        ? `  resources/menu-rom/ still holds an OLD ROM. Packaging now would ship it,\n` +
          `  and every Export writes it to the SD card root — overwriting newer firmware.\n`
        : '') +
      `  Set MENU_BUILDER_ALLOW_NO_ROM=1 to package without a bundled ROM anyway.\n`,
  );
  if (!process.env.MENU_BUILDER_ALLOW_NO_ROM) process.exit(1);
}
