/**
 * ROM / 64DD-disk identification. Ports the parts of the firmware that decide a
 * game's code, region, CIC and display name:
 *   - byte-order normalization (.z64 / .n64 / .v64)          rom_info.c
 *   - IPL3 checksum CIC detection                            src/boot/cic.c
 *   - special-edition filename match                         game_special.c
 *   - 64DD descriptive-filename keyword remap                games_grid.c match_64dd_filename
 *   - filename-derived display name                          games_grid.c fav_name_from_filename
 */

import { open } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import yauzl from 'yauzl';
import specialsData from '../shared/data/specials.json' with { type: 'json' };
import metadataDb from '../shared/data/metadata-db.json' with { type: 'json' };
import { regionLabel } from '../shared/enums.ts';

export const ROM_EXTS = ['.z64', '.n64', '.v64', '.rom', '.bin'];
export const DISK_EXTS = ['.ndd', '.d64'];
export const ARCHIVE_EXTS = ['.zip'];
export const ALL_ROM_LIKE_EXTS = [...ROM_EXTS, ...DISK_EXTS, ...ARCHIVE_EXTS];

interface Special {
  tokens: string[];
  art_code: string | null;
  title: string | null;
  developer: string | null;
  release_jp: string | null;
  release_us: string | null;
  release_eu: string | null;
  description: string | null;
}
interface DbEntry {
  base: string;
  title: string | null;
  developer: string | null;
  release_jp: string | null;
  release_us: string | null;
  release_eu: string | null;
  description: string | null;
}
const SPECIALS = specialsData as Special[];
const DB = metadataDb as DbEntry[];
const DB_BY_BASE = new Map(DB.map((e) => [e.base, e]));

export interface RomIdentity {
  type: 1 | 2;
  gameCode?: string;
  headerTitle?: string;
  regionByte?: string;
  regionLabel?: string;
  detectedCic?: number;
  special: number;
  displayName: string;
  description?: string;
  developer?: string;
  releaseJp?: string;
  releaseUs?: string;
  releaseEu?: string;
  error?: string;
}

// --------------------------------------------------------------- byte order

const MAGIC_Z64 = 0x80371240; // big-endian, native
const MAGIC_N64 = 0x40123780; // little-endian (byte-swapped words)
const MAGIC_V64 = 0x37804012; // byteswapped (halfword swap)

/** Return a big-endian ("z64") copy of the first `len` bytes, or null if not a ROM. */
export function normalizeRomHead(buf: Buffer): Buffer | null {
  if (buf.length < 4) return null;
  const magic = buf.readUInt32BE(0);
  if (magic === MAGIC_Z64) return Buffer.from(buf);
  const out = Buffer.from(buf);
  const swap = (a: number, b: number) => {
    const t = out[a]!;
    out[a] = out[b]!;
    out[b] = t;
  };
  if (magic === MAGIC_N64) {
    for (let i = 0; i + 3 < out.length; i += 4) {
      swap(i, i + 3);
      swap(i + 1, i + 2);
    }
    return out;
  }
  if (magic === MAGIC_V64) {
    for (let i = 0; i + 1 < out.length; i += 2) swap(i, i + 1);
    return out;
  }
  return null;
}

// --------------------------------------------------------------- header

export interface RomHeader {
  title: string;
  gameCode: string;
  categoryByte: string;
  destByte: string;
  version: number;
}

export function parseRomHeader(z64: Buffer): RomHeader {
  const rawTitle = z64.subarray(0x20, 0x34).toString('latin1');
  const title = cleanHeaderTitle(rawTitle);
  const gameCode = z64.subarray(0x3b, 0x3f).toString('latin1');
  return {
    title,
    gameCode,
    categoryByte: gameCode[0] ?? '',
    destByte: gameCode[3] ?? '',
    version: z64[0x3f] ?? 0,
  };
}

/** Keep printable ASCII, drop rdpq escapes, trim — mirrors sanitize_display_name. */
export function cleanHeaderTitle(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c >= 0x20 && c <= 0x7e && ch !== '^' && ch !== '$') out += ch;
  }
  return out.replace(/\s+$/, '');
}

// --------------------------------------------------------------- CIC (src/boot/cic.c)

const u32 = (n: number) => n >>> 0;
const rol = (a: number, s: number) => u32((a << s) | (a >>> (-s & 31)));
const ror = (a: number, s: number) => u32((a >>> s) | (a << (-s & 31)));

