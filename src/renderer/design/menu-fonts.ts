/**
 * The 22 bundled display fonts, for the canvas preview. Each has a real
 * `.ttf`/`.otf` served from resources/fonts/ so the canvas shows the actual
 * face; the firmware uses the sibling `.font64` baked into the ROM.
 */

/** stem -> served filename (extension varies) */
export const MENU_FONT_FILES: Record<string, string> = {
  'Emulogic-zrEw': 'Emulogic-zrEw.ttf',
  'Foneitwu-1jEOg': 'Foneitwu-1jEOg.otf',
  'Foneitwu-R9yOW': 'Foneitwu-R9yOW.ttf',
  'GamePlayed-vYL7': 'GamePlayed-vYL7.ttf',
  'GamecubenDualset-L85D': 'GamecubenDualset-L85D.ttf',
  'KidpixiesRegular-p0Z1': 'KidpixiesRegular-p0Z1.ttf',
  'MarioAndLuigi-0v99': 'MarioAndLuigi-0v99.ttf',
  'MushroomKingdomNbpRegular-RGGA': 'MushroomKingdomNbpRegular-RGGA.ttf',
  'Nes2Regular-yxyd': 'Nes2Regular-yxyd.ttf',
  'PixelEmulator-xq08': 'PixelEmulator-xq08.ttf',
  'PolygonParty-3KXM': 'PolygonParty-3KXM.ttf',
  'PressStart2P-vaV7': 'PressStart2P-vaV7.ttf',
  'RoBlueShellBold-gxn35': 'RoBlueShellBold-gxn35.otf',
  'RoSpritendoSemiboldBeta-vmVwZ': 'RoSpritendoSemiboldBeta-vmVwZ.otf',
  'SuperMario286-18qg': 'SuperMario286-18qg.ttf',
  'SuperMarioBros-ov7d': 'SuperMarioBros-ov7d.ttf',
  'SuperMarioBrothers-4nmp': 'SuperMarioBrothers-4nmp.ttf',
  'TheWildBreathOfZelda-15Lv': 'TheWildBreathOfZelda-15Lv.ttf',
  'Triforce-y07d': 'Triforce-y07d.ttf',
  'TypefaceMario64-ywA93': 'TypefaceMario64-ywA93.otf',
  'TypefaceMarioWorldPixelFilledRegular-Yz84q': 'TypefaceMarioWorldPixelFilledRegular-Yz84q.otf',
  'TypefaceMarioWorldPixelFilledRegular-rgVMx': 'TypefaceMarioWorldPixelFilledRegular-rgVMx.ttf',
};

/** Friendlier label for the dropdown (drop the hash suffix designers append). */
export function fontLabel(stem: string): string {
  return stem.replace(/-[A-Za-z0-9]{4,6}$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** css font-family for a stem ("" => the default UI font) */
export function fontFamily(stem: string | undefined, fallback: string): string {
  return stem && MENU_FONT_FILES[stem] ? `'mbfont-${stem}', ${fallback}` : fallback;
}

/**
 * The console's built-in UI font — PixelMplus12-Bold, baked into the ROM at
 * `--size 12 --monochrome` (no outline). The canvas uses the same .ttf so
 * on-screen text has the real face, metrics and line pitch.
 */
export const BUILTIN_UI_FONT = "'mbui-pixelmplus', 'Consolas', 'DejaVu Sans Mono', monospace";

import { nativeFontPx } from '../../shared/menu-schema.ts';

export {
  BUILTIN_FONT_PX as BUILTIN_NATIVE_PX,
  DISPLAY_FONT_PX as MENU_FONT_NATIVE_PX,
  nativeFontPx,
  sharpFontSizes,
  snapFontSize,
} from '../../shared/menu-schema.ts';

/** The px a text run actually renders at: explicit fontSize (already snapped to a
 *  sharp size), else the font's native baked size. */
export function menuTextPx(fontSize: number | undefined, font: string | undefined): number {
  if (fontSize && fontSize > 0) return fontSize;
  return nativeFontPx(font);
}

let injected = false;
/** Add the @font-face rules once. Safe to call repeatedly. */
export function ensureMenuFontFaces(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  // In the Electron app (dev + packaged) the fonts come from the main-process
  // `art://font/` protocol; the standalone Vite preview has no main process and
  // serves them from publicDir at `/fonts/`. `window.api` (set by the preload)
  // is present only under Electron and only before the dev-mock installs its stub.
  const base =
    typeof window !== 'undefined' && (window as { api?: unknown }).api ? 'art://font/' : '/fonts/';
  const faces = [
    ...Object.entries(MENU_FONT_FILES).map(([stem, file]) => [`mbfont-${stem}`, file] as const),
    ['mbui-pixelmplus', 'PixelMplus12-Bold.ttf'] as const,
  ];
  const css = faces
    .map(([fam, file]) => `@font-face{font-family:'${fam}';src:url('${base}${file}');font-display:swap;}`)
    .join('\n');
  // index.html ships an empty <style id="mb-menu-fonts"> in <head> — reuse it so
  // the rules are never a detached/late-inserted node that could flash on screen.
  let el = document.getElementById('mb-menu-fonts') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'mb-menu-fonts';
    (document.head ?? document.documentElement).appendChild(el);
  }
  el.textContent = css;
}
