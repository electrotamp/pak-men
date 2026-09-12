/**
 * INI reader / writer that is byte-compatible with the firmware's parser
 * (src/menu/ini_parser.c). The export files must round-trip through the N64
 * side exactly, so this mirrors `ini_load` / `ini_save` precisely:
 *
 *  - line endings are LF (the C side opens "wb")
 *  - global (pre-section) pairs are written first, with no header
 *  - a blank line precedes every section header after the first block
 *  - `key = value`; values are quoted only when `valueNeedsQuoting` is true,
 *    and inside quotes `"` and `\` are backslash-escaped
 *  - on read: `;` / `#` start comment lines; quoted values unescape `\"` `\'`
 *    `\\`; unquoted values stop at `;` / `#` and are right-trimmed
 *  - parse-time limits: section/key <= 63 chars, value <= 255 chars
 */

export const INI_MAX_NAME_LENGTH = 63;
export const INI_MAX_VALUE_LENGTH = 255;

export interface IniSection {
  /** '' is the global (sectionless) block. */
  name: string;
  pairs: Array<[string, string]>;
}

export type IniDoc = IniSection[];

// --------------------------------------------------------------------------- write

/** Mirror of `value_needs_quoting` in ini_parser.c. */
export function valueNeedsQuoting(value: string): boolean {
  if (value.length === 0) return false;
  if (value[0] === ' ' || value[0] === '\t') return true;
  const last = value[value.length - 1];
  if (last === ' ' || last === '\t') return true;
  for (const ch of value) {
    if (ch === ';' || ch === '#' || ch === '"' || ch === "'") return true;
  }
  return false;
}

function formatValue(value: string): string {
  if (!valueNeedsQuoting(value)) return value;
  let inner = '';
  for (const ch of value) {
    if (ch === '"' || ch === '\\') inner += '\\';
    inner += ch;
  }
  return `"${inner}"`;
}

/** Serialize to the exact text `ini_save` would produce. */
export function stringifyIni(doc: IniDoc): string {
  let out = '';
  let wroteAnyBlock = false;

  const globals = doc.filter((s) => s.name === '');
  const named = doc.filter((s) => s.name !== '');

  for (const sec of globals) {
    for (const [key, value] of sec.pairs) {
      if (value === null || value === undefined) continue;
      out += `${key} = ${formatValue(value)}\n`;
      wroteAnyBlock = true;
    }
  }

  for (const sec of named) {
    if (wroteAnyBlock) out += '\n';
    out += `[${sec.name}]\n`;
    for (const [key, value] of sec.pairs) {
      if (value === null || value === undefined) continue;
      out += `${key} = ${formatValue(value)}\n`;
    }
    wroteAnyBlock = true;
  }

  return out;
}

// --------------------------------------------------------------------------- read

