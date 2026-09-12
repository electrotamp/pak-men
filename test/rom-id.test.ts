import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRomHead,
  parseRomHeader,
  cleanHeaderTitle,
  matchSpecial,
  match64ddFilename,
  nameFromFilename,
  artCodeFor,
  dbLookup,
} from '../src/main/rom-id.ts';

/** Build a synthetic 0x1000-byte big-endian ROM head with the given title + code. */
function fakeZ64(title: string, code: string): Buffer {
  const b = Buffer.alloc(0x1000);
  b.writeUInt32BE(0x80371240, 0);
  b.write(title.padEnd(0x14, '\0'), 0x20, 'latin1');
  b.write(code.padEnd(4, ' ').slice(0, 4), 0x3b, 'latin1');
  return b;
}

test('normalizeRomHead: z64 passthrough, n64 word-swap, v64 halfword-swap', () => {
  const z = fakeZ64('SUPER MARIO 64', 'NSME');

  const n64 = Buffer.from(z);
  for (let i = 0; i + 3 < n64.length; i += 4) {
    const w = n64.readUInt32BE(i);
    n64.writeUInt32LE(w, i);
  }
  assert.equal(n64.readUInt32BE(0), 0x40123780);

  const v64 = Buffer.from(z);
  for (let i = 0; i + 1 < v64.length; i += 2) v64.writeUInt16LE(v64.readUInt16BE(i), i);
  assert.equal(v64.readUInt32BE(0), 0x37804012);

  for (const variant of [z, n64, v64]) {
    const norm = normalizeRomHead(variant);
    assert.ok(norm);
    const h = parseRomHeader(norm!);
    assert.equal(h.gameCode, 'NSME');
    assert.equal(h.title, 'SUPER MARIO 64');
    assert.equal(h.destByte, 'E');
  }
});

test('normalizeRomHead rejects non-ROM data', () => {
  assert.equal(normalizeRomHead(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])), null);
});

test('cleanHeaderTitle strips control bytes and rdpq escapes', () => {
  assert.equal(cleanHeaderTitle('40 WINKS\x00\xff\x01   '), '40 WINKS');
  assert.equal(cleanHeaderTitle('BAD^STYLE$FONT'), 'BADSTYLEFONT');
});

test('matchSpecial: OoT Master Quest and Smash Remix by filename tokens', () => {
  assert.ok(matchSpecial('Legend of Zelda, The - Ocarina of Time - Master Quest (USA).z64') >= 0);
  assert.ok(matchSpecial('Smash Remix 1.5.0.z64') >= 0);
  assert.equal(matchSpecial('Super Mario 64 (USA).z64'), -1);
});

test('artCodeFor: special art_code overrides the game code', () => {
  const mq = matchSpecial('OoT Master Quest (USA).z64');
  assert.equal(artCodeFor('CZLE', mq), 'ZMQE');
  assert.equal(artCodeFor('NSME', -1), 'NSME');
});

test('match64ddFilename: NUD- product code and keyword table', () => {
  assert.equal(match64ddFilename('Doshin the Giant (Japan) (NUD-DDKJ-JPN).ndd'), 'DDKJ');
  assert.equal(match64ddFilename('F-Zero X Expansion Kit (Japan).ndd'), 'EFZJ');
  assert.equal(match64ddFilename('Some random disk.ndd'), null);
});

test('nameFromFilename drops extension and region/version suffixes', () => {
  assert.equal(nameFromFilename('F-Zero X (USA) (Rev A).n64'), 'F-Zero X');
  assert.equal(nameFromFilename('Body Harvest [!].z64'), 'Body Harvest');
  assert.equal(nameFromFilename('Mario Kart 64.z64'), 'Mario Kart 64');
});

test('dbLookup resolves by 3-char base code', () => {
  assert.equal(dbLookup('CFZE')?.title, 'F-Zero X');
  assert.equal(dbLookup('NZSE')?.title, "The Legend of Zelda: Majora's Mask");
  assert.equal(dbLookup('ZZZZ'), undefined);
});
