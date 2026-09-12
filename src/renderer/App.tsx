import { useEffect, useState } from 'react';
import { getState, setState, useStore, updateProject, toast, setSkin } from './store.ts';
import { DesignTab } from './design/DesignTab.tsx';
import { ExportDialog } from './panels/ExportDialog.tsx';
import { Palette } from './shell/Palette.tsx';
import { TemplatePicker } from './shell/TemplatePicker.tsx';
import { CanvasControls } from './shell/CanvasControls.tsx';
import { UpdateButton } from './shell/UpdateButton.tsx';
import { UpdatePrompt } from './shell/UpdatePrompt.tsx';
import { rescanAll } from './actions.ts';
import { resetLayout, syncDesignToProject } from './design/state.ts';
import { SKINS, SKIN_LABEL } from './theme/skin.ts';

export function App() {
  const project = useStore((s) => s.project);
  const dirty = useStore((s) => s.dirty);
  const skin = useStore((s) => s.skin);
  const toastMsg = useStore((s) => s.toast);
  const [showExport, setShowExport] = useState(false);
  const [test4mb, setTest4mb] = useState(() => {
    try {
      return localStorage.getItem('mb.test4mb') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!window.api) {
      setState({ toast: 'Preload bridge missing — run via electron-vite, not a plain browser.' });
      return;
    }
    void (async () => {
      const p = await window.api.newProject();
      setState({ project: p, dirty: false });
      syncDesignToProject();
    })();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        void doSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function doNew() {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    const p = await window.api.newProject();
    setState((s) => ({
      project: p,
      projectPath: null,
      dirty: false,
      library: new Map(),
      selected: -1,
      design: { ...s.design, template: 'grand-tour', selected: [] },
    }));
    syncDesignToProject();
  }
  async function doOpen() {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    const res = await window.api.openProject();
    if (!res) return;
    setState({ project: res.project, projectPath: res.path, dirty: false, selected: -1 });
    syncDesignToProject();
    void rescanAll();
  }
  async function doSave() {
    const p = getState().project;
    if (!p) return;
    const res = await window.api.saveProject(p, getState().projectPath ?? undefined);
    if (res) {
      setState({ projectPath: res.path, dirty: false });
      toast('Project saved');
    }
  }
  async function doImport() {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    const dir = await window.api.pickFolder('Choose an SD card or a folder to import from');
    if (!dir) return;
    const p = await window.api.importFromSd(dir);
    setState({ project: p, projectPath: null, dirty: true, selected: -1 });
    syncDesignToProject();
    void rescanAll();
    toast(`Imported ${p.favorites.length} favorites`);
  }

  if (!project) return <div className="mb-app" style={{ placeItems: 'center', display: 'grid' }}>Loading…</div>;

  return (
    <div className="mb-app">
      <div className="mb-toolbar">
        <span className="mb-brand">
          <span className="orb">◆</span>
          <input
            value={project.name}
            aria-label="Project name"
            onChange={(e) => updateProject((p) => (p.name = e.target.value))}
          />
          {dirty && <span className="mb-dirty" title="Unsaved changes">●</span>}
        </span>

        <div className="mb-tgroup">
          <button className="mb-btn" onClick={doNew}>New</button>
          <button className="mb-btn" onClick={doOpen}>Open</button>
          <button className="mb-btn" onClick={doSave}>Save</button>
          <button
            className="mb-btn"
            onClick={resetLayout}
            title="Replace the design with the built-in template (Ctrl+Z to undo)"
          >
            Reset
          </button>
        </div>
        <div className="mb-sep" />
        <div className="mb-tgroup">
          <button className="mb-btn" onClick={doImport}>Import</button>
          <button className="mb-btn" onClick={() => setShowExport(true)}>Export</button>
        </div>
        <div className="mb-sep" />
        <TemplatePicker />

        <div className="mb-tools-right">
          <UpdateButton />
          <div className="mb-sep" />
          <CanvasControls />
          <div className="mb-sep" />
          <div className="mb-skin" role="group" aria-label="App skin">
            {SKINS.map((s) => (
              <button key={s} className={skin === s ? 'on' : ''} onClick={() => setSkin(s)}>
                {SKIN_LABEL[s]}
              </button>
            ))}
          </div>
          <button
            className="mb-prime"
            onClick={async () => {
              const p = getState().project;
              if (!p) return;
              toast(test4mb ? 'Starting the emulator (4 MB)…' : 'Starting the emulator…');
              try {
                const res = await window.api.testMenu(p, { noExpansionPak: test4mb });
                toast(res.ok ? 'Test Menu running in the emulator' : res.message ?? 'Test Menu failed');
              } catch (e) {
                toast('Test Menu failed: ' + (e as Error).message);
              }
            }}
          >
            <span className="tri">▶</span> Test Menu
          </button>
          <label
            className="mb-4mb"
            title="Run the emulator as a stock 4 MB N64 (no Expansion Pak), to preview how the menu behaves with less RAM"
          >
            <input
              type="checkbox"
              checked={test4mb}
              onChange={(e) => {
                setTest4mb(e.target.checked);
                try {
                  localStorage.setItem('mb.test4mb', e.target.checked ? '1' : '0');
                } catch {
                  /* private window */
                }
              }}
            />
            4&nbsp;MB
          </label>
        </div>
      </div>

      <div className="mb-body">
        <Palette />
        <DesignTab />
      </div>

      <div className="mb-hintbar">
        <span><b>Click</b> to add · <b>drag</b> to move · <b>corners</b> to resize</span>
        <span><b>Ctrl+Z / Shift+Z</b> undo, redo · <b>Ctrl+A / C / V</b> select all, copy, paste · <b>hold Alt</b> for free placement</span>
        <span className="grow" />
        <span>Skin: <b>{SKIN_LABEL[skin]}</b></span>
      </div>

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {toastMsg && <div className="toast">{toastMsg}</div>}
      <UpdatePrompt />
    </div>
  );
}
