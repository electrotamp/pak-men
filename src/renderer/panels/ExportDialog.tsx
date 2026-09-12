import { useEffect, useState } from 'react';
import { getState, setState, useStore, toast } from '../store.ts';
import type { ExportPlan } from '../../shared/types.ts';

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project)!;
  const [target, setTarget] = useState<string | null>(null);
  const [plan, setPlan] = useState<ExportPlan | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!target) return;
    setBusy(true);
    window.api
      .planExport(project, target)
      .then(setPlan)
      .finally(() => setBusy(false));
  }, [target, project]);

  async function chooseTarget() {
    const dir = await window.api.pickFolder('Choose the export folder (SD card root, or anywhere)');
    if (dir) setTarget(dir);
  }

  async function doExport() {
    if (!target) return;
    setBusy(true);
    try {
      await window.api.commitExport(getState().project!, target);
      toast('Exported to ' + target);
      onClose();
    } catch (e) {
      alert('Export failed: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const counts = plan
    ? plan.entries.reduce(
        (a, e) => ((a[e.action] = (a[e.action] ?? 0) + 1), a),
        {} as Record<string, number>,
      )
    : null;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Export menu</h2>
        <div className="body">
          <div className="field">
            <label>Export folder</label>
            <div className="row">
              <input readOnly value={target ?? ''} placeholder="not chosen" />
              <button onClick={chooseTarget}>Choose…</button>
            </div>
            {project.layout?.pages.some((p) => p.skin) && (
              <label className="toggle" style={{ marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={Boolean(project.bakeSkin)}
                  onChange={(e) =>
                    setState({ project: { ...project, bakeSkin: e.target.checked }, dirty: true })
                  }
                />
                Also copy the skin to <code>assets/images/menu_skin.png</code> (for a firmware
                rebuild — instant boot, no SD decode)
              </label>
            )}
            <div className="help">
              Writes a <code>menu/</code> tree (and the menu ROM for each selected cart) here.
              Point it at your SD card, or export to your Desktop and copy it over.
            </div>
          </div>

          {busy && <p>Working…</p>}

          {plan && counts && (
            <>
              <p>
                {counts.create ?? 0} new · {counts.overwrite ?? 0} changed · {counts.unchanged ?? 0}{' '}
                unchanged
              </p>
              <div className="plan-list">
                {plan.entries
                  .filter((e) => e.action !== 'unchanged')
                  .map((e) => (
                    <div key={e.rel} className={e.action}>
                      {e.action === 'create' ? '+ ' : '~ '}
                      {e.rel} {e.note ? `(${e.note})` : ''}
                    </div>
                  ))}
              </div>

              {plan.orphans.length > 0 && (
                <div className="warn-box">
                  <b>{plan.orphans.length} unrelated file(s) in menu/</b> will be left untouched:
                  <br />
                  {plan.orphans.slice(0, 8).join(', ')}
                  {plan.orphans.length > 8 ? ' …' : ''}
                </div>
              )}

              {plan.warnings.length > 0 && (
                <div className="warn-box">
                  {plan.warnings.map((w, i) => (
                    <div key={i}>⚠ {w}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="foot">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!target || busy} onClick={doExport}>
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
