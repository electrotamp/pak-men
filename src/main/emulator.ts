/**
 * emulator.ts — the "Test Menu" preview.
 *
 * Boots the current design in gopher64 (a bundled, self-contained N64 emulator)
 * without a firmware rebuild or WSL: gopher64 emulates the SC64's SD card as a
 * FAT16 image file, so we generate one (fat16.ts) holding the exported `menu/`
 * tree plus a few stub ROMs, drop it where gopher64 looks for it (keyed by the
 * ROM's SHA-256), and launch.
 *
 * Electron path resolution lives in ipc.ts; this stays pure so it can be tested.
 */

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Project } from '../shared/types.ts';
import { buildExport } from './exporter.ts';
import { normalizeProject } from './project.ts';
import { buildFat16, type Dir } from './fat16.ts';

/** A 1 MiB stub ROM: a valid-enough header so the menu shows a real name + art,
 *  small enough to compile in. It won't boot — this is a layout preview. */
function stubRom(internalName: string, gameCode: string): Buffer {
  const b = Buffer.alloc(1024 * 1024);
  b.writeUInt32BE(0x80371240, 0); // PI BSD dom1 config — marks a big-endian .z64
  b.writeUInt32BE(0x0000000f, 4);
  b.writeUInt32BE(0x80000400, 8);
  b.write(internalName.toUpperCase().slice(0, 20).padEnd(20, ' '), 0x20, 'latin1');
  b.write(gameCode.slice(0, 4), 0x3b, 'latin1');
  return b;
}

const SAMPLE_ROMS: Record<string, Buffer> = {
  'Super Mario 64.z64': stubRom('SUPER MARIO 64', 'NSME'),
  'The Legend of Zelda - Ocarina of Time.z64': stubRom('THE LEGEND OF ZELDA', 'NZSE'),
  'Mario Kart 64.z64': stubRom('MARIOKART64', 'NKTE'),
  'GoldenEye 007.z64': stubRom('GOLDENEYE', 'NGEE'),
  'Star Fox 64.z64': stubRom('STARFOX64', 'NFXE'),
  'Banjo-Kazooie.z64': stubRom('BANJO KAZOOIE', 'NBKE'),
};

/** Put a `menu/a/b/c` file into the nested tree, creating dirs on the way. */
function place(tree: Dir, rel: string, data: Uint8Array): void {
  const parts = rel.split('/').filter(Boolean);
  const leaf = parts.pop();
  if (!leaf) return;
  let node = tree;
  for (const seg of parts) {
    const cur = node[seg];
    if (!cur || cur instanceof Uint8Array) node[seg] = {};
    node = node[seg] as Dir;
  }
  node[leaf] = data;
}

export interface EmuPaths {
  /** dir holding gopher64.exe (bundled resources/emulator or a dev checkout). */
  emulatorSrcDir: string;
  /** the bundled sc64menu.n64. */
  menuRomPath: string;
  /** a writable per-user dir; the emulator is copied here on first use. */
  workDir: string;
  /** the exporter's resources dir (box-art library etc.). */
  resourcesDir: string;
}

export interface TestMenuResult {
  ok: boolean;
  message?: string;
}

/** Build the preview SD image for `project`. Returns the image + its menu.json
 *  size (so the caller can reject an over-size design with a clear message). */
export async function buildPreviewImage(
  project: Project,
  opts: { resourcesDir: string },
): Promise<{ img: Buffer; menuJsonBytes: number }> {
  const build = await buildExport(normalizeProject(project), { resourcesDir: opts.resourcesDir });

  const tree: Dir = { ROMS: { ...SAMPLE_ROMS } };
  let menuJsonBytes = 0;
  for (const f of build.files) {
    if (!f.rel.startsWith('menu/')) continue;
    if (f.rel === 'menu/n64ever/ui/menu.json') menuJsonBytes = f.data.length;
    place(tree, f.rel, f.data);
  }
  place(tree, 'menu/n64ever/ui/assets/.keep', Buffer.alloc(0));

  const img = buildFat16(tree, { totalBytes: 64 * 1024 * 1024, label: 'SC64' });
  return { img, menuJsonBytes };
}

