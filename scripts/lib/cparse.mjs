// Minimal C-source helpers for the data-generation scripts.
// Not a real C parser — just enough to read the flat initializer tables in
// src/menu/game_metadata_db.h and src/menu/game_special.c.

/** Strip /* *\/ and // comments (string-literal aware). Normalizes CRLF -> LF. */
export function stripComments(src) {
  src = src.replace(/\r\n?/g, '\n');
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '"') {
      // copy a string literal verbatim
      out += c;
      i++;
      while (i < n) {
        out += src[i];
        if (src[i] === '\\') {
          out += src[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (src[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Expand simple object-like `#define NAME body` macros (body may be adjacent string literals). */
export function expandSimpleDefines(src) {
  const defs = new Map();
  const lines = src.split('\n');
  const kept = [];
  for (let li = 0; li < lines.length; li++) {
    let line = lines[li];
    const m = /^\s*#define\s+([A-Za-z_]\w*)\s+(.*)$/.exec(line);
    if (!m) {
      kept.push(line);
      continue;
    }
    // gather line continuations
    let body = m[2];
    while (/\\\s*$/.test(body)) {
      body = body.replace(/\\\s*$/, '') + '\n' + (lines[++li] ?? '');
    }
    // object-like only (no parens immediately after the name)
    if (!/^\(/.test(m[2])) defs.set(m[1], body);
  }
  let text = kept.join('\n');
  // repeatedly substitute (bodies can reference earlier macros)
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const [name, body] of defs) {
      const re = new RegExp(`\\b${name}\\b`, 'g');
      if (re.test(text)) {
        text = text.replace(re, body);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return text;
}

/**
 * Extract the top-level `{ ... }` groups from the initializer list of
 * `identifier[] = { ...groups... };`. Returns an array of raw group strings
 * (without the outer braces).
 */
export function extractInitializerGroups(src, identifier) {
  const anchor = new RegExp(`${identifier}\\s*\\[\\s*\\]\\s*=\\s*\\{`).exec(src);
  if (!anchor) throw new Error(`initializer for ${identifier}[] not found`);
  let i = anchor.index + anchor[0].length;
  const n = src.length;
  const groups = [];
  let depth = 1; // we're inside the outer {
  while (i < n && depth > 0) {
    const c = src[i];
    if (c === '"') {
      i = skipString(src, i);
      continue;
    }
    if (c === '{') {
      if (depth === 1) {
        const { end } = readBraceGroup(src, i);
        groups.push(src.slice(i + 1, end));
        i = end + 1;
        continue;
      }
      depth++;
    } else if (c === '}') {
      depth--;
    }
    i++;
  }
  return groups;
}

function skipString(src, i) {
  // src[i] === '"'
  i++;
  while (i < src.length) {
    if (src[i] === '\\') {
      i += 2;
      continue;
    }
    if (src[i] === '"') return i + 1;
    i++;
  }
  return i;
}

function readBraceGroup(src, start) {
  // src[start] === '{'
  let depth = 0;
  let i = start;
  while (i < src.length) {
    const c = src[i];
    if (c === '"') {
      i = skipString(src, i);
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return { end: i };
    }
    i++;
  }
  throw new Error('unbalanced braces');
}

/** Split a group body on top-level commas (string- and brace-aware). */
export function splitTopLevel(group) {
  const parts = [];
  let cur = '';
  let depth = 0;
  let i = 0;
  while (i < group.length) {
    const c = group[i];
    if (c === '"') {
      const end = skipString(group, i);
      cur += group.slice(i, end);
      i = end;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    if (c === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  if (cur.trim() !== '') parts.push(cur);
  return parts;
}

const ESCAPES = { n: '\n', t: '\t', r: '\r', '"': '"', "'": "'", '\\': '\\', '0': '\0' };

/**
 * Evaluate a C value expression that is either `NULL` or one or more adjacent
 * string literals. Returns null or the decoded, concatenated string.
 */
export function evalCValue(expr) {
  const s = expr.trim();
  if (s === 'NULL' || s === '0' || s === '') return null;
  let out = '';
  let i = 0;
  let sawString = false;
  while (i < s.length) {
    const c = s[i];
    if (c === '"') {
      sawString = true;
      i++;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\') {
          const e = s[i + 1];
          out += e in ESCAPES ? ESCAPES[e] : e;
          i += 2;
          continue;
        }
        out += s[i];
        i++;
      }
      i++; // closing quote
      continue;
    }
    // whitespace / concatenation between adjacent literals
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    // anything else (identifier, cast) — bail out, treat as unknown
    throw new Error(`cannot evaluate C value: ${expr.trim().slice(0, 60)}`);
  }
  return sawString ? out : null;
}
