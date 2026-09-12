import { useMemo, useState } from 'react';
import { useStore } from '../store.ts';
import { addRomSource, removeRomSource, setSourceSdDir, rescanAll, addFavorite } from '../actions.ts';
import { useGridArtType } from '../hooks.ts';
import { LibThumb } from './LibThumb.tsx';
import type { RomEntry } from '../../shared/types.ts';

export function Library() {
  const project = useStore((s) => s.project);
  const library = useStore((s) => s.library);
  const scanning = useStore((s) => s.scanning);
  const favSet = useMemo(
    () => new Set(project?.favorites.map((f) => f.sdPath)),
    [project?.favorites],
  );
  const [q, setQ] = useState('');
  const artType = useGridArtType();

  const bySource = useMemo(() => {
    const groups = new Map<string, RomEntry[]>();
    const needle = q.trim().toLowerCase();
    for (const e of library.values()) {
      if (needle && !e.displayName.toLowerCase().includes(needle) && !e.fileName.toLowerCase().includes(needle))
        continue;
      const key = e.source.hostDir;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
    }
    for (const list of groups.values()) list.sort((a, b) => (a.displayName < b.displayName ? -1 : 1));
    return groups;
  }, [library, q]);

  if (!project) return null;

  return (
    <div className="pane">
      <div className="pane-head">
        Library
        <span className="spacer" />
        <button onClick={addRomSource}>+ Folder</button>
        <button onClick={rescanAll} disabled={scanning}>
          {scanning ? '…' : '↻'}
        </button>
      </div>
      <div className="lib-search">
        <input placeholder="Search games…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="pane-body">
        {project.romSources.length === 0 && (
          <div className="empty">
            Add a folder of ROMs to get started.
            <br />
            <br />
            <button onClick={addRomSource}>+ Add ROM folder</button>
          </div>
        )}
        {project.romSources.map((src) => (
          <div key={src.hostDir}>
            <div className="lib-src">
              <div className="row">
                <span title={src.hostDir} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {src.hostDir}
                </span>
                <button onClick={() => removeRomSource(src.hostDir)}>✕</button>
              </div>
              <div className="row" style={{ marginTop: 4 }}>
                <span>SD:</span>
                <input
                  value={src.sdDir}
                  onChange={(e) => setSourceSdDir(src.hostDir, e.target.value)}
                  style={{ width: 160 }}
                />
              </div>
            </div>
            {(bySource.get(src.hostDir) ?? []).map((e) => (
              <div
                key={e.sdPath}
                className={`lib-item${favSet.has(e.sdPath) ? ' faved' : ''}`}
                draggable
                onDragStart={(ev) => ev.dataTransfer.setData('text/sdpath', e.sdPath)}
                onDoubleClick={() => addFavorite(e.sdPath)}
                title={e.error ? e.error : e.sdPath}
              >
                <LibThumb code={e.gameCode} special={e.special ?? -1} type={artType} />
                <div className="lib-meta">
                  <div className="lib-name">{e.displayName}</div>
                  <div className="lib-sub">
                    {e.gameCode ?? '????'} · {e.ext.slice(1)}
                    {e.error ? ' · ⚠ unreadable' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