/** Copy just the emulator binary into `workDir` the first time; return its path. */
function ensureEmulator(srcDir: string, workDir: string): string | null {
  if (!existsSync(join(srcDir, 'gopher64.exe'))) return null;
  const exe = join(workDir, 'gopher64.exe');
  mkdirSync(workDir, { recursive: true });
  if (!existsSync(exe)) cpSync(join(srcDir, 'gopher64.exe'), exe);
  // portable.txt keeps gopher64's config + SD images next to the exe (our dir).
  const marker = join(workDir, 'portable.txt');
  if (!existsSync(marker)) writeFileSync(marker, '');
  return exe;
}

/** Point gopher64 at whatever controller is currently plugged in (port 1), so a
 *  gamepad "just works" without opening its settings. gopher64's own default
 *  profile already has keyboard + generic-gamepad bindings; this only assigns a
 *  device to the port. Best-effort — the keyboard works regardless. */
function wireController(exe: string, workDir: string): void {
  const run = (...args: string[]) =>
    execFileSync(exe, args, { cwd: workDir, timeout: 12000, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  try {
    run('--bind-input-profile', 'default', '--port', '1');
    const list = run('--list-controllers');
    const found = list
      .split('\n')
      .map((l) => /^\s*Controller\s+(\d+):\s*(.+?)\s*$/.exec(l))
      .find((m) => m && m[2] && m[2].toLowerCase() !== 'none');
    if (found) run('--assign-controller', found[1]!, '--port', '1');
  } catch {
    /* no controller / SDL hiccup — keyboard still drives it */
  }
}

export async function launchTestMenu(
  project: Project,
  paths: EmuPaths,
  opts: { noExpansionPak?: boolean } = {},
): Promise<TestMenuResult> {
  const exe = ensureEmulator(paths.emulatorSrcDir, paths.workDir);
  if (!exe) return { ok: false, message: 'The bundled emulator (gopher64) is missing from this build.' };
  if (!existsSync(paths.menuRomPath)) {
    return { ok: false, message: 'The bundled menu ROM (sc64menu.n64) is missing from this build.' };
  }

  let built;
  try {
    built = await buildPreviewImage(project, { resourcesDir: paths.resourcesDir });
  } catch (e) {
    return { ok: false, message: 'Export failed: ' + (e as Error).message };
  }
  if (built.menuJsonBytes === 0) return { ok: false, message: 'The export produced no menu.json.' };
  if (built.menuJsonBytes > 128 * 1024) {
    return { ok: false, message: `This design's menu.json is ${(built.menuJsonBytes / 1024) | 0} KB — the menu's limit is 128 KB.` };
  }

  const hash = createHash('sha256').update(readFileSync(paths.menuRomPath)).digest('hex').toUpperCase();
  const savesDir = join(paths.workDir, 'portable_data', 'data', 'saves');
  mkdirSync(savesDir, { recursive: true });
  writeFileSync(join(savesDir, `N64FlashcartMenu-${hash}.img`), built.img);

  wireController(exe, paths.workDir);

  try {
    // `--disable-expansion-pak true` runs the emulator as a stock 4 MB N64, to
    // preview how the menu behaves without the Expansion Pak.
    const args = opts.noExpansionPak
      ? ['--disable-expansion-pak', 'true', paths.menuRomPath]
      : [paths.menuRomPath];
    const child = spawn(exe, args, { cwd: paths.workDir, detached: true, stdio: 'ignore' });
    child.unref();
  } catch (e) {
    return { ok: false, message: 'Could not start gopher64: ' + (e as Error).message };
  }
  return { ok: true };
}
