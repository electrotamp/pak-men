/** Field validation shared by the Inspector and the exporter warnings. */

/** Menu text must be printable ASCII (fixed font charset) and must not contain '^'. */
export function validateMenuText(value: string, opts: { maxLen?: number } = {}): string | null {
  if (value === '') return null;
  for (const ch of value) {
    const c = ch.charCodeAt(0);
    if (ch === '^') return "'^' is reserved by the menu's text renderer — remove it.";
    if (ch === '\n' || ch === '\t') continue;
    if (c < 0x20 || c > 0x7e) return `Non-ASCII character "${ch}" — transliterate it (the font has a fixed charset).`;
  }
  if (opts.maxLen && value.length > opts.maxLen) {
    return `Too long (${value.length}/${opts.maxLen}) — the menu truncates it.`;
  }
  return null;
}

/** YYYY, YYYY-MM or YYYY-MM-DD (matches the DB date style). Empty is allowed. */
export function validateDate(value: string): string | null {
  if (value === '') return null;
  return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value) ? null : 'Use YYYY, YYYY-MM or YYYY-MM-DD.';
}

export function validateGameCode(value: string): string | null {
  if (value === '') return null;
  return /^[A-Za-z0-9]{4}$/.test(value) ? null : 'Game codes are 4 letters/digits (e.g. NSME).';
}
