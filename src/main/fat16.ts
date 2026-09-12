/**
 * fat16.ts — build a FAT16 disk image from an in-memory file tree, in pure JS.
 *
 * gopher64 emulates the SC64's SD card as a 64 MB FAT16 image file; the "Test
 * Menu" preview hands it a fresh one holding the current design's menu.json plus
 * a handful of stub ROMs so the game lists aren't empty.
 *
 * Only what that needs: one fixed geometry (512-byte sectors, 4 sec/cluster,
 * 2 FATs, 512 root entries — matching what gopher64 itself creates), files and
 * sub-directories written sequentially (so cluster chains are always contiguous),
 * short 8.3 names plus VFAT long-name entries for anything that isn't already
 * 8.3-clean. No deletion, no fragmentation, no free-space search.
 */

export interface Dir {
  [name: string]: Uint8Array | Dir;
}

const SECTOR = 512;
const SEC_PER_CLUSTER = 4;
const CLUSTER = SECTOR * SEC_PER_CLUSTER; // 2048
const RESERVED_SECTORS = 1;
const NUM_FATS = 2;
const ROOT_ENTRIES = 512;
const ROOT_SECTORS = (ROOT_ENTRIES * 32) / SECTOR; // 32
const DIR_ENTRY = 32;

const isDir = (v: Uint8Array | Dir): v is Dir => !(v instanceof Uint8Array);

