/**
 * input-map.ts — the remappable controller map, mirrored from the firmware
 * (src/menu/ui_layout/input_map.{c,h}).
 *
 * Every physical control maps to one action. The stock map reproduces the old
 * hard-wired behaviour. `menu.json` carries overrides at two levels:
 *   - `MenuLayout.buttons` — global, a sparse delta over the stock map
 *   - `Page.buttons`       — per page, a sparse delta over the resolved global
 * Both are stored sparse (only the keys that differ). The firmware merges the
 * same way, so what you see here is what the console does.
 */

/** JSON keys — must match input_map.c PHYS_NAMES exactly. */
export const PHYS_INPUTS = [
  'a', 'b', 'l', 'r', 'z', 'start',
  'c_up', 'c_down', 'c_left', 'c_right',
  'd_up', 'd_down', 'd_left', 'd_right',
  's_up', 's_down', 's_left', 's_right',
] as const;
export type PhysInput = (typeof PHYS_INPUTS)[number];

export const PHYS_LABEL: Record<PhysInput, string> = {
  a: 'A', b: 'B', l: 'L', r: 'R', z: 'Z', start: 'Start',
  c_up: 'C ▲', c_down: 'C ▼', c_left: 'C ◀', c_right: 'C ▶',
  d_up: 'D-pad ▲', d_down: 'D-pad ▼', d_left: 'D-pad ◀', d_right: 'D-pad ▶',
  s_up: 'Stick ▲', s_down: 'Stick ▼', s_left: 'Stick ◀', s_right: 'Stick ▶',
};

/** Grouping for the Controls grid. */
export const PHYS_GROUPS: { label: string; inputs: PhysInput[] }[] = [
  { label: 'Buttons', inputs: ['a', 'b', 'l', 'r', 'z', 'start'] },
  { label: 'C-buttons', inputs: ['c_up', 'c_down', 'c_left', 'c_right'] },
  { label: 'D-pad', inputs: ['d_up', 'd_down', 'd_left', 'd_right'] },
  { label: 'Analog stick', inputs: ['s_up', 's_down', 's_left', 's_right'] },
];

/** JSON values — must match input_map.c ACTION_NAMES exactly. */
export const INPUT_ACTIONS = [
  'none',
  'up', 'down', 'left', 'right',
  'fastUp', 'fastDown', 'fastLeft', 'fastRight',
  'enter', 'back', 'settings',
  'pagePrev', 'pageNext',
  'focusNext', 'focusPrev', 'focusList', 'focusFiles',
  'favorite', 'screensaver', 'sortAz',
] as const;
export type InputAction = (typeof INPUT_ACTIONS)[number];

export const ACTION_LABEL: Record<InputAction, string> = {
  none: 'Nothing',
  up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right',
  fastUp: 'Fast up', fastDown: 'Fast down', fastLeft: 'Fast left', fastRight: 'Fast right',
  enter: 'Select / launch', back: 'Back', settings: 'Open Settings screen',
  pagePrev: 'Previous page', pageNext: 'Next page',
  focusNext: 'Focus next element', focusPrev: 'Focus previous element',
  focusList: 'Focus the game list', focusFiles: 'Focus the file browser',
  favorite: 'Favourite / un-favourite', screensaver: 'Start screensaver', sortAz: 'Sort games A–Z',
};

/** Actions where binding more than one control is worth flagging (directions and
 *  fast-scroll are expected to have several controls). */
const DISCRETE_ACTIONS: InputAction[] = [
  'enter', 'back', 'settings', 'pagePrev', 'pageNext',
  'focusNext', 'focusPrev', 'focusList', 'focusFiles',
  'favorite', 'screensaver', 'sortAz',
];

export type ButtonMap = Partial<Record<PhysInput, InputAction>>;

/** The stock map — must match input_map_defaults(). */
export const DEFAULT_BUTTON_MAP: Record<PhysInput, InputAction> = {
  a: 'enter', b: 'back', l: 'pagePrev', r: 'pageNext', z: 'favorite', start: 'settings',
  c_up: 'fastUp', c_down: 'fastDown', c_left: 'fastLeft', c_right: 'fastRight',
  d_up: 'up', d_down: 'down', d_left: 'left', d_right: 'right',
  s_up: 'up', s_down: 'down', s_left: 'left', s_right: 'right',
};

