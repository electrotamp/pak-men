// Stages a GitHub release: copies the built win-x64 zip and a scrubbed
// RELEASE_NOTES.md into output/Github Releases/v<version>/ (never tracked by
// git — see /output in .gitignore). Run `npm run dist:win` first.
//
// Release notes are generated from git commit messages (subject + body),
// which can carry things that don't belong in a public release — tool
// mentions, local file paths, or other incidental details from day-to-day
// development. scrubText() strips those before anything is written to
// output/. The working tree and git history are untouched — this only
// scrubs the copy that lands in the staging folder.
//
// Personal identifiers (actual usernames/handles) live in the gitignored
// scripts/release-scrub.local.json, never in this file, so this script stays
// safe to publish even though it's the thing doing the redacting.
//
//   node scripts/stage-github-release.mjs   (from anywhere; run after dist:win)

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import yauzl from 'yauzl';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..'); // source/tools/menu-builder
const GIT_ROOT = join(APP, '..', '..', '..'); // repo root

const pkg = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8'));
const version = pkg.version;

const builderYml = readFileSync(join(APP, 'electron-builder.yml'), 'utf8');
const productName = /^productName:\s*(.+)$/m.exec(builderYml)?.[1]?.trim() ?? pkg.name;

const zipName = `${productName}-${version}-win.zip`;
const zipPath = join(APP, 'release', zipName);
if (!existsSync(zipPath)) {
  console.error(`! ${zipPath} doesn't exist — run "npm run dist:win" first.`);
  process.exit(1);
}

/* ------------------------------------------------------- runtime-only guard */

// Only files needed to run the app belong in a release — no raw source, no
// test files, no source maps. `out/**/*` is compiled/bundled output already
// (see electron.vite.config.ts), but this asserts it on every staged release
// rather than trusting that stays true forever.
const DISALLOWED_ENTRY = /\.(ts|tsx|map)$/i;
const DISALLOWED_PATH = /(^|\/)(test|__tests__|scripts)\//i;

async function listZipEntries(path) {
  return new Promise((resolve, reject) => {
    const names = [];
    yauzl.open(path, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('bad zip'));
      zip.readEntry();
      zip.on('entry', (entry) => {
        names.push(entry.fileName);
        zip.readEntry();
      });
      zip.on('end', () => resolve(names));
      zip.on('error', reject);
    });
  });
}

const zipEntries = await listZipEntries(zipPath);
const offenders = zipEntries.filter((e) => DISALLOWED_ENTRY.test(e) || DISALLOWED_PATH.test(e));
if (offenders.length) {
  console.error(`! ${zipPath} contains ${offenders.length} file(s) that don't belong in a release:`);
  for (const o of offenders.slice(0, 20)) console.error('    ' + o);
  console.error('Refusing to stage. Check electron-builder.yml\'s `files`/`extraResources`.');
  process.exit(1);
}

const outDir = join(GIT_ROOT, 'output', 'Github Releases', `v${version}`);
mkdirSync(outDir, { recursive: true });

/* ------------------------------------------------------------------ scrub */

// Generic rules — these name AI tools and describe path/email SHAPES, not
// anyone's actual identity, so this list is safe to publish as-is.
const AI_LINE_PATTERNS = [
  /co-authored-by/i,
  /generated (with|by)\b.*\b(claude|chatgpt|copilot|codex|gpt)/i,
  /\b(claude|chatgpt|anthropic|openai|codex|copilot)\b/i,
  /\bgpt-?\d/i,
  /🤖/,
];

let localIdentifiers = [];
let localUsernames = [];
const localCfgPath = join(HERE, 'release-scrub.local.json');
if (existsSync(localCfgPath)) {
  const cfg = JSON.parse(readFileSync(localCfgPath, 'utf8'));
  localIdentifiers = cfg.identifiers ?? [];
  localUsernames = cfg.usernames ?? [];
} else {
  console.warn(`! ${localCfgPath} not found — only generic AI/path/email scrubbing will run.`);
}