const OK83 = /^[A-Z0-9_!#$%&'()@^~-]+$/;

/** The UPPERCASE 8.3 form if `name` fits one exactly (case aside), else null. */
function pure83(name: string): { base: string; ext: string } | null {
  const dot = name.lastIndexOf('.');
  const b = (dot > 0 ? name.slice(0, dot) : name).toUpperCase();
  const x = (dot > 0 ? name.slice(dot + 1) : '').toUpperCase();
  if (b.length === 0 || b.length > 8 || x.length > 3) return null;
  if (!OK83.test(b) || (x && !OK83.test(x))) return null;
  return { base: b.padEnd(8, ' '), ext: x.padEnd(3, ' ') };
}

/** True when the on-disk 8.3 name is a lossless uppercase of `name` — no LFN needed. */
function is83Lossless(name: string, base: string, ext: string): boolean {
  const p = pure83(name);
  return !!p && p.base === base && p.ext === ext && name === name.toUpperCase();
}

function shortNameFor(name: string, taken: Set<string>): { base: string; ext: string } {
  const p = pure83(name);
  if (p && !taken.has(p.base + p.ext)) {
    taken.add(p.base + p.ext);
    return p;
  }
  const dot = name.lastIndexOf('.');
  const ext = (dot > 0 ? name.slice(dot + 1) : '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, ' ');
  const stem = (dot > 0 ? name.slice(0, dot) : name).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'FILE';
  for (let n = 1; n < 1000; n++) {
    const tail = '~' + n;
    const base = (stem.slice(0, 8 - tail.length) + tail).padEnd(8, ' ');
    if (!taken.has(base + ext)) {
      taken.add(base + ext);
      return { base, ext };
    }
  }
  throw new Error('cannot allocate a short name for ' + name);
}

function lfnChecksum(base: string, ext: string): number {
  let sum = 0;
  for (const c of base + ext) sum = (((sum & 1) << 7) + (sum >> 1) + c.charCodeAt(0)) & 0xff;
  return sum;
}

const LFN_OFFS = [1, 3, 5, 7, 9, 14, 16, 18, 20, 22, 24, 28, 30]; // 13 char slots

/** LFN entries (on-disk order — highest sequence first) for `name`, or [] when
 *  the 8.3 name already represents it losslessly. */
function lfnEntries(name: string, base: string, ext: string): Buffer[] {
  if (is83Lossless(name, base, ext)) return [];
  const chk = lfnChecksum(base, ext);
  const chars = Array.from(name).map((c) => c.charCodeAt(0));
  const total = Math.ceil((chars.length + 1) / 13);
  const parts: Buffer[] = [];
  for (let i = 0; i < total; i++) {
    const e = Buffer.alloc(32);
    e[0] = (i === total - 1 ? 0x40 : 0) | (i + 1);
    e[11] = 0x0f;
    e[13] = chk;
    for (let s = 0; s < 13; s++) {
      const idx = i * 13 + s;
      const code = idx < chars.length ? chars[idx]! : idx === chars.length ? 0 : 0xffff;
      e.writeUInt16LE(code, LFN_OFFS[s]!);
    }
    parts.push(e);
  }
  return parts.reverse();
}

function dirEntry(base: string, ext: string, attr: number, firstCluster: number, size: number): Buffer {
  const e = Buffer.alloc(32);
  e.write(base, 0, 'latin1');
  e.write(ext, 8, 'latin1');
  e[11] = attr;
  e.writeUInt16LE(0x21, 22); // time
  e.writeUInt16LE(0x5a21, 24); // date (2025-01-01)
  e.writeUInt16LE(firstCluster & 0xffff, 26);
  e.writeUInt32LE(size >>> 0, 28);
  return e;
}

/**
 * Build a FAT16 image.
 * @param tree      nested { name: bytes | subtree }
 * @param totalBytes image size (default 64 MiB, gopher64's size)
 * @param label     11-char volume label
 */
export function buildFat16(tree: Dir, opts: { totalBytes?: number; label?: string } = {}): Buffer {
  const totalBytes = opts.totalBytes ?? 64 * 1024 * 1024;
  const label = (opts.label ?? 'SC64').toUpperCase().slice(0, 11).padEnd(11, ' ');
  const totalSectors = Math.floor(totalBytes / SECTOR);

  const dataStartSector = RESERVED_SECTORS + NUM_FATS * fatSectorsFor(totalSectors) + ROOT_SECTORS;
  const totalClusters = Math.floor((totalSectors - dataStartSector) / SEC_PER_CLUSTER);
  if (totalClusters < 4085 || totalClusters > 65524) {
    throw new Error(`FAT16 cluster count out of range: ${totalClusters}`);
  }
  const fatSectors = fatSectorsFor(totalSectors);

  const img = Buffer.alloc(totalBytes);
  const fat = new Uint16Array(totalClusters + 2);
  fat[0] = 0xfff8;
  fat[1] = 0xffff;

  let nextCluster = 2;
  const allocChain = (byteLen: number): number => {
    const need = Math.max(1, Math.ceil(byteLen / CLUSTER));
    const start = nextCluster;
    for (let i = 0; i < need; i++) {
      const c = nextCluster++;
      if (c >= totalClusters + 2) throw new Error('preview image is full');
      fat[c] = i === need - 1 ? 0xffff : c + 1;
    }
    return start;
  };
  const clusterOffset = (c: number) => (dataStartSector + (c - 2) * SEC_PER_CLUSTER) * SECTOR;

  const writeData = (startCluster: number, data: Buffer) => {
    let c = startCluster;
    let p = 0;
    while (p < data.length) {
      const n = Math.min(CLUSTER, data.length - p);
      data.copy(img, clusterOffset(c), p, p + n);
      p += n;
      c = fat[c] ?? 0xffff;
      if (p < data.length && (c < 2 || c >= 0xfff8)) throw new Error('chain too short');
    }
  };

  /** Write a directory's entries into its (already-reserved) cluster. Preview
   *  directories hold well under one 2 KB cluster (64 entries). */
  const writeDir = (entries: Buffer[], selfCluster: number, parentCluster: number): void => {
    const dot = dirEntry('.       ', '   ', 0x10, selfCluster, 0);
    const dotdot = dirEntry('..      ', '   ', 0x10, parentCluster, 0);
    const all = Buffer.concat([dot, dotdot, ...entries, Buffer.alloc(DIR_ENTRY)]);
    if (all.length > CLUSTER) throw new Error('preview directory too large for one cluster');
    fat[selfCluster] = 0xffff;
    all.copy(img, clusterOffset(selfCluster));
  };

  // Build sub-trees depth-first; a directory's own cluster is reserved before
  // its children so '.'/'..'/children all resolve.
  const buildSubtree = (node: Dir, selfCluster: number, parentCluster: number) => {
    const taken = new Set<string>();
    const entries: Buffer[] = [];
    for (const [name, val] of Object.entries(node)) {
      const { base, ext } = shortNameFor(name, taken);
      if (isDir(val)) {
        const childCluster = nextCluster++;
        fat[childCluster] = 0xffff;
        entries.push(...lfnEntries(name, base, ext), dirEntry(base, ext, 0x10, childCluster, 0));
        buildSubtree(val, childCluster, selfCluster);
      } else {
        const data = Buffer.from(val);
        const first = data.length > 0 ? allocChain(data.length) : 0;
        if (data.length > 0) writeData(first, data);
        entries.push(...lfnEntries(name, base, ext), dirEntry(base, ext, 0x20, first, data.length));
      }
    }
    writeDir(entries, selfCluster, parentCluster);
  };

  // Root directory is a fixed region, not a cluster chain.
  const rootStart = (RESERVED_SECTORS + NUM_FATS * fatSectors) * SECTOR;
  const taken = new Set<string>();
  const rootEntries: Buffer[] = [dirEntry(label, '   ', 0x08, 0, 0)];
  for (const [name, val] of Object.entries(tree)) {
    const { base, ext } = shortNameFor(name, taken);
    if (isDir(val)) {
      const childCluster = nextCluster++;
      fat[childCluster] = 0xffff;
      rootEntries.push(...lfnEntries(name, base, ext), dirEntry(base, ext, 0x10, childCluster, 0));
      buildSubtree(val, childCluster, 0);
    } else {
      const data = Buffer.from(val);
      const first = data.length > 0 ? allocChain(data.length) : 0;
      if (data.length > 0) writeData(first, data);
      rootEntries.push(...lfnEntries(name, base, ext), dirEntry(base, ext, 0x20, first, data.length));
    }
  }
  Buffer.concat(rootEntries).copy(img, rootStart);

  // Boot sector / BPB
  const bs = img;
  bs[0] = 0xeb; bs[1] = 0x3c; bs[2] = 0x90;
  bs.write('MSWIN4.1', 3, 'latin1');
  bs.writeUInt16LE(SECTOR, 11);
  bs[13] = SEC_PER_CLUSTER;
  bs.writeUInt16LE(RESERVED_SECTORS, 14);
  bs[16] = NUM_FATS;
  bs.writeUInt16LE(ROOT_ENTRIES, 17);
  bs.writeUInt16LE(totalSectors > 0xffff ? 0 : totalSectors, 19);
  bs[21] = 0xf8;
  bs.writeUInt16LE(fatSectors, 22);
  bs.writeUInt16LE(32, 24); // sec/track
  bs.writeUInt16LE(64, 26); // heads
  bs.writeUInt32LE(0, 28); // hidden
  bs.writeUInt32LE(totalSectors > 0xffff ? totalSectors : 0, 32);
  bs[36] = 0x80; // drive
  bs[38] = 0x29; // ext boot sig
  bs.writeUInt32LE(0x12345678, 39);
  bs.write(label, 43, 'latin1');
  bs.write('FAT16   ', 54, 'latin1');
  bs.writeUInt16LE(0xaa55, 510);

  // FATs
  const fatBytes = Buffer.alloc(fatSectors * SECTOR);
  for (let i = 0; i < fat.length; i++) fatBytes.writeUInt16LE(fat[i]!, i * 2);
  fatBytes.copy(img, RESERVED_SECTORS * SECTOR);
  fatBytes.copy(img, (RESERVED_SECTORS + fatSectors) * SECTOR);

  return img;
}

function fatSectorsFor(totalSectors: number): number {
  // clusters ≈ (totalSectors - reserved - root - 2*fat) / spc  → solve for fat
  // one iteration is plenty at this size.
  let fatSec = 1;
  for (let i = 0; i < 4; i++) {
    const dataStart = RESERVED_SECTORS + NUM_FATS * fatSec + ROOT_SECTORS;
    const clusters = Math.floor((totalSectors - dataStart) / SEC_PER_CLUSTER);
    fatSec = Math.ceil(((clusters + 2) * 2) / SECTOR);
  }
  return fatSec;
}
