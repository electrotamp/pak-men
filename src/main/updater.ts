/**
 * Self-updater for the portable (win-unpacked) build.
 *
 * There is no NSIS installer here, so `electron-updater` doesn't apply — its
 * Windows install step only knows how to run an NSIS installer/portable exe.
 * Instead: check GitHub Releases, download the release's win-x64 zip (built
 * by `electron-builder`'s `zip` target alongside the existing `dir` target),
 * stage it, then on apply hand off to a tiny hidden .cmd that waits for this
 * process to exit and launches a hidden PowerShell + WinForms helper
 * (resources/updater/apply-update.ps1) that copies the staged folder over
 * the install dir with a real progress bar and relaunches the same exe path
 * — see applyStagedUpdateAndRelaunch below for why it's two hops, not one.
 *
 * Testing without a real GitHub release: drop an `update-test-override.json`
 * file next to the exe — `{ "zipPath": "...", "version": "..." }` — and just
 * run the app normally. checkForUpdate() then skips the network entirely and
 * stages that zip. Delete the file to go back to the real GitHub check.
 */

import { app } from 'electron';
// Electron patches node:fs to intercept any path containing ".asar" (treating
// it as a virtual archive mount). The release zip legitimately contains a
// real file named resources/app.asar, so extraction must use Electron's
// unpatched fs — original-fs — or writing that one file throws "Invalid package".
import { createWriteStream, promises as fs } from 'original-fs';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import yauzl from 'yauzl';
import { resourcesDir } from './art.ts';

const OWNER = 'electrotamp';
const REPO = 'pak-men';

export interface UpdateInfo {
  version: string;
  /** Absolute URL (GitHub asset API endpoint, or a local file:// path in test mode). */
  zipUrl: string;
  /** Only set for a real GitHub release; used for the Accept header dance. */
  isGithubAsset: boolean;
}

function currentVersion(): string {
  return app.getVersion();
}

/** Compares two dotted version strings (leading "v" tolerated). Returns >0 if a is newer. */
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

async function readTestOverride(): Promise<{ zipPath: string; version: string } | null> {
  const p = join(dirname(app.getPath('exe')), 'update-test-override.json');
  try {
    const raw = JSON.parse(await fs.readFile(p, 'utf8')) as { zipPath?: string; version?: string };
    if (!raw.zipPath || !raw.version) return null;
    return { zipPath: raw.zipPath, version: raw.version };
  } catch {
    return null;
  }
}

async function updateToken(): Promise<string | null> {
  if (process.env.PAKMEN_UPDATE_TOKEN) return process.env.PAKMEN_UPDATE_TOKEN;
  try {
    return (await fs.readFile(join(resourcesDir(), 'update-token.txt'), 'utf8')).trim();
  } catch {
    return null;
  }
}

/** Checks for a newer release. Returns null when already up to date. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const testOverride = await readTestOverride();
  if (testOverride) {
    if (compareVersions(testOverride.version, currentVersion()) <= 0) return null;
    return { version: testOverride.version, zipUrl: testOverride.zipPath, isGithubAsset: false };
  }

  const token = await updateToken();
  const headers: Record<string, string> = { 'User-Agent': 'pak-men-updater', Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, { headers });
  if (!res.ok) throw new Error(`GitHub releases check failed: ${res.status} ${res.statusText}`);
  const release = (await res.json()) as {
    tag_name: string;
    assets: Array<{ name: string; url: string }>;
  };

  const latest = release.tag_name;
  if (compareVersions(latest, currentVersion()) <= 0) return null;

  const asset = release.assets.find((a) => a.name.endsWith('-win-x64.zip') || a.name.endsWith('.zip'));
  if (!asset) throw new Error(`Release ${latest} has no win-x64 zip asset`);

  return { version: latest, zipUrl: asset.url, isGithubAsset: true };
}

/** Downloads and extracts the release zip into a fresh staging directory. Returns its path. */
export async function downloadAndStageUpdate(
  info: UpdateInfo,
  onProgress?: (phase: 'download' | 'extract', pct: number) => void,
): Promise<string> {
  const stageRoot = join(app.getPath('temp'), 'pakmen-update', info.version);
  await fs.rm(stageRoot, { recursive: true, force: true });
  await fs.mkdir(stageRoot, { recursive: true });

  const zipPath = join(app.getPath('temp'), 'pakmen-update', `${info.version}.zip`);
  await downloadZip(info, zipPath, onProgress);
  await extractZip(zipPath, stageRoot, onProgress);
  await fs.rm(zipPath, { force: true });

  return stageRoot;
}

