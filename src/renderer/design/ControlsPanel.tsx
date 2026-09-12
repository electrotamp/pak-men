/**
 * ControlsPanel — remap the controller. Two scopes:
 *   Global   — applies everywhere (a delta over the stock map)
 *   This page — overrides the global map on the current page only
 *
 * Warnings are advisory: the console can never actually lock you out (the
 * firmware forces A = select / B = back / a direction if you unbind them), but
 * we flag it so the surprise happens in the editor, not on the couch.
 */

import { useState } from 'react';
import { useStore } from '../store.ts';
import { updateLayout, patchPage } from './state.ts';
import {
  ACTION_LABEL,
  DEFAULT_BUTTON_MAP,
  INPUT_ACTIONS,
  PHYS_GROUPS,
  PHYS_LABEL,
  mapConflicts,
  mapUnbound,
  resolveButtonMap,
  type ButtonMap,
  type InputAction,
  type PhysInput,
} from '../../shared/input-map.ts';

type Scope = 'global' | 'page';

export function ControlsPanel() {
  const layout = useStore((s) => s.project?.layout);
  const pageId = useStore((s) => s.design.page);
  const [scope, setScope] = useState<Scope>('global');

  if (!layout) return <div className="pane-body">No project.</div>;

  const page = layout.pages.find((p) => p.id === pageId);
  const pageEditable = !!page;
  const activeScope: Scope = scope === 'page' && pageEditable ? 'page' : 'global';

  const global: ButtonMap = layout.buttons ?? {};
  const pageMap: ButtonMap = page?.buttons ?? {};

  const resolved = resolveButtonMap(global, activeScope === 'page' ? pageMap : undefined);
  const conflicts = mapConflicts(resolved);
  const unbound = mapUnbound(global, activeScope === 'page' ? pageMap : undefined);

  const setGlobal = (input: PhysInput, action: InputAction) =>
    updateLayout((l) => {
      const b: ButtonMap = { ...(l.buttons ?? {}) };
      if (action === DEFAULT_BUTTON_MAP[input]) delete b[input];
      else b[input] = action;
      l.buttons = Object.keys(b).length ? b : undefined;
    });

  const setPage = (input: PhysInput, action: InputAction | 'inherit') =>
    patchPage(pageId, (p) => {
      const b: ButtonMap = { ...(p.buttons ?? {}) };
      if (action === 'inherit') delete b[input];
      else b[input] = action;
      p.buttons = Object.keys(b).length ? b : undefined;
    });

  const resetScope = () => {
    if (activeScope === 'global') updateLayout((l) => (l.buttons = undefined));
    else patchPage(pageId, (p) => (p.buttons = undefined));
  };

  return (
    <div className="pane-body">
      <p className="mb-p-lede">
        Assign any control to any action. Changes here also cover the built-in screens.
      </p>

      <div className="np">
        <span>Editing</span>
        <select value={activeScope} onChange={(e) => setScope(e.target.value as Scope)}>
          <option value="global">Global (everywhere)</option>
          <option value="page" disabled={!pageEditable}>
            {page ? `This page — ${page.title}` : 'This page'}
          </option>
        </select>
      </div>
      {activeScope === 'page' && (
        <div className="help">
          Only the controls you change here override the global map on <b>{page?.title}</b>. Everything
          else is inherited.
        </div>
      )}

      {(conflicts.length > 0 || unbound.length > 0) && (
        <div className="field invalid">
          {unbound.length > 0 && (
            <div className="err">
              Nothing is bound to{' '}
              {unbound.map((a) => ACTION_LABEL[a]).join(', ')} — the console will fall back to the
              stock control for it.
            </div>
          )}
          {conflicts.map((c) => (
            <div className="err" key={c.action}>
              {c.inputs.map((i) => PHYS_LABEL[i]).join(' + ')} all do “{ACTION_LABEL[c.action]}”.
            </div>
          ))}
        </div>
      )}

      {PHYS_GROUPS.map((g) => (
        <div key={g.label}>
          <h3>{g.label}</h3>
          {g.inputs.map((input) => {
            const eff = resolved[input];
            const raw = activeScope === 'global' ? global[input] : pageMap[input];
            return (
              <div className="np" key={input}>
                <span>{PHYS_LABEL[input]}</span>
                <select
                  value={activeScope === 'page' ? (raw ?? 'inherit') : (raw ?? DEFAULT_BUTTON_MAP[input])}
                  onChange={(e) =>
                    activeScope === 'global'
                      ? setGlobal(input, e.target.value as InputAction)
                      : setPage(input, e.target.value as InputAction | 'inherit')
                  }
                >
                  {activeScope === 'page' && (
                    <option value="inherit">Inherit ({ACTION_LABEL[eff]})</option>
                  )}
                  {INPUT_ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {ACTION_LABEL[a]}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      ))}

      <div className="np" style={{ marginTop: 12 }}>
        <button onClick={resetScope}>
          Reset {activeScope === 'global' ? 'global map' : 'this page'} to defaults
        </button>
      </div>
    </div>
  );
}
