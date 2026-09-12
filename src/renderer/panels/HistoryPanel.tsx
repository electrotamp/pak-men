import { useStore, updateProject } from '../store.ts';
import { libraryEntry } from '../hooks.ts';

export function HistoryPanel() {
  const project = useStore((s) => s.project)!;

  return (
    <div className="pane" style={{ borderRight: '1px solid var(--line)' }}>
      <div className="pane-head">
        Recently-played list
        <span className="pill">{project.history.length}/64</span>
      </div>
      <div className="pane-body">
        <p className="help" style={{ marginTop: 0 }}>
          Optional. The menu maintains this itself as you play; set it here only to pre-seed the
          list. Drag ROMs from the Library or double-click them.
        </p>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const sdPath = e.dataTransfer.getData('text/sdpath');
            if (!sdPath) return;
            const entry = libraryEntry(sdPath);
            updateProject((p) => {
              if (p.history.some((h) => h.sdPath === sdPath)) return;
              p.history.push({ sdPath, type: (entry?.type ?? 1) as 1 | 2, gameCode: entry?.gameCode });
            });
          }}
          style={{ minHeight: 60, border: '1px dashed var(--line)', borderRadius: 6, padding: 8 }}
        >
          {project.history.length === 0 && <div className="empty">Drop games here</div>}
          {project.history.map((h, i) => (
            <div className="lib-item" key={h.sdPath}>
              <span className="pill">{i + 1}</span>
              <div className="lib-meta">
                <div className="lib-name">{libraryEntry(h.sdPath)?.displayName ?? h.sdPath.split('/').pop()}</div>
                <div className="lib-sub">{h.sdPath}</div>
              </div>
              <span className="spacer" style={{ flex: 1 }} />
              <button onClick={() => updateProject((p) => p.history.splice(i, 1))}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
