/** The project model: everything the builder tracks, serialized as a `.n64menu` JSON file. */

import type { SettingsValues } from './settings-schema.ts';
import type { ArtType } from './enums.ts';
import type { MenuLayout } from './menu-schema.ts';

export const PROJECT_FORMAT = 3;

/** A folder of ROMs on the host, and where it lands on the SD card. */
export interface RomSource {
  /** Absolute host path, e.g. "E:\\All n64". */
  hostDir: string;
  /** SD path under the storage prefix, leading slash, no trailing slash, e.g. "/All n64". */
  sdDir: string;
}

/** Per-game metadata override -> menu/n64ever/gameconfigs/<CODE>.meta.ini */
export interface MetaOverride {
  title?: string;
  developer?: string;
  release_jp?: string;
  release_us?: string;
  release_eu?: string;
  description?: string;
}

/** Per-game boot override -> [custom_boot] in menu/n64ever/gameconfigs/<stem>.ini */
export interface BootOverride {
  /** rom_cic_type_t; -1 = automatic (omitted from the file). */
  cic?: number;
  /** rom_save_type_t; -1 = automatic (omitted). */
  save?: number;
  /** rom_tv_type_t; -1 = automatic (omitted). */
  tv?: number;
}

/** Per-context image-view override -> [presentation] in gameconfigs/<stem>.ini (-1 = default). */
export interface ImageViewOverride {
  grid?: number;
  inspect?: number;
  load?: number;
}

/** One grid tile / favorite. */
export interface Favorite {
  /** On-SD absolute path, e.g. "sd:/All n64/F-Zero X (USA).n64". Canonical identity. */
  sdPath: string;
  /** bookkeeping_item_types_t: 1 = ROM, 2 = DISK. */
  type: 1 | 2;
  /** Cached 4-char game code (written as N_game_code so the grid skips the header read). */
  gameCode?: string;
  /** rom_presents_as_t 0-3; 0 = auto (omitted). */
  presentsAs?: number;
  imageView?: ImageViewOverride;
  boot?: BootOverride;
  meta?: MetaOverride;
  /** Per-type art overrides: absolute host path to the source image. */
  art?: Partial<Record<ArtType, string>>;
  /** Optional: secondary path (64DD combined ROM+disk). */
  secondarySdPath?: string;
}

export interface HistoryEntry {
  sdPath: string;
  type: 1 | 2;
  gameCode?: string;
}

/** 64DD expansion disc -> base ROM link (disclink_{jp,us}.ini). */
export interface DiscLink {
  /** 4-char disc game code; region file chosen by code[3] === 'J'. */
  code: string;
  /** On-SD absolute path to the base cartridge ROM. */
  sdPath: string;
}

export interface Project {
  format: number;
  name: string;
  /** Flashcart storage prefix; almost always "sd:/". */
  storagePrefix: string;
  /** Which flashcart(s) to emit menu ROMs for on export. */
  targetCarts: Array<'sc64' | 'ed64' | 'ed64p' | '64drive'>;
  romSources: RomSource[];
  favorites: Favorite[];
  history: HistoryEntry[];
  settings: SettingsValues;
  discLinks: DiscLink[];
  /** Absolute host path to a splash PNG (<= 640x480 after resize on export). */
  splashImage?: string;
  /** Absolute host paths to custom grid SFX .wav64 files. */
  audio?: {
    grid_move?: string;
    grid_enter?: string;
    grid_back?: string;
    launch?: string;
  };
  /** Copy the actual ROM files into the export tree (off by default). */
  copyRoms?: boolean;
  /** The menu layout (Design tab). Undefined = ship the firmware's baked layout. */
  layout?: MenuLayout;
  /** Also copy the skin PNG into assets/images/menu_skin.png for a firmware rebuild. */
  bakeSkin?: boolean;
}

/** Identity of a ROM discovered on disk, before it becomes a Favorite. */
export interface RomEntry {
  hostPath: string;
  sdPath: string;
  source: RomSource;
  fileName: string;
  /** '.z64' | '.n64' | '.v64' | '.zip' | '.ndd' | ... */
  ext: string;
  type: 1 | 2;
  gameCode?: string;
  /** 20-char ROM-header title, cleaned. */
  headerTitle?: string;
  /** Region byte (game_code[3]) or disk region. */
  regionByte?: string;
  detectedCic?: number;
  /** Index into the special-edition table, or -1. */
  special?: number;
  /** Resolved display name (special -> DB -> header -> filename). */
  displayName: string;
  /** DB / special description, if any (for preview inspect). */
  description?: string;
  /** True if the ROM could not be parsed (missing file, bad header). */
  error?: string;
}

export interface ExportPlanEntry {
  /** Path relative to the export target root. */
  rel: string;
  action: 'create' | 'overwrite' | 'unchanged';
  bytes: number;
  note?: string;
}

export interface ExportPlan {
  target: string;
  entries: ExportPlanEntry[];
  /** Files under menu/ that we do not own and would be left in place. */
  orphans: string[];
  warnings: string[];
}
