/**
 * PopupThemePanel — colours for the menu's own pop-ups.
 *
 * These aren't screens you lay out. The console draws them itself, on top of
 * whatever page you're on, and they use one shared colour set everywhere.
 * Left alone they're the built-in dark style; set them here to match a theme.
 */

import { useStore } from '../store.ts';
import { updateLayout } from './state.ts';
import { POPUP_THEME_KEYS, type PopupTheme } from '../../shared/menu-schema.ts';
import { Color } from './ColorField.tsx';

/** The firmware's built-in value for each field — shown as the starting colour
 *  so an unset swatch isn't a confusing black-on-black. */
const BUILT_IN: Record<(typeof POPUP_THEME_KEYS)[number], string> = {
  popupBg: '#000000',
  popupBorder: '#FFFFFF',
  popupText: '#FFFFFF',
  highlight: '#7F7F7F',
  progressTrack: '#000000',
  progressBar: '#3B7CF5',
};

const LABEL: Record<(typeof POPUP_THEME_KEYS)[number], string> = {
  popupBg: 'Pop-up background',
  popupBorder: 'Pop-up border',
  popupText: 'Pop-up text',
  highlight: 'Selected row',
  progressTrack: 'Progress bar — groove',
  progressBar: 'Progress bar — fill',
};

export function PopupThemePanel() {
  const theme = useStore((s) => s.project?.layout?.theme) ?? {};
  const anySet = Object.keys(theme).length > 0;

  const set = (k: keyof PopupTheme, v: string) =>
    updateLayout((l) => {
      const t: PopupTheme = { ...(l.theme ?? {}) };
      t[k] = v;
      l.theme = t;
    });

  const resetAll = () => updateLayout((l) => (l.theme = undefined));

  return (
    <div className="pane-body mb-popup-theme">
      <p className="mb-p-lede">
        Some things aren't screens you design — the console draws them itself, over
        whatever page you're on: the file browser's <b>Start</b> menu, “Delete
        this?” prompts, the on-screen keyboard, the copy progress bar.
      </p>
      <div className="help">
        They share one colour set across the whole menu. Leave them and they use
        the built-in dark style; set them to match your theme.
      </div>

      {POPUP_THEME_KEYS.map((k) => (
        <Color
          key={k}
          label={LABEL[k]}
          value={theme[k] ?? BUILT_IN[k]}
          onChange={(v) => set(k, v)}
        />
      ))}

      {anySet && (
        <div className="np" style={{ marginTop: 12 }}>
          <button type="button" onClick={resetAll}>
            Reset to the built-in colours
          </button>
        </div>
      )}
    </div>
  );
}
