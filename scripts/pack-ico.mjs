// Packs build/icon.png into build/icon.ico (multi-resolution: 16-256px).
//
// Not electron-builder's own PNG->ICO conversion (a bundled WASM libvips
// build) — that pipeline produced corrupted pixel data for every source PNG
// tested, in every size, in this environment (valid ICO container, garbage
// image content — a WASM/Node compatibility bug, not a bad source file).
//
// Uses the classic uncompressed BMP-in-ICO frame format (BITMAPINFOHEADER +
// bottom-up BGRA + a 1bpp AND mask), not the newer PNG-compressed frame
// format — verified end-to-end (extracted the actual resource straight back
// out of a built .exe and rendered it) to embed correctly via electron-builder's
// resedit-based resource editor. Windows' own shell icon cache is extremely
// sticky in this environment (it kept showing a stale icon across freshly
// named copies with forced-new mtimes, for a file independently verified
// byte-for-byte correct) — don't trust Explorer/ExtractAssociatedIcon alone
// when changing this; re-verify by extracting the resource straight back out
// of the built exe (see scratch history for the method) if anything looks off.
//
// Run whenever build/icon.png changes — nothing else does this automatically.
//   node scripts/pack-ico.mjs

import { Jimp } from 'jimp';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILD = join(dirname(fileURLToPath(import.meta.url)), '..', 'build');
const SIZES = [16, 24, 32, 48, 64, 128, 256];

function bmpFrame(rgba, w, h) {
  const headerSize = 40;
  const colorSize = w * h * 4;
  const maskRowBytes = Math.ceil(w / 32) * 4;
  const maskSize = maskRowBytes * h;

  const buf = Buffer.alloc(headerSize + colorSize + maskSize);
  buf.writeUInt32LE(headerSize, 0);
  buf.writeInt32LE(w, 4);
  buf.writeInt32LE(h * 2, 8); // ICO convention: doubled to account for the AND mask
  buf.writeUInt16LE(1, 12); // planes
  buf.writeUInt16LE(32, 14); // bits per pixel
  buf.writeUInt32LE(0, 16); // BI_RGB, uncompressed
  buf.writeUInt32LE(colorSize, 20);

  // color data: bottom-up rows, BGRA
  for (let y = 0; y < h; y++) {
    const srcY = h - 1 - y; // flip vertically
    for (let x = 0; x < w; x++) {
      const si = (srcY * w + x) * 4;
      const di = headerSize + (y * w + x) * 4;
      buf[di] = rgba[si + 2]; // B
      buf[di + 1] = rgba[si + 1]; // G
      buf[di + 2] = rgba[si]; // R
      buf[di + 3] = rgba[si + 3]; // A
    }
  }
  // AND mask: all zero (fully "not masked" — alpha channel alone drives transparency)
  return { size: buf.length, data: buf };
}

async function frameFor(src, size) {
  const img = await Jimp.read(src);
  img.resize({ w: size, h: size });
  const { size: dataSize, data } = bmpFrame(img.bitmap.data, size, size);
  return { size, dataSize, data };
}

function packIco(frames) {
  const count = frames.length;
  let offset = 6 + count * 16;
  const header = Buffer.allocUnsafe(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const dir = frames.map(({ size, dataSize }) => {
    const entry = Buffer.allocUnsafe(16);
    const w = size === 256 ? 0 : size; // ICO convention: 256 encodes as 0 in the 1-byte field
    entry.writeUInt8(w, 0);
    entry.writeUInt8(w, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(dataSize, 8);
    entry.writeUInt32LE(offset, 12);
    offset += dataSize;
    return entry;
  });
  return Buffer.concat([header, ...dir, ...frames.map((f) => f.data)]);
}

const src = join(BUILD, 'icon.png');
const out = join(BUILD, 'icon.ico');
const frames = await Promise.all(SIZES.map((s) => frameFor(src, s)));
writeFileSync(out, packIco(frames));
console.log('wrote', out, `(${frames.length} frames: ${SIZES.join(', ')})`);
