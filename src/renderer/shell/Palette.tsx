/**
 * Palette — the left rail. Top: "Add to screen" (click adds that element to the
 * current page). Bottom: "Advanced settings" — the controller map and the
 * console settings, each an expandable row in the same style as the elements.
 */

import { useState, type ReactNode } from 'react';
import { useStore } from '../store.ts';
import { addElement } from '../design/layout-ops.ts';
import { currentPageObj } from '../design/state.ts';
import { ControlsPanel } from '../design/ControlsPanel.tsx';
import { PopupThemePanel } from '../design/PopupThemePanel.tsx';
import { SettingsPanel } from '../panels/SettingsPanel.tsx';
import { ELEMENT_TYPES, ELEMENT_LABEL, type ElementType } from '../../shared/menu-schema.ts';

const DESC: Record<ElementType, string> = {
  gameList: 'Your games, as a list or a grid',
  boxArt: 'Cover of the highlighted game',
  infoPanel: 'Release, developer, region…',
  text: 'A label or heading',
  image: 'A PNG from your card',
  button: 'Runs an action when pressed',
  panel: 'A filled or outlined box',
  setting: 'An on/off row for a console setting',
  fileList: 'Browse and open files on your card',
};

const ICON: Record<ElementType, ReactNode> = {
  gameList: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="3" width="12" height="2.2" /><rect x="2" y="7" width="12" height="2.2" /><rect x="2" y="11" width="8" height="2.2" />
    </svg>
  ),
  boxArt: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="3" y="2.5" width="10" height="11" /><path d="M3 10l3-3 3 3 4-4" />
    </svg>
  ),
  infoPanel: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2.5" y="3" width="11" height="10" /><path d="M5 6.5h6M5 9h4" />
    </svg>
  ),
  text: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 4h10M8 4v9M6 13h4" />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2.5" y="3" width="11" height="10" /><circle cx="6" cy="6.5" r="1.3" /><path d="M3 11l3.5-3 3 2.2L13 7" />
    </svg>
  ),
  button: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="5" width="12" height="6" rx="3" />
    </svg>
  ),
  panel: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
    </svg>
  ),
  setting: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="5" width="12" height="6" rx="3" /><circle cx="11" cy="8" r="1.6" fill="currentColor" />
    </svg>
  ),
  fileList: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 4.5l1.4-1.5h3.2L8 4.5h5.5v8H2z" /><path d="M4.5 7.5h7M4.5 10h5" />
    </svg>
  ),
};

type AdvId = 'controls' | 'popups' | 'settings';

const ADV: { id: AdvId; name: string; desc: string; icon: ReactNode }[] = [
  {
    id: 'controls',
    name: 'Controls',
    desc: 'Remap any button',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M5 5h6a3.5 3.5 0 0 1 3.4 4.3l-.5 2A2 2 0 0 1 11 12l-1.2-1.5h-3.6L5 12a2 2 0 0 1-3.4-.7l-.5-2A3.5 3.5 0 0 1 5 5Z" />
        <path d="M4 7.5v2M3 8.5h2" /><circle cx="11.5" cy="8" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'popups',
    name: 'System pop-ups',
    desc: "Colour the menu's own dialogs",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="1.5" y="3" width="10" height="7" rx="1.5" />
        <rect x="5.5" y="7" width="9" height="6" rx="1.5" fill="currentColor" fillOpacity="0.15" />
      </svg>
    ),
  },
  {
    id: 'settings',
    name: 'Settings',
    desc: 'Music, rumble, boot…',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
        <circle cx="8" cy="8" r="2.3" />
        <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" />
      </svg>
    ),
  },
];

export function Palette() {
  const layout = useStore((s) => s.project?.layout);
  const pageId = useStore((s) => s.design.page);
  const page = currentPageObj(layout, pageId);
  const disabled = !page;
  const [open, setOpen] = useState<AdvId | null>(null);

  return (
    <aside className="mb-palette">
      <h2>Add to screen</h2>
      <div className="mb-pal-list">
        {ELEMENT_TYPES.map((t) => (
          <button
            key={t}
            className="mb-item"
            disabled={disabled}
            title={disabled ? 'This screen has no layout to add to' : `Add a ${ELEMENT_LABEL[t]}`}
            onClick={() => addElement(t)}
          >
            <span className="ico">{ICON[t]}</span>
            <span>
              <span className="nm">{ELEMENT_LABEL[t]}</span>
              <span className="ds">{DESC[t]}</span>
            </span>
          </button>
        ))}
      </div>

      <h2 className="mt">Advanced settings</h2>
      <div className="mb-pal-list">
        {ADV.map((a) => (
          <div key={a.id}>
            <button
              className="mb-item mb-item-adv"
              aria-expanded={open === a.id}
              onClick={() => setOpen((cur) => (cur === a.id ? null : a.id))}
            >
              <span className="ico">{a.icon}</span>
              <span>
                <span className="nm">{a.name}</span>
                <span className="ds">{a.desc}</span>
              </span>
              <span className="caret" aria-hidden>
                ▸
              </span>
            </button>
            {open === a.id && (
              <div className="mb-props-body mb-adv-drop">
                {a.id === 'controls' ? (
                  <ControlsPanel />
                ) : a.id === 'popups' ? (
                  <PopupThemePanel />
                ) : (
                  <SettingsPanel embedded />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