const stats = { linesDropped: 0, redactions: 0 };

function scrubLine(line) {
  if (AI_LINE_PATTERNS.some((re) => re.test(line))) {
    stats.linesDropped++;
    return null;
  }
  let out = line;
  out = out.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, () => (stats.redactions++, '[redacted-email]'));
  out = out.replace(/([A-Za-z]:\\Users\\|\/home\/|\/Users\/)([^\\/\s]+)/g, (_m, prefix) => {
    stats.redactions++;
    return prefix + '[user]';
  });
  for (const id of localIdentifiers) {
    const re = new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    out = out.replace(re, () => (stats.redactions++, '[redacted]'));
  }
  for (const name of localUsernames) {
    // Narrower than `identifiers`: only redact a plain username when it shows
    // up in a filesystem path, so a common word (e.g. a real game's title)
    // elsewhere in a commit message is never touched.
    const re = new RegExp(`((?:[A-Za-z]:\\\\Users\\\\|/home/|/Users/))${name}\\b`, 'gi');
    out = out.replace(re, (_m, prefix) => (stats.redactions++, prefix + '[user]'));
  }
  return out;
}

function scrubText(text) {
  return text
    .split('\n')
    .map(scrubLine)
    .filter((l) => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* -------------------------------------------------------------- changelog */

// The marker records the last *version* that had notes generated, plus the
// commit that was staged for it. No marker, or the marker's version equals
// the one being staged right now (re-staging the same version — a rebuild,
// a bugfix pass before it's ever actually published) both mean "nothing to
// diff against yet" -> no RELEASE_NOTES.md. Only a genuinely different
// version than last time gets a changelog, diffed from that prior version's
// commit.
const markerPath = join(GIT_ROOT, 'output', 'Github Releases', '.last-staged-commit');
const marker = existsSync(markerPath) ? JSON.parse(readFileSync(markerPath, 'utf8')) : null;
const since = marker && marker.version !== version ? marker.commit : null;

let commitCount = 0;
if (since) {
  const log = execFileSync(
    'git',
    ['log', `${since}..HEAD`, '--pretty=format:%H%x00%s%x00%b%x1e', '--', 'source/tools/menu-builder', 'source/docs/examples/menu.json'],
    { cwd: GIT_ROOT, encoding: 'utf8' },
  ).trim();

  const commits = log
    ? log
        .split('\x1e')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((rec) => {
          const [hash, subject, body] = rec.split('\x00');
          return { hash, subject, body: body ?? '' };
        })
    : [];
  commitCount = commits.length;

  const entries = commits
    .map((c) => scrubText(`${c.subject}\n${c.body}`))
    .filter(Boolean)
    .map((t) => '- ' + t.replace(/\n/g, '\n  '));

  const notes = [
    `# ${productName} v${version}`,
    '',
    entries.length ? entries.join('\n\n') : '_(no menu-builder changes in this range)_',
    '',
  ].join('\n');

  writeFileSync(join(outDir, 'RELEASE_NOTES.md'), notes, 'utf8');
}

copyFileSync(zipPath, join(outDir, zipName));
copyFileSync(join(APP, 'CREDITS.md'), join(outDir, 'CREDITS.md'));
const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: GIT_ROOT, encoding: 'utf8' }).trim();
writeFileSync(markerPath, JSON.stringify({ version, commit: headSha }), 'utf8');

console.log(`staged v${version} -> ${outDir}`);
console.log(`  ${zipName} (verified: ${zipEntries.length} files, no source/test files)`);
console.log(
  since
    ? `  RELEASE_NOTES.md (${commitCount} commits in range, ${stats.linesDropped} lines dropped, ${stats.redactions} redactions)`
    : '  (no RELEASE_NOTES.md — initial release, nothing to diff against)',
);
console.log(`  CREDITS.md`);
