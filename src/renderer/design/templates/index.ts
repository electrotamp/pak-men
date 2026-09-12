/**
 * Template manifest — the ready-made menu designs offered by the Template picker
 * (shell/TemplatePicker.tsx). Each entry is a format-2 `menu.json` payload; the
 * picker applies one via `applyTemplate()` in ../state.ts, which replaces the
 * whole layout (undoable).
 *
 * `grand-tour` reuses the very same bundled default that `defaultMenuLayout()`
 * loads, so the default design has exactly one source of truth
 * (docs/examples/menu.json -> src/shared/data/default-menu.json, via `npm run gen`;
 * regenerated from scripts/gen-grand-tour.mjs).
 *
 * The six styled themes share the same five screens — home / library / grid /
 * favourites / settings — and differ only in their cosmetics: palette, shapes,
 * fonts, and the real box-art / game logos they decorate with (`image` elements
 * pointing at `boxart/<CODE>/<type>.png` in the bundled art library).
 *
 * Templates carry menu.json data only. The CRT filter stack is an app-only
 * cosmetic toggle (store.ts `design.crt`) and is never part of a template.
 */

import {
  fromMenuJson,
  normalizeMenu,
  toMenuJson,
  type MenuLayout,
} from '../../../shared/menu-schema.ts';

import grandTour from '../../../shared/data/default-menu.json' with { type: 'json' };
import blank from './blank.json' with { type: 'json' };
import minimal from './minimal.json' with { type: 'json' };
import gallery from './gallery.json' with { type: 'json' };
import command from './command.json' with { type: 'json' };
import hyrule from './hyrule.json' with { type: 'json' };
import mushroom from './mushroom.json' with { type: 'json' };
import arcade from './arcade.json' with { type: 'json' };

export interface TemplateMeta {
  id: string;
  name: string;
  /** one line under the name on the picker card */
  blurb: string;
}

export interface TemplateEntry {
  meta: TemplateMeta;
  data: unknown;
}

/** Picker order. `grand-tour` is the default (see store.ts `design.template`). */
export const TEMPLATES: TemplateEntry[] = [
  {
    meta: {
      id: 'grand-tour',
      name: 'Grand Tour',
      blurb: 'Every feature, a control guide, and a themed shelf per genre.',
    },
    data: grandTour,
  },
  {
    meta: { id: 'blank', name: 'Blank', blurb: 'One empty page. Start from nothing.' },
    data: blank,
  },
  {
    meta: {
      id: 'minimal',
      name: 'Minimal',
      blurb: 'Hairlines, one accent, and a wall of covers.',
    },
    data: minimal,
  },
  {
    meta: {
      id: 'gallery',
      name: 'Gallery',
      blurb: 'A framed hang of box-art on warm gold.',
    },
    data: gallery,
  },
  {
    meta: {
      id: 'command',
      name: 'Command Deck',
      blurb: 'Sci-fi HUD — hexes, brackets, a scanned cart.',
    },
    data: command,
  },
  {
    meta: { id: 'hyrule', name: 'Hyrule', blurb: 'Parchment, gold and the Ocarina of Time.' },
    data: hyrule,
  },
  {
    meta: {
      id: 'mushroom',
      name: 'Mushroom Kingdom',
      blurb: 'Brick, sky, a coin count and Super Mario 64.',
    },
    data: mushroom,
  },
  {
    meta: {
      id: 'arcade',
      name: 'Arcade Cabinet',
      blurb: 'Marquee, bezel and an attract-mode screen.',
    },
    data: arcade,
  },
];

export function templateMeta(id: string): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.meta.id === id)?.meta;
}

/** Parse + normalise a template's payload into a ready-to-use layout. */
export function templateLayout(id: string): MenuLayout {
  const entry = TEMPLATES.find((t) => t.meta.id === id) ?? TEMPLATES[0]!;
  return normalizeMenu(fromMenuJson(JSON.stringify(entry.data)));
}

/** The template a layout is an untouched copy of, or '' once it diverges — used
 *  to keep the picker label honest across undo / redo. */
export function matchTemplateId(layout: MenuLayout): string {
  const json = toMenuJson(layout);
  return TEMPLATES.find((t) => toMenuJson(templateLayout(t.meta.id)) === json)?.meta.id ?? '';
}