async function downloadZip(
  info: UpdateInfo,
  destPath: string,
  onProgress?: (phase: 'download' | 'extract', pct: number) => void,
): Promise<void> {
  if (!info.isGithubAsset) {
    // Test mode: zipUrl is a local file path.
    await fs.copyFile(info.zipUrl, destPath);
    onProgress?.('download', 100);
    return;
  }

  const token = await updateToken();
  const headers: Record<string, string> = { 'User-Agent': 'pak-men-updater', Accept: 'application/octet-stream' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(info.zipUrl, { headers });
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

  const total = Number(res.headers.get('content-length') ?? 0);
  let received = 0;
  const out = createWriteStream(destPath);
  const reader = res.body.getReader();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (total) onProgress?.('download', Math.round((received / total) * 100));
    await new Promise<void>((resolve, reject) => out.write(value, (err) => (err ? reject(err) : resolve())));
  }
  await new Promise<void>((resolve) => out.close(() => resolve()));
}

async function extractZip(
  zipPath: string,
  destDir: string,
  onProgress?: (phase: 'download' | 'extract', pct: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('bad zip'));
      const total = zip.entryCount;
      let done = 0;
      zip.readEntry();
      zip.on('entry', (entry) => {
        const outPath = join(destDir, entry.fileName);
        if (/\/$/.test(entry.fileName)) {
          fs.mkdir(outPath, { recursive: true }).then(() => {
            done++;
            onProgress?.('extract', Math.round((done / total) * 100));
            zip.readEntry();
          }, reject);
          return;
        }
        zip.openReadStream(entry, (err2, stream) => {
          if (err2 || !stream) return reject(err2 ?? new Error('bad entry stream'));
          fs.mkdir(dirname(outPath), { recursive: true }).then(() => {
            const out = createWriteStream(outPath);
            stream.pipe(out);
            out.on('finish', () => {
              done++;
              onProgress?.('extract', Math.round((done / total) * 100));
              zip.readEntry();
            });
            out.on('error', reject);
          }, reject);
        });
      });
      zip.on('end', () => resolve());
      zip.on('error', reject);
    });
  });
}

/**
 * Hands off to a hidden helper and quits. Two hops, both load-bearing:
 *  1. A tiny generated .cmd, spawned detached — cmd.exe survives Node's
 *     `detached: true` fine and waits for this process's PID to exit.
 *  2. It then launches resources/updater/apply-update.ps1 with
 *     -WindowStyle Hidden as its own (non-detached) child — that script
 *     copies the staged folder over the install dir with a real WinForms
 *     progress bar, then relaunches the exe.
 * Spawning powershell.exe directly with Node's `detached: true` was tried
 * first: it silently no-ops (gets a PID, never runs the script) — apparently
 * specific to how Windows PowerShell's host initializes under that Win32
 * process-creation flag combination. The .cmd hop sidesteps it entirely.
 * (A second copy of this same exe can't do the swap either way — Windows
 * won't let a running process overwrite its own .exe.)
 */
export function applyStagedUpdateAndRelaunch(stagingDir: string): void {
  const exePath = app.getPath('exe');
  const workDir = join(app.getPath('temp'), 'pakmen-update');
  const argsPath = join(workDir, 'apply-args.json');
  const cmdPath = join(workDir, 'apply-update.cmd');
  const scriptPath = join(resourcesDir(), 'updater', 'apply-update.ps1');

  const script = [
    '@echo off',
    'setlocal',
    `set PID=${process.pid}`,
    ':waitloop',
    'tasklist /FI "PID eq %PID%" 2>NUL | find "%PID%" >NUL',
    'if not errorlevel 1 (',
    '  timeout /t 1 /nobreak >NUL',
    '  goto waitloop',
    ')',
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${scriptPath}" -ArgsFile "${argsPath}"`,
    'del "%~f0"',
    '',
  ].join('\r\n');

  fs.mkdir(workDir, { recursive: true })
    .then(() =>
      Promise.all([
        fs.writeFile(argsPath, JSON.stringify({ src: stagingDir, dest: dirname(exePath), exePath }), 'utf8'),
        fs.writeFile(cmdPath, script, 'utf8'),
      ]),
    )
    .then(() => {
      spawn('cmd.exe', ['/c', cmdPath], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
      app.quit();
    });
}
