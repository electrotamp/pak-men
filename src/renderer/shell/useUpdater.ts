/** Shared check/download/apply state machine for the self-updater — used by
 *  both the toolbar button (manual check) and the launch popup (auto check). */

import { useState } from 'react';
import type { UpdateInfo } from '../../shared/ipc-api.ts';

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'applying'
  | 'error';

export function useUpdater() {
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [stagingDir, setStagingDir] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState('');

  async function check(): Promise<UpdateInfo | null> {
    setPhase('checking');
    try {
      const found = await window.api.checkForUpdate();
      setInfo(found);
      setPhase(found ? 'available' : 'upToDate');
      return found;
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
      return null;
    }
  }

  async function download(target?: UpdateInfo): Promise<void> {
    const use = target ?? info;
    if (!use) return;
    setPhase('downloading');
    setPct(0);
    const off = window.events.onUpdateProgress(({ pct: p }) => setPct(p));
    try {
      const dir = await window.api.downloadUpdate(use);
      setStagingDir(dir);
      setPhase('ready');
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    } finally {
      off();
    }
  }

  async function apply(): Promise<void> {
    if (!stagingDir) return;
    // A beat so "Applying update…" actually paints before the app quits —
    // the swap itself runs invisibly (no console window) in the background.
    setPhase('applying');
    await new Promise((r) => setTimeout(r, 400));
    await window.api.applyUpdate(stagingDir);
  }

  function reset() {
    setPhase('idle');
    setInfo(null);
    setStagingDir(null);
    setPct(0);
    setError('');
  }

  return { phase, info, pct, error, check, download, apply, reset };
}
