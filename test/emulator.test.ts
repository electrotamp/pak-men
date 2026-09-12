import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildFat16 } from '../src/main/fat16.ts';
import { buildPreviewImage } from '../src/main/emulator.ts';
import { defaultMenuLayout, toMenuJson } from '../src/shared/menu-schema.ts';
import { defaultSettings } from '../src/shared/settings-schema.ts';
import type { Project } from '../src/shared/types.ts';

/** Minimal FAT16 reader: resolve a path to its file bytes. Enough to prove the
 *  image the emulator gets is actually mountable. */
function readFat16(img: Buffer, path: string): Buffer | null {
  const bytesPerSec = img.readUInt16LE(11);
  const secPerClus = img[13]!;
  const reserved = img.readUInt16LE(14);
  const numFats = img[16]!;
  const rootEntries = img.readUInt16LE(17);
  const secPerFat = img.readUInt16LE(22);
  const rootStart = (reserved + numFats * secPerFat) * bytesPerSec;
  const rootSectors = Math.ceil((rootEntries * 32) / bytesPerSec);
  const dataStart = rootStart + rootSectors * bytesPerSec;
  const fatOff = reserved * bytesPerSec;
  const clusterBytes = secPerClus * bytesPerSec;
  const fatNext = (c: number) => img.readUInt16LE(fatOff + c * 2);
  const clusterOff = (c: number) => dataStart + (c - 2) * clusterBytes;

  const readChain = (first: number, size: number): Buffer => {
    const out: Buffer[] = [];
    let c = first;
    let left = size;
    while (c >= 2 && c < 0xfff8 && left > 0) {
      const n = Math.min(clusterBytes, left);
      out.push(img.subarray(clusterOff(c), clusterOff(c) + n));
      left -= n;
      c = fatNext(c);
    }
    return Buffer.concat(out);
  };

  const scan = (buf: Buffer, base: number, want: string): { cluster: number; size: number; dir: boolean } | null => {
    let lfn = '';
    for (let i = 0; i < buf.length; i += 32) {
      const e = buf.subarray(i, i + 32);
      if (e[0] === 0x00) break;
      if (e[0] === 0xe5) { lfn = ''; continue; }
      if (e[11] === 0x0f) {
        let part = '';
        for (const o of [1, 3, 5, 7, 9, 14, 16, 18, 20, 22, 24, 28, 30]) {
          const ch = e.readUInt16LE(o);
          if (ch === 0 || ch === 0xffff) break;
          part += String.fromCharCode(ch);
        }
        lfn = part + lfn;
        continue;
      }
      const short = (e.toString('latin1', 0, 8).trimEnd() + (e[8] !== 0x20 ? '.' + e.toString('latin1', 8, 11).trimEnd() : '')).toUpperCase();
      const name = (lfn || short).toUpperCase();
      lfn = '';
      if (name === want.toUpperCase()) {
        return { cluster: e.readUInt16LE(26), size: e.readUInt32LE(28), dir: (e[11]! & 0x10) !== 0 };
      }
    }
    return null;
  };

  let dirBuf = img.subarray(rootStart, rootStart + rootSectors * bytesPerSec);
  const parts = path.split('/').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const hit = scan(dirBuf, 0, parts[i]!);
    if (!hit) return null;
    if (i === parts.length - 1) return hit.dir ? null : readChain(hit.cluster, hit.size);
    dirBuf = readChain(hit.cluster, 64 * 1024);
  }
  return null;
}

test('fat16: nested dirs + long filenames round-trip', () => {
  const img = buildFat16({
    menu: { n64ever: { ui: { 'menu.json': Buffer.from('{"format":2}'), assets: {} } } },
    ROMS: { 'Super Mario 64.z64': Buffer.from('rom-bytes-here') },
  });
  assert.equal(img.readUInt16LE(510), 0xaa55, 'boot signature');
  assert.equal(readFat16(img, 'menu/n64ever/ui/menu.json')?.toString(), '{"format":2}');
  assert.equal(readFat16(img, 'ROMS/Super Mario 64.z64')?.toString(), 'rom-bytes-here');
});

test('buildPreviewImage: the design lands in a mountable image', async () => {
  const layout = defaultMenuLayout();
  const project: Project = {
    name: 'Preview', storagePrefix: 'sd:/', targetCarts: ['sc64'],
    romSources: [], favorites: [], history: [], discLinks: [],
    settings: defaultSettings(), layout,
  } as unknown as Project;

  const { img, menuJsonBytes } = await buildPreviewImage(project, {
    resourcesDir: new URL('../resources', import.meta.url).pathname,
  });

  assert.equal(img.length, 64 * 1024 * 1024);
  assert.ok(menuJsonBytes > 0 && menuJsonBytes <= 128 * 1024);

  const onCard = readFat16(img, 'menu/n64ever/ui/menu.json');
  assert.ok(onCard, 'menu.json is readable from the image');
  assert.equal(onCard!.length, menuJsonBytes);
  assert.equal(JSON.parse(onCard!.toString()).format, 2);

  // the stub game list is there
  assert.ok(readFat16(img, 'ROMS/Super Mario 64.z64'), 'sample ROM present');
  // migration marker so favourites/history aren't wiped
  assert.ok(readFat16(img, 'menu/n64ever/.migrated.v1') !== undefined);
});
