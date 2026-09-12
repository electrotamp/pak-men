/**
 * Update popup — auto-checks GitHub once on launch and, if a newer version
 * exists, offers Dismiss (ask again next launch) / Never remind me for this
 * version (persisted in localStorage) / Update now (download, then restart).
 */

import { useEffect, useState } from 'react';
import { useUpdater } from './useUpdater.ts';

const IGNORE_KEY = 'mb.updateIgnoreVersion';

export function UpdatePrompt() {
  const { phase, info, pct, check, download, apply } = useUpdater();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Silent on launch — a failed check (offline, no release yet) shouldn't
    // nag every startup. The toolbar's "Check for updates" surfaces errors.
    void check();
  }, []);

  if (dismissed) return null;
  if (phase !== 'available' && phase !== 'downloading' && phase !== 'ready' && phase !== 'applying') return null;
  if (phase === 'available' && info && ignoredVersion() === info.version) return null;

  return (
    <div className="modal-back" onClick={() => phase === 'available' && setDismissed(true)}>
      <div className="modal update-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Update available</h2>
        <div className="body">
          {phase === 'available' && <p>A new version, v{info?.version}, is available.</p>}
          {phase === 'downloading' && (
            <>
              <p>Downloading v{info?.version}…</p>
              <div className="update-bar-track">
                <div className="update-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="update-pct">{pct}%</p>
            </>
          )}
          {phase === 'ready' && <p>v{info?.version} is ready — restart to apply it.</p>}
          {phase === 'applying' && (
            <>
              <p>Applying update — restarting…</p>
              <div className="update-bar-track">
                <div className="update-bar-fill update-bar-indeterminate" />
              </div>
            </>
          )}
        </div>
        <div className="foot">
          {phase === 'available' && (
            <>
              <button
                onClick={() => {
                  if (info) localStorage.setItem(IGNORE_KEY, info.version);
                  setDismissed(true);
                }}
              >
                Never remind me
              </button>
              <button onClick={() => setDismissed(true)}>Dismiss</button>
              <button className="primary" onClick={() => download()}>
                Update now
              </button>
            </>
          )}
          {phase === 'downloading' && <button disabled>Downloading…</button>}
          {phase === 'ready' && (
            <button className="primary" onClick={apply}>
              Restart to update
            </button>
          )}
          {phase === 'applying' && <button disabled>Restarting…</button>}
        </div>
      </div>
    </div>
  );
}

function ignoredVersion(): string | null {
  try {
    return localStorage.getItem(IGNORE_KEY);
  } catch {
    return null;
  }
}
