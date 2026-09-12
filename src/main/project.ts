/** Load / save / migrate the `.n64menu` project file. */

import { promises as fs } from 'node:fs';
import { defaultSettings, SETTINGS_SCHEMA, settingId } from '../shared/settings-schema.ts';
import { fromMenuJson } from '../shared/menu-schema.ts';
import { PROJECT_FORMAT, type Project } from '../shared/types.ts';

export function newProject(name = 'Untitled menu'): Project {
  return {
    format: PROJECT_FORMAT,
    name,
    storagePrefix: 'sd:/',
    targetCarts: ['sc64'],
    romSources: [],
    favorites: [],
    history: [],
    settings: defaultSettings(),
    discLinks: [],
  };
}

/** Fill in any settings keys missing from an older/hand-edited project. */
export function normalizeProject(raw: Partial<Project>): Project {
  const base = newProject(raw.name ?? 'Untitled menu');
  const settings = { ...base.settings, ...(raw.settings ?? {}) };
  for (const spec of SETTINGS_SCHEMA) {
    const id = settingId(spec);
    if (!(id in settings)) settings[id] = spec.default;
  }
  // Round the stored layout through the schema so an older project (format-1
  // HomeLayout, or a partial hand-edit) arrives normalised and migrated.
  if (raw.layout) {
    raw.layout = fromMenuJson(JSON.stringify(raw.layout));
  }
  return {
    ...base,
    ...raw,
    format: PROJECT_FORMAT,
    settings,
    targetCarts: raw.targetCarts?.length ? raw.targetCarts : base.targetCarts,
    romSources: raw.romSources ?? [],
    favorites: raw.favorites ?? [],
    history: raw.history ?? [],
    discLinks: raw.discLinks ?? [],
  };
}

export async function loadProject(path: string): Promise<Project> {
  const raw = JSON.parse(await fs.readFile(path, 'utf8')) as Partial<Project>;
  return normalizeProject(raw);
}

export async function saveProject(path: string, project: Project): Promise<void> {
  await fs.writeFile(path, JSON.stringify({ ...project, format: PROJECT_FORMAT }, null, 2) + '\n');
}