function isDirection(a: InputAction): boolean {
  return a === 'up' || a === 'down' || a === 'left' || a === 'right'
    || a === 'fastUp' || a === 'fastDown' || a === 'fastLeft' || a === 'fastRight';
}

/** Drop any entry that just restates the stock binding — keeps the stored map minimal. */
export function trimButtonMap(over: ButtonMap, base: Record<PhysInput, InputAction>): ButtonMap {
  const out: ButtonMap = {};
  for (const p of PHYS_INPUTS) {
    const v = over[p];
    if (v && v !== base[p]) out[p] = v;
  }
  return out;
}

/** Effective map: stock -> global delta -> page delta -> essentials guarantee. */
export function resolveButtonMap(global?: ButtonMap, pageOverride?: ButtonMap): Record<PhysInput, InputAction> {
  const m: Record<PhysInput, InputAction> = { ...DEFAULT_BUTTON_MAP };
  for (const p of PHYS_INPUTS) {
    if (global?.[p]) m[p] = global[p]!;
  }
  for (const p of PHYS_INPUTS) {
    if (pageOverride?.[p] && pageOverride[p] !== 'none') m[p] = pageOverride[p]!;
  }
  return applyEssentials(m);
}

/** Mirror of input_map_essentials(): never leave the user unable to select / go
 *  back / move. Returns a copy. */
export function applyEssentials(m: Record<PhysInput, InputAction>): Record<PhysInput, InputAction> {
  const out = { ...m };
  const has = (a: InputAction) => PHYS_INPUTS.some((p) => out[p] === a);
  if (!has('enter')) out.a = 'enter';
  if (!has('back')) out.b = 'back';
  if (!PHYS_INPUTS.some((p) => isDirection(out[p]))) {
    out.d_up = 'up';
    out.d_down = 'down';
    out.d_left = 'left';
    out.d_right = 'right';
  }
  return out;
}

/** Discrete actions bound to more than one control (a soft warning). */
export function mapConflicts(resolved: Record<PhysInput, InputAction>): { action: InputAction; inputs: PhysInput[] }[] {
  const out: { action: InputAction; inputs: PhysInput[] }[] = [];
  for (const a of DISCRETE_ACTIONS) {
    const inputs = PHYS_INPUTS.filter((p) => resolved[p] === a);
    if (inputs.length > 1) out.push({ action: a, inputs });
  }
  return out;
}

/** Essential actions with no control (before the firmware's fallback kicks in). */
export function mapUnbound(overGlobal?: ButtonMap, overPage?: ButtonMap): InputAction[] {
  // check against the pre-essentials merge so we can warn before the fallback hides it
  const m: Record<PhysInput, InputAction> = { ...DEFAULT_BUTTON_MAP };
  for (const p of PHYS_INPUTS) if (overGlobal?.[p]) m[p] = overGlobal[p]!;
  for (const p of PHYS_INPUTS) if (overPage?.[p] && overPage[p] !== 'none') m[p] = overPage[p]!;
  const has = (a: InputAction) => PHYS_INPUTS.some((p) => m[p] === a);
  const out: InputAction[] = [];
  if (!has('enter')) out.push('enter');
  if (!has('back')) out.push('back');
  if (!PHYS_INPUTS.some((p) => isDirection(m[p]))) out.push('up');
  return out;
}

/** Sanitise a raw `buttons` object from JSON into a valid sparse ButtonMap. */
export function normalizeButtonMap(raw: unknown): ButtonMap {
  if (!raw || typeof raw !== 'object') return {};
  const out: ButtonMap = {};
  for (const p of PHYS_INPUTS) {
    const v = (raw as Record<string, unknown>)[p];
    if (typeof v === 'string' && (INPUT_ACTIONS as readonly string[]).includes(v)) {
      out[p] = v as InputAction;
    }
  }
  return out;
}