function csum(a0: number, a1: number, a2: number): number {
  const prod = BigInt(u32(a0)) * BigInt(a1 === 0 ? u32(a2) : u32(a1));
  const hi = Number((prod >> 32n) & 0xffffffffn);
  const lo = Number(prod & 0xffffffffn);
  const diff = u32(hi - lo);
  return diff === 0 ? u32(a0) : diff;
}

function ipl3Checksum(ipl3: Buffer, seed: number): bigint {
  const MAGIC = 0x6c078965;
  const get = (i: number) => ipl3.readUInt32BE(i * 4);
  let data = get(0);
  let prev = data;
  let next = data;
  const init = u32(u32(Math.imul(MAGIC, seed) + 1) ^ data);
  const buf = new Array<number>(16).fill(init);

  for (let i = 1; i <= 1008; i++) {
    prev = data;
    data = next;
    buf[0] = u32(buf[0]! + csum(u32(1007 - i), data, i));
    buf[1] = csum(buf[1]!, data, i);
    buf[2] = u32(buf[2]! ^ data);
    buf[3] = u32(buf[3]! + csum(u32(data + 5), MAGIC, i));
    buf[4] = u32(buf[4]! + ror(data, prev & 0x1f));
    buf[5] = u32(buf[5]! + rol(data, prev >>> 27));
    buf[6] =
      data < buf[6]!
        ? u32(u32(buf[3]! + buf[6]!) ^ u32(data + i))
        : u32(u32(buf[4]! + data) ^ buf[6]!);
    buf[7] = csum(buf[7]!, rol(data, prev & 0x1f), i);
    buf[8] = csum(buf[8]!, ror(data, prev >>> 27), i);
    buf[9] = prev < data ? csum(buf[9]!, data, i) : u32(buf[9]! + data);
    if (i === 1008) break;
    next = get(i);
    buf[10] = csum(u32(buf[10]! + data), next, i);
    buf[11] = csum(u32(buf[11]! ^ data), next, i);
    buf[12] = u32(buf[12]! + u32(buf[8]! ^ data));
    buf[13] = u32(buf[13]! + u32(ror(data, data & 0x1f) + ror(next, next & 0x1f)));
    buf[14] = csum(csum(buf[14]!, ror(data, prev & 0x1f), i), ror(next, data & 0x1f), i);
    buf[15] = csum(csum(buf[15]!, rol(data, prev >>> 27), i), rol(next, data >>> 27), i);
  }

  const fb = new Array<number>(4).fill(buf[0]!);
  for (let i = 0; i < 16; i++) {
    const d = buf[i]!;
    fb[0] = u32(fb[0]! + ror(d, d & 0x1f));
    fb[1] = d < fb[0]! ? u32(fb[1]! + d) : csum(fb[1]!, d, i);
    fb[2] = ((d & 0x02) >> 1) === (d & 0x01) ? u32(fb[2]! + d) : csum(fb[2]!, d, i);
    fb[3] = (d & 0x01) === 0x01 ? u32(fb[3]! ^ d) : csum(fb[3]!, d, i);
  }
  const finalSum = csum(fb[0]!, fb[1]!, 16);
  const finalXor = u32(fb[3]! ^ fb[2]!);
  return ((BigInt(finalSum) & 0xffffn) << 32n) | BigInt(finalXor);
}

/** Detect rom_cic_type_t (the int stored in gameconfigs [custom_boot] cic_type). -1 = unknown. */
export function detectCic(z64: Buffer): number {
  if (z64.length < 0x1000) return 0;
  const ipl3 = z64.subarray(0x40, 0x1000);
  const s3f = ipl3Checksum(ipl3, 0x3f);
  if (s3f === 0x45cc73ee317an) return 6101;
  if (s3f === 0x44160ec5d9afn) return 7102;
  if (s3f === 0xa536c0f1d859n) return 6102;
  if (ipl3Checksum(ipl3, 0x78) === 0x586fd4709867n) return 6103;
  if (ipl3Checksum(ipl3, 0x85) === 0x2bbad4e6eb74n) return 6106;
  if (ipl3Checksum(ipl3, 0x91) === 0x8618a45bc2d3n) return 6105;
  const sdd = ipl3Checksum(ipl3, 0xdd);
  if (sdd === 0x6ee8d9e84970n) return 8401;
  if (sdd === 0x6c216495c8b9n) return 8301;
  if (sdd === 0xe27f43ba93acn) return 8302;
  if (sdd === 0x32b294e2ab90n) return 8303;
  if (sdd === 0x083c6c77e0b1n) return 5167;
  if (ipl3Checksum(ipl3, 0xde) === 0x05ba2ef0a5f1n) return 8501;
  return 0;
}

