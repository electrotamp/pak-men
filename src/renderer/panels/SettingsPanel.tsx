import { useMemo } from 'react';
import { useStore, updateProject } from '../store.ts';
import { SETTINGS_SCHEMA, settingId, type SettingSpec } from '../../shared/settings-schema.ts';

/**
 * Display order for the settings groups below — independent of SETTINGS_SCHEMA's
 * array order, which is pinned to settings_save()'s key order (see the schema's
 * header comment) and must not be reshuffled just to reorganize the UI. A group
 * not listed here falls to the end, in whatever order it was first seen.
 */
const GROUP_ORDER = [
  'ROM library',
  'Games grid',
  'Saves',
  'File browser',
  'Video',
  'Audio',
  'Screensaver',
  'Start-up & boot',
];

export function SettingsPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const project = useStore((s) => s.project)!;

  const groups = useMemo(() => {
    const g = new Map<string, SettingSpec[]>();
    for (const s of SETTINGS_SCHEMA) {
      if (s.hidden || !s.group) continue;
      (g.get(s.group) ?? g.set(s.group, []).get(s.group)!).push(s);
    }
    return [...g].sort(([a], [b]) => {
      const ia = GROUP_ORDER.indexOf(a);
      const ib = GROUP_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, []);

  const val = (s: SettingSpec) => project.settings[settingId(s)] ?? s.default;
  const set = (s: SettingSpec, v: boolean | number | string) =>
    updateProject((p) => (p.settings[settingId(s)] = v));

  const body = (
      <div className="pane-body" style={{ maxWidth: 560 }}>
        <div className="settings-group">
          <h3>Card</h3>
          <div className="field">
            <label>Storage prefix</label>
            <input
              value={project.storagePrefix}
              onChange={(e) => updateProject((p) => (p.storagePrefix = e.target.value))}
            />
            <div className="help">Almost always <code>sd:/</code>. Changing it rewrites every favorite path on export.</div>
          </div>
          <div className="field">
            <label>Target flashcart(s)</label>
            {(
              [
                ['sc64', 'SC64 → sc64menu.n64'],
                ['ed64', 'EverDrive-64 → OS64.v64'],
                ['ed64p', 'ED64 clone → OS64P.v64'],
                ['64drive', '64drive → menu.bin'],
              ] as const
            ).map(([id, label]) => (
              <label className="toggle" key={id}>
                <input
                  type="checkbox"
                  checked={project.targetCarts.includes(id)}
                  onChange={(e) =>
                    updateProject((p) => {
                      p.targetCarts = e.target.checked
                        ? [...new Set([...p.targetCarts, id])]
                        : p.targetCarts.filter((c) => c !== id);
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {[...groups].map(([name, specs]) => (
          <div className="settings-group" key={name}>
            <h3>{name}</h3>
            {specs.map((s) => {
              const id = settingId(s);
              const v = val(s);
              if (s.kind === 'bool') {
                return (
                  <label className="toggle" key={id} title={s.help}>
                    <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(s, e.target.checked)} />
                    {s.label}
                  </label>
                );
              }
              if (s.kind === 'enum') {
                return (
                  <div className="field" key={id}>
                    <label>{s.label}</label>
                    <select value={Number(v)} onChange={(e) => set(s, Number(e.target.value))}>
                      {s.options!.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {s.help && <div className="help">{s.help}</div>}
                  </div>
                );
              }
              if (s.kind === 'int') {
                return (
                  <div className="field" key={id}>
                    <label>{s.label}</label>
                    <input
                      type="number"
                      min={s.min}
                      max={s.max}
                      value={Number(v)}
                      onChange={(e) => set(s, Number(e.target.value))}
                    />
                    {s.help && <div className="help">{s.help}</div>}
                  </div>
                );
              }
              return (
                <div className="field" key={id}>
                  <label>{s.label}</label>
                  <input value={String(v)} onChange={(e) => set(s, e.target.value)} />
                  {s.help && <div className="help">{s.help}</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
  );

  if (embedded) return body;
  return (
    <div className="pane" style={{ borderRight: '1px solid var(--line)' }}>
      <div className="pane-head">Menu settings</div>
      {body}
    </div>
  );
}
