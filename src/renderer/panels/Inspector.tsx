import { useEffect, useState } from 'react';
import { useStore, updateProject } from '../store.ts';
import { libraryEntry } from '../hooks.ts';
import { fetchArtInfo } from '../hooks.ts';
import { artCodeForClient } from '../util.ts';
import { validateMenuText, validateDate } from '../../shared/validate.ts';
import {
  ART_TYPES,
  GRID_IMAGE_VIEW_LABELS,
  PRESENTS_AS_LABELS,
  CIC_TYPE_OPTIONS,
  SAVE_TYPE_OPTIONS,
  TV_TYPE_OPTIONS,
  type ArtType,
} from '../../shared/enums.ts';
import type { Favorite } from '../../shared/types.ts';
import type { ArtInfo } from '../../shared/ipc-api.ts';

type Tab = 'meta' | 'art' | 'game' | 'disc';

export function Inspector() {
  const project = useStore((s) => s.project)!;
  const selected = useStore((s) => s.selected);
  const [tab, setTab] = useState<Tab>('meta');
  const fav = project.favorites[selected];

  if (!fav) {
    return (
      <div className="pane">
        <div className="pane-head">Inspector</div>
        <div className="empty">Select a tile to edit its art, metadata and settings.</div>
      </div>
    );
  }
  const entry = libraryEntry(fav.sdPath);
  const name = entry?.displayName ?? fav.sdPath.split('/').pop();

  const patch = (mut: (f: Favorite) => void) =>
    updateProject((p) => {
      const f = p.favorites[selected];
      if (f) mut(f);
    });

  return (
    <div className="pane">
      <div className="pane-head" title={fav.sdPath}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      </div>
      <div className="tabs">
        {(['meta', 'art', 'game', 'disc'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {{ meta: 'Metadata', art: 'Art', game: 'Game', disc: '64DD' }[t]}
          </button>
        ))}
      </div>
      <div className="pane-body">
        {tab === 'meta' && <MetaTab fav={fav} entry={entry} patch={patch} />}
        {tab === 'art' && <ArtTab fav={fav} entry={entry} patch={patch} />}
        {tab === 'game' && <GameTab fav={fav} patch={patch} />}
        {tab === 'disc' && <DiscTab fav={fav} />}
      </div>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  validate,
  area,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  validate?: (v: string) => string | null;
  area?: boolean;
  placeholder?: string;
}) {
  const err = validate?.(value) ?? null;
  return (
    <div className={`field${err ? ' invalid' : ''}`}>
      <label>{label}</label>
      {area ? (
        <textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {err && <div className="err">{err}</div>}
    </div>
  );
}

function MetaTab({
  fav,
  entry,
  patch,
}: {
  fav: Favorite;
  entry: ReturnType<typeof libraryEntry>;
  patch: (m: (f: Favorite) => void) => void;
}) {
  const m = fav.meta ?? {};
  const set = (k: keyof NonNullable<Favorite['meta']>, v: string) =>
    patch((f) => {
      f.meta = { ...(f.meta ?? {}), [k]: v || undefined };
      if (f.meta && Object.values(f.meta).every((x) => !x)) delete f.meta;
    });

  return (
    <>
      <p className="help" style={{ marginTop: 0 }}>
        Overrides the built-in database for this game (written to{' '}
        <code>{(fav.gameCode ?? '????').toUpperCase()}.meta.ini</code>). Leave blank to use the
        bundled data
        {entry?.description ? ` (DB: "${entry.displayName}").` : '.'}
      </p>
      <Text label="Title" value={m.title ?? ''} placeholder={entry?.displayName} onChange={(v) => set('title', v)} validate={(v) => validateMenuText(v, { maxLen: 63 })} />
      <Text label="Developer" value={m.developer ?? ''} onChange={(v) => set('developer', v)} validate={(v) => validateMenuText(v, { maxLen: 63 })} />
      <div className="row">
        <Text label="Release JP" value={m.release_jp ?? ''} onChange={(v) => set('release_jp', v)} validate={validateDate} />
        <Text label="Release US" value={m.release_us ?? ''} onChange={(v) => set('release_us', v)} validate={validateDate} />
        <Text label="Release EU" value={m.release_eu ?? ''} onChange={(v) => set('release_eu', v)} validate={validateDate} />
      </div>
      <Text
        label="Description"
        area
        value={m.description ?? ''}
        placeholder={entry?.description}
        onChange={(v) => set('description', v)}
        validate={(v) => validateMenuText(v, { maxLen: 255 })}
      />
    </>
  );
}

function ArtTab({
  fav,
  entry,
  patch,
}: {
  fav: Favorite;
  entry: ReturnType<typeof libraryEntry>;
  patch: (m: (f: Favorite) => void) => void;
}) {
  const artCode = artCodeForClient(fav.gameCode ?? entry?.gameCode, entry?.special ?? -1);
  const [info, setInfo] = useState<ArtInfo | null>(null);
  useEffect(() => {
    if (artCode) fetchArtInfo(artCode).then(setInfo);
  }, [artCode]);

  async function pick(type: ArtType) {
    const file = await window.api.pickFile({
      title: `Choose ${type} image`,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
    });
    if (file) patch((f) => (f.art = { ...(f.art ?? {}), [type]: file }));
  }
  function clear(type: ArtType) {
    patch((f) => {
      if (f.art) {
        delete f.art[type];
        if (Object.keys(f.art).length === 0) delete f.art;
      }
    });
  }

  return (
    <>
      <p className="help" style={{ marginTop: 0 }}>
        Click a slot to override that art with your own image (saved into{' '}
        <code>gameconfigs/</code>, auto-resized to ≤1024²). Otherwise the baked library art shown
        here is used.
      </p>
      <div className="art-grid">
        {ART_TYPES.map((type) => {
          const custom = fav.art?.[type];
          const bakedUrl = info?.url[type];
          const url = custom ? window.api.artUrlForFile(custom) : bakedUrl;
          const src = custom ? 'custom' : bakedUrl ? 'baked' : 'none';
          return (
            <div key={type} className="art-slot" onClick={() => pick(type)}>
              {url ? <img src={url} alt="" /> : <div style={{ height: 84 }} className="empty">none</div>}
              <div className="lbl">{type}</div>
              <div className={`src ${src}`}>
                {src === 'custom' ? (
                  <>
                    custom ·{' '}
                    <a
                      onClick={(e) => {
                        e.stopPropagation();
                        clear(type);
                      }}
                    >
                      reset
                    </a>
                  </>
                ) : src === 'baked' ? (
                  'baked'
                ) : (
                  'no art'
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  options: Array<{ value: number; label: string }>;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function GameTab({ fav, patch }: { fav: Favorite; patch: (m: (f: Favorite) => void) => void }) {
  const iv = fav.imageView ?? {};
  const boot = fav.boot ?? {};
  const imageOpts = [
    { value: -1, label: 'Default (global setting)' },
    ...Object.entries(GRID_IMAGE_VIEW_LABELS).map(([v, l]) => ({ value: Number(v), label: l })),
  ];
  return (
    <>
      <Select
        label="Presents as (region)"
        value={fav.presentsAs ?? 0}
        onChange={(n) => patch((f) => (n ? (f.presentsAs = n) : delete f.presentsAs))}
        options={Object.entries(PRESENTS_AS_LABELS).map(([v, l]) => ({ value: Number(v), label: l }))}
      />
      <div className="settings-group">
        <h3>Image view (this game only)</h3>
        <Select label="Grid" value={iv.grid ?? -1} onChange={(n) => patch((f) => (f.imageView = { ...iv, grid: n }))} options={imageOpts} />
        <Select label="Inspect" value={iv.inspect ?? -1} onChange={(n) => patch((f) => (f.imageView = { ...iv, inspect: n }))} options={imageOpts} />
        <Select label="Load" value={iv.load ?? -1} onChange={(n) => patch((f) => (f.imageView = { ...iv, load: n }))} options={imageOpts} />
      </div>
      <div className="settings-group">
        <h3>Boot overrides</h3>
        <Select label="CIC" value={boot.cic ?? -1} onChange={(n) => patch((f) => (f.boot = { ...boot, cic: n }))} options={CIC_TYPE_OPTIONS} />
        <Select label="Save type" value={boot.save ?? -1} onChange={(n) => patch((f) => (f.boot = { ...boot, save: n }))} options={SAVE_TYPE_OPTIONS} />
        <Select label="TV type" value={boot.tv ?? -1} onChange={(n) => patch((f) => (f.boot = { ...boot, tv: n }))} options={TV_TYPE_OPTIONS} />
      </div>
    </>
  );
}

function DiscTab({ fav }: { fav: Favorite }) {
  const project = useStore((s) => s.project)!;
  const code = (fav.gameCode ?? '').toUpperCase();
  const isExpansionDisc = fav.type === 2 && code.startsWith('E');
  const link = project.discLinks.find((l) => l.code === code);

  if (fav.type !== 2) {
    return <div className="empty">Not a 64DD disc.</div>;
  }
  return (
    <>
      <p className="help" style={{ marginTop: 0 }}>
        64DD expansion discs (E-prefix codes) need a base cartridge ROM to boot. This writes{' '}
        <code>disclink_{code[3] === 'J' ? 'jp' : 'us'}.ini</code>.
      </p>
      {!isExpansionDisc && <p className="help">This disc ({code}) looks standalone — a link is optional.</p>}
      <div className="field">
        <label>Base ROM (SD path)</label>
        <div className="row">
          <input readOnly value={link?.sdPath ?? ''} placeholder="none" />
          <button
            onClick={() => {
              const roms = [...project.favorites, ...project.history];
              const choice = prompt(
                'Enter the base ROM SD path:\n' + roms.map((r) => r.sdPath).join('\n'),
                link?.sdPath ?? project.storagePrefix,
              );
              if (choice)
                updateProject((p) => {
                  p.discLinks = p.discLinks.filter((l) => l.code !== code);
                  p.discLinks.push({ code, sdPath: choice });
                });
            }}
          >
            Set…
          </button>
          {link && (
            <button onClick={() => updateProject((p) => (p.discLinks = p.discLinks.filter((l) => l.code !== code)))}>
              ✕
            </button>
          )}
        </div>
      </div>
    </>
  );
}