// --------------------------------------------------------------- names / specials

const GM_ISALNUM = (c: string) => /[A-Za-z0-9]/.test(c);

/** Port of game_special_match: all lowercase tokens must appear in the basename. */
export function matchSpecial(fileName: string): number {
  const low = basename(fileName).toLowerCase();
  for (let i = 0; i < SPECIALS.length; i++) {
    if (SPECIALS[i]!.tokens.every((t) => low.includes(t))) return i;
  }
  return -1;
}

export function getSpecial(index: number): Special | undefined {
  return index >= 0 ? SPECIALS[index] : undefined;
}

const DD_KEYWORDS: Array<[string, string]> = [
  ['tinkling', 'DKKJ'],
  ['liberation', 'DKKJ'],
  ['kaihou', 'DKKJ'],
  ['doshin', 'DKDJ'],
  ['paint', 'DMPJ'],
  ['polygon', 'DMGJ'],
  ['talent', 'DMTJ'],
  ['communication', 'DMBJ'],
  ['expansion kit', 'EFZJ'],
  ['japan pro golf', 'DPGJ'],
  ['pro golf', 'DPGJ'],
  ['dezaemon', 'DEZA'],
  ['randnet', 'DRDJ'],
  ['simcity', 'DSCJ'],
  ['sim city', 'DSCJ'],
];

/** Port of match_64dd_filename: NUD-/NUS- product code, then keyword table. */
export function match64ddFilename(fileName: string): string | null {
  const fn = basename(fileName);
  for (let i = 0; i < fn.length; i++) {
    const tag =
      (i === 0 || !GM_ISALNUM(fn[i - 1]!)) &&
      /[Nn]/.test(fn[i] ?? '') &&
      /[Uu]/.test(fn[i + 1] ?? '') &&
      /[DdSs]/.test(fn[i + 2] ?? '') &&
      fn[i + 3] === '-';
    if (!tag) continue;
    const c = fn.slice(i + 4, i + 8);
    if (/^[A-Za-z][A-Za-z0-9][A-Za-z0-9][A-Za-z]$/.test(c)) return c.toUpperCase();
  }
  const low = fn.toLowerCase();
  for (const [kw, code] of DD_KEYWORDS) if (low.includes(kw)) return code;
  return null;
}

/** Port of fav_name_from_filename: basename, drop extension and " (…)" / " […]" suffixes. */
export function nameFromFilename(fileName: string): string {
  let buf = basename(fileName);
  const dot = buf.lastIndexOf('.');
  if (dot > 0) buf = buf.slice(0, dot);
  const par = buf.indexOf(' (');
  if (par >= 0) buf = buf.slice(0, par);
  const brk = buf.indexOf(' [');
  if (brk >= 0) buf = buf.slice(0, brk);
  return buf.replace(/\s+$/, '');
}

export function dbLookup(gameCode: string): DbEntry | undefined {
  return DB_BY_BASE.get(gameCode.slice(0, 3));
}

// --------------------------------------------------------------- top-level

async function readHead(hostPath: string, ext: string, bytes = 0x2000): Promise<Buffer | null> {
  if (ARCHIVE_EXTS.includes(ext)) return readZipRomHead(hostPath, bytes);
  const fh = await open(hostPath, 'r');
  try {
    const b = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(b, 0, bytes, 0);
    return b.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

function readZipRomHead(zipPath: string, bytes: number): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('zip open failed'));
      let done = false;
      const finish = (v: Buffer | null) => {
        if (done) return;
        done = true;
        zip.close();
        resolve(v);
      };
      zip.on('entry', (entry) => {
        const e = extname(entry.fileName).toLowerCase();
        if (!ROM_EXTS.includes(e) && !DISK_EXTS.includes(e)) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (e2, stream) => {
          if (e2 || !stream) return finish(null);
          const chunks: Buffer[] = [];
          let got = 0;
          stream.on('data', (c: Buffer) => {
            chunks.push(c);
            got += c.length;
            if (got >= bytes) stream.destroy();
          });
          stream.on('close', () => finish(Buffer.concat(chunks).subarray(0, bytes)));
          stream.on('end', () => finish(Buffer.concat(chunks).subarray(0, bytes)));
          stream.on('error', () => finish(null));
        });
      });
      zip.on('end', () => finish(null));
      zip.readEntry();
    });
  });
}