/** Parse INI text the way `ini_load` does. Duplicate keys: last wins. */
export function parseIni(text: string): IniDoc {
  const doc: IniDoc = [];
  const sectionOf = (name: string): IniSection => {
    let s = doc.find((x) => x.name === name);
    if (!s) {
      s = { name, pairs: [] };
      doc.push(s);
    }
    return s;
  };
  const setPair = (sec: IniSection, key: string, value: string) => {
    const existing = sec.pairs.find((p) => p[0] === key);
    if (existing) existing[1] = value;
    else sec.pairs.push([key, value]);
  };

  let i = 0;
  const n = text.length;
  let section: IniSection | null = null;
  let allowGlobalKeys = true;

  const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r';

  while (i < n) {
    while (i < n && isSpace(text[i]!)) i++;
    if (i >= n) break;

    const c = text[i]!;
    if (c === ';' || c === '#') {
      while (i < n && text[i] !== '\n') i++;
      continue;
    }

    let lineEnd = i;
    while (lineEnd < n && text[lineEnd] !== '\n' && text[lineEnd] !== '\r') lineEnd++;
    const line = text.slice(i, lineEnd);

    if (c === '[') {
      allowGlobalKeys = false;
      const close = line.indexOf(']');
      if (close > 1) {
        section = sectionOf(line.slice(1, close).slice(0, INI_MAX_NAME_LENGTH));
      }
      i = lineEnd;
      continue;
    }

    const eq = line.indexOf('=');
    if (eq > 0) {
      const target = section ?? (allowGlobalKeys ? sectionOf('') : null);
      if (!target) {
        i = lineEnd;
        continue;
      }
      const key = line.slice(0, eq).replace(/[ \t]+$/, '').slice(0, INI_MAX_NAME_LENGTH);
      let rest = line.slice(eq + 1).replace(/^[ \t]+/, '');
      let value: string;
      if (rest[0] === '"' || rest[0] === "'") {
        const quote = rest[0];
        let v = '';
        let k = 1;
        while (k < rest.length && rest[k] !== quote) {
          if (rest[k] === '\\' && k + 1 < rest.length) {
            const next = rest[k + 1]!;
            if (next === quote || next === '\\') {
              v += next;
              k += 2;
              continue;
            }
          }
          v += rest[k];
          k++;
        }
        value = v;
      } else {
        const stop = rest.search(/[;#]/);
        if (stop >= 0) rest = rest.slice(0, stop);
        value = rest.replace(/[ \t]+$/, '');
      }
      setPair(target, key, value.slice(0, INI_MAX_VALUE_LENGTH));
    }
    i = lineEnd;
  }

  return doc;
}

// --------------------------------------------------------------------------- accessors

export function getString(doc: IniDoc, section: string, key: string): string | undefined {
  const s = doc.find((x) => x.name === section);
  const p = s?.pairs.find((pp) => pp[0] === key);
  return p?.[1];
}

/** Mirror of `ini_get_int`: strict — the whole value must be a base-10 integer. */
export function getInt(doc: IniDoc, section: string, key: string, def: number): number {
  const v = getString(doc, section, key);
  if (v === undefined) return def;
  if (!/^[+-]?\d+$/.test(v.trim())) return def;
  const parsed = Number.parseInt(v.trim(), 10);
  return Number.isSafeInteger(parsed) ? parsed : def;
}

/** Mirror of `ini_get_bool`. */
export function getBool(doc: IniDoc, section: string, key: string, def: boolean): boolean {
  const v = getString(doc, section, key);
  if (v === undefined) return def;
  const low = v.toLowerCase();
  if (low === 'true' || low === 'yes' || low === 'on' || v === '1') return true;
  if (low === 'false' || low === 'no' || low === 'off' || v === '0') return false;
  return def;
}

// --------------------------------------------------------------------------- builder

/** Ordered INI builder that writes values the way the firmware's setters do. */
export class IniBuilder {
  private doc: IniDoc = [];

  private sec(name: string): IniSection {
    let s = this.doc.find((x) => x.name === name);
    if (!s) {
      s = { name, pairs: [] };
      this.doc.push(s);
    }
    return s;
  }

  setString(section: string, key: string, value: string): this {
    const s = this.sec(section.slice(0, INI_MAX_NAME_LENGTH));
    const k = key.slice(0, INI_MAX_NAME_LENGTH);
    const v = value.slice(0, INI_MAX_VALUE_LENGTH);
    const existing = s.pairs.find((p) => p[0] === k);
    if (existing) existing[1] = v;
    else s.pairs.push([k, v]);
    return this;
  }

  setInt(section: string, key: string, value: number): this {
    return this.setString(section, key, String(Math.trunc(value)));
  }

  setBool(section: string, key: string, value: boolean): this {
    return this.setString(section, key, value ? 'true' : 'false');
  }

  get isEmpty(): boolean {
    return this.doc.every((s) => s.pairs.length === 0);
  }

  build(): IniDoc {
    return this.doc;
  }

  toString(): string {
    return stringifyIni(this.doc);
  }
}
