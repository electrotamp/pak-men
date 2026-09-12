/**
 * Toolbar affordance for the self-updater (src/main/updater.ts): idle by
 * default; a click walks check → download → restart. The launch popup
 * (UpdatePrompt.tsx) covers the same flow automatically on startup — this is
 * the manual "ask again right now" entry point.
 */

import { useUpdater } from './useUpdater.ts';

export function UpdateButton() {
  const { phase, info, pct, error, check, download, apply } = useUpdater();

  if (phase === 'idle') {
    return (
      <button className="mb-mini" onClick={check} title="Check GitHub for a newer version">
        Check for updates
      </button>
    );
  }
  if (phase === 'checking') return <span className="mb-mini">Checking…</span>;
  if (phase === 'upToDate') return <span className="mb-mini">Up to date</span>;
  if (phase === 'error') {
    return (
      <span className="mb-mini" title={error} style={{ color: 'var(--danger, #e66)' }}>
        Update check failed
      </span>
    );
  }
  if (phase === 'available') {
    return (
      <button className="mb-mini on" onClick={() => download()} title={`Download v${info?.version}`}>
        Update to v{info?.version}
      </button>
    );
  }
  if (phase === 'downloading') {
    return <span className="mb-mini">Downloading… {pct}%</span>;
  }
  if (phase === 'applying') return <span className="mb-mini">Restarting…</span>;
  return (
    <button className="mb-mini on" onClick={apply} title="Restart now to apply the update">
      Restart to update
    </button>
  );
}