const NDD_LBA_LEN = 232 * 85; // 19720
const NDD_ID_LBAS = [15, 14];

async function readNddId(hostPath: string): Promise<{ code: string; version: number } | null> {
  const fh = await open(hostPath, 'r');
  try {
    for (const lba of NDD_ID_LBAS) {
      const b = Buffer.alloc(16);
      const { bytesRead } = await fh.read(b, 0, 16, NDD_LBA_LEN * lba);
      if (bytesRead < 5) continue;
      const code = b.subarray(0, 4).toString('latin1');
      if (/^[A-Za-z0-9]{4}$/.test(code)) return { code: code.toUpperCase(), version: b[4]! };
    }
  } catch {
    /* fall through */
  } finally {
    await fh.close();
  }
  return null;
}

function fillFromMeta(id: RomIdentity, code: string, special: number, fileName: string): void {
  const sp = getSpecial(special);
  if (sp) {
    id.displayName = sp.title ?? nameFromFilename(fileName);
    id.description = sp.description ?? undefined;
    id.developer = sp.developer ?? undefined;
    id.releaseJp = sp.release_jp ?? undefined;
    id.releaseUs = sp.release_us ?? undefined;
    id.releaseEu = sp.release_eu ?? undefined;
    return;
  }
  const db = dbLookup(code);
  if (db?.title) {
    id.displayName = db.title;
    id.description = db.description ?? undefined;
    id.developer = db.developer ?? undefined;
    id.releaseJp = db.release_jp ?? undefined;
    id.releaseUs = db.release_us ?? undefined;
    id.releaseEu = db.release_eu ?? undefined;
    return;
  }
  if (id.headerTitle) id.displayName = id.headerTitle;
  else id.displayName = nameFromFilename(fileName);
}

/** Identify a ROM / disk file. Never throws — errors land in `.error`. */
export async function identifyRom(hostPath: string): Promise<RomIdentity> {
  const fileName = basename(hostPath);
  const ext = extname(hostPath).toLowerCase();
  const special = matchSpecial(fileName);

  const id: RomIdentity = { type: 1, special, displayName: nameFromFilename(fileName) };

  try {
    if (DISK_EXTS.includes(ext)) {
      id.type = 2;
      let code = match64ddFilename(fileName);
      if (!code) {
        const ndd = await readNddId(hostPath);
        code = ndd?.code ?? null;
      }
      if (code) {
        id.gameCode = code;
        id.regionByte = code[3];
        id.regionLabel = 'NTSC-J'; // 64DD is Japan-only for orientation
        fillFromMeta(id, code, special, fileName);
      } else {
        fillFromMeta(id, '', special, fileName);
      }
      return id;
    }

    const head = await readHead(hostPath, ext);
    const z64 = head ? normalizeRomHead(head) : null;
    if (!z64) {
      id.error = 'not a recognisable N64 ROM (bad magic)';
      fillFromMeta(id, '', special, fileName);
      return id;
    }

    const h = parseRomHeader(z64);
    id.headerTitle = h.title || undefined;
    let code = h.gameCode;
    // A 64DD ROM conversion carries the generic header code "NDDJ"; recover the real code.
    if (code === 'NDDJ') {
      const real = match64ddFilename(fileName);
      if (real) code = real;
    }
    if (/^[A-Za-z0-9]{4}$/.test(code)) {
      id.gameCode = code.toUpperCase();
      id.regionByte = id.gameCode[3];
      id.regionLabel = regionLabel(id.regionByte ?? '');
    }
    id.detectedCic = detectCic(z64) || undefined;
    fillFromMeta(id, id.gameCode ?? '', special, fileName);
    return id;
  } catch (err) {
    id.error = err instanceof Error ? err.message : String(err);
    fillFromMeta(id, '', special, fileName);
    return id;
  }
}

/** The art code to use for covers: special edition art_code wins over the game code. */
export function artCodeFor(gameCode: string | undefined, special: number): string | undefined {
  const sp = getSpecial(special);
  if (sp?.art_code) return sp.art_code;
  return gameCode;
}
