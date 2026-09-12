// Regenerates the bundled data the app ships with, from the firmware source of truth.
//   - src/shared/data/metadata-db.json   (from src/menu/game_metadata_db.h)
//   - src/shared/data/specials.json      (from src/menu/game_special.c)
//   - src/shared/data/dataver.json       (from src/menu/menu.c  MENU_DATA_VERSION)
//   - src/shared/data/art-index.json     (from assets/images/boxart/**)
//
// Run: npm run gen   (also runs automatically before dev/build)

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  stripComments,
  expandSimpleDefines,
  extractInitializerGroups,
  splitTopLevel,
  evalCValue,
} from './lib/cparse.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const REPO = join(APP, '..', '..');
const SRC = join(REPO, 'src', 'menu');
const OUT = join(APP, 'src', 'shared', 'data');
mkdirSync(OUT, { recursive: true });

const write = (name, data) => {
  const p = join(OUT, name);
  writeFileSync(p, JSON.stringify(data, null, name.endsWith('art-index.json') ? 0 : 2) + '\n');
  console.log(`  ${name.padEnd(20)} ${Array.isArray(data) ? data.length + ' entries' : ''}`);
};

// ---------------------------------------------------------------- metadata DB
function genMetadataDb() {
  const raw = readFileSync(join(SRC, 'game_metadata_db.h'), 'utf8');
  const src = expandSimpleDefines(stripComments(raw));
  const groups = extractInitializerGroups(src, 'game_db');
  const rows = groups.map((g) => {
    const f = splitTopLevel(g).map((x) => x.trim()).filter((x) => x !== '');
    // { base, title, developer, release_jp, release_us, release_eu, description }
    const [base, title, developer, jp, us, eu, desc] = f;
    return {
      base: evalCValue(base),
      title: evalCValue(title),
      developer: evalCValue(developer),
      release_jp: evalCValue(jp),
      release_us: evalCValue(us),
      release_eu: evalCValue(eu),
      description: evalCValue(desc),
    };
  });
  rows.sort((a, b) => (a.base < b.base ? -1 : a.base > b.base ? 1 : 0));
  write('metadata-db.json', rows);
  return rows;
}

// ---------------------------------------------------------------- specials
function genSpecials() {
  const raw = readFileSync(join(SRC, 'game_special.c'), 'utf8');
  const src = expandSimpleDefines(stripComments(raw));
  const groups = extractInitializerGroups(src, 'specials');
  const rows = groups.map((g) => {
    // designated initializers: .tokens = { "a", "b", NULL, NULL }, .art_code = "..", ...
    const out = { tokens: [], art_code: null, title: null, developer: null, release_jp: null, release_us: null, release_eu: null, description: null };
    for (const part of splitTopLevel(g)) {
      const m = /^\s*\.([A-Za-z_]\w*)\s*=\s*([\s\S]*)$/.exec(part);
      if (!m) continue;
      const key = m[1];
      const val = m[2].trim();
      if (key === 'tokens') {
        const inner = val.replace(/^\{/, '').replace(/\}$/, '');
        out.tokens = splitTopLevel(inner)
          .map((t) => {
            try {
              return evalCValue(t);
            } catch {
              return null;
            }
          })
          .filter((t) => t != null);
      } else if (key in out) {
        out[key] = evalCValue(val);
      }
    }
    return out;
  });
  write('specials.json', rows);
  return rows;
}

// ---------------------------------------------------------------- data version
function genDataVersion() {
  const raw = readFileSync(join(SRC, 'menu.c'), 'utf8');
  const m = /#define\s+MENU_DATA_VERSION\s+(\d+)/.exec(raw);
  if (!m) throw new Error('MENU_DATA_VERSION not found in menu.c');
  const data = { menuDataVersion: Number(m[1]) };
  write('dataver.json', data);
  return data;
}

// ---------------------------------------------------------------- art index
// Which boxart/<CODE>/<type>.png files exist in the repo's baked library, so the
// app can resolve covers (and region-fallback) without hitting the filesystem for
// every probe. Path is relative to assets/images/boxart/.
const ART_TYPES = ['front', 'back', 'box3d', 'cart', 'cart3d', 'logo'];
function genArtIndex() {
  const dir = join(REPO, 'assets', 'images', 'boxart');
  const index = {};
  if (!existsSync(dir)) {
    console.warn('  (assets/images/boxart not found — art-index will be empty)');
    write('art-index.json', index);
    return index;
  }
  for (const code of readdirSync(dir)) {
    const cdir = join(dir, code);
    if (!statSync(cdir).isDirectory()) continue;
    let mask = 0;
    for (let t = 0; t < ART_TYPES.length; t++) {
      if (existsSync(join(cdir, ART_TYPES[t] + '.png'))) mask |= 1 << t;
    }
    if (mask) index[code] = mask;
  }
  write('art-index.json', { types: ART_TYPES, codes: index });
  return index;
}

// ---------------------------------------------------------------- default layout
// The showcase menu.json (docs/examples/) is the single source of truth for both
// the SD-card default and the app's fresh-project / Reset layout. Copy it in +
// its image assets, so the renderer can `import` it and the exporter can bundle
// the emblem for a New→Export with no picked files.
function genDefaultLayout() {
  const src = join(REPO, 'docs', 'examples', 'menu.json');
  if (!existsSync(src)) {
    console.warn('  (docs/examples/menu.json not found — default-menu will be missing)');
    return;
  }
  const json = JSON.parse(readFileSync(src, 'utf8'));
  write('default-menu.json', json);

  const assetsSrc = join(REPO, 'docs', 'examples', 'assets');
  const assetsDst = join(APP, 'resources', 'default-assets');
  mkdirSync(assetsDst, { recursive: true });
  if (existsSync(assetsSrc))
    for (const f of readdirSync(assetsSrc)) {
      writeFileSync(join(assetsDst, f), readFileSync(join(assetsSrc, f)));
      console.log(`  default-assets/${f}`);
    }
}

console.log('menu-builder: regenerating bundled data');
genMetadataDb();
genSpecials();
genDataVersion();
genArtIndex();
genDefaultLayout();
console.log('done.');
