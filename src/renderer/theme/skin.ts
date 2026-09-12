/**
 * skin.ts — the app's visual skin (see theme/tokens.css).
 *
 * Orthogonal to light/dark (which follows the OS): the skin only swaps token
 * values. Chosen by the user, remembered in localStorage, applied as
 * `data-skin` on <html>.
 */

export const SKINS = ['flat', 'bubbly'] as const;
export type Skin = (typeof SKINS)[number];

export const SKIN_LABEL: Record<Skin, string> = {
  flat: 'Flat',
  bubbly: 'Bubbly',
};

const KEY = 'mb.skin';

export function readSkin(): Skin {
  try {
    const v = localStorage.getItem(KEY);
    if (v && (SKINS as readonly string[]).includes(v)) return v as Skin;
  } catch {
    /* private mode / disabled storage — fall through to the default */
  }
  return 'flat';
}

/** Apply a skin to the document and remember it. Safe to call before React mounts. */
export function applySkin(skin: Skin): void {
  document.documentElement.dataset.skin = skin;
  try {
    localStorage.setItem(KEY, skin);
  } catch {
    /* not fatal — the skin still applies for this session */
  }
}
