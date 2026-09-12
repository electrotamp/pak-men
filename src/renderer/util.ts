import specials from '../shared/data/specials.json' with { type: 'json' };

interface Special {
  tokens: string[];
  art_code: string | null;
}
const SPECIALS = specials as Special[];

/** Client-side mirror of rom-id.artCodeFor: special-edition art_code wins. */
export function artCodeForClient(code: string | undefined, special: number): string | undefined {
  const sp = special >= 0 ? SPECIALS[special] : undefined;
  return sp?.art_code ?? code ?? undefined;
}

export function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

export function stemOf(p: string): string {
  const b = baseName(p);
  const dot = b.lastIndexOf('.');
  return dot > 0 ? b.slice(0, dot) : b;
}
