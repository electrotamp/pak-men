/**
 * Enum values shared with the firmware. Keep the numeric values in lockstep with:
 *   - src/menu/settings.h   (grid_image_view_t, screensaver_mode_t)
 *   - src/menu/rom_info.h   (rom_cic_type_t, rom_save_type_t, rom_tv_type_t, rom_presents_as_t)
 *   - src/menu/bookkeeping.h (bookkeeping_item_types_t)
 */

export const BookkeepingType = {
  EMPTY: 0,
  ROM: 1,
  DISK: 2,
} as const;
export type BookkeepingType = (typeof BookkeepingType)[keyof typeof BookkeepingType];

export const GridImageView = {
  BOX_FRONT: 0,
  BOX_BACK: 1,
  BOX_3D: 2,
  CART_FRONT: 3,
  CART_3D: 4,
  LOGO: 5,
} as const;

export const GRID_IMAGE_VIEW_LABELS: Record<number, string> = {
  0: 'Box front',
  1: 'Box back',
  2: '3D box',
  3: 'Cart front',
  4: '3D cart',
  5: 'Logo',
};

/** Maps a GridImageView value to the art type key used in art-index.json / boxart dirs. */
export const GRID_IMAGE_VIEW_TO_ART_TYPE: Record<number, ArtType> = {
  0: 'front',
  1: 'back',
  2: 'box3d',
  3: 'cart',
  4: 'cart3d',
  5: 'logo',
};

export type ArtType = 'front' | 'back' | 'box3d' | 'cart' | 'cart3d' | 'logo';
export const ART_TYPES: ArtType[] = ['front', 'back', 'box3d', 'cart', 'cart3d', 'logo'];

/** Per-game custom-override PNG filename suffix (src/menu/ui_components/boxart.c). */
export const ART_TYPE_CUSTOM_SUFFIX: Record<ArtType, string> = {
  front: '-front',
  back: '-back',
  box3d: '-3dbox',
  cart: '-cart',
  cart3d: '-3dcart',
  logo: '-logo',
};

export const ScreensaverMode = { OFF: 0, ON: 1 } as const;

export const PresentsAs = {
  AUTO: 0,
  NTSC: 1,
  PAL: 2,
  NTSC_J: 3,
} as const;
export const PRESENTS_AS_LABELS: Record<number, string> = {
  0: 'Auto (from ROM)',
  1: 'NTSC (American)',
  2: 'PAL (European)',
  3: 'NTSC-J (Japan)',
};

export const CicType = { AUTOMATIC: -1, UNKNOWN: 0 } as const;
export const CIC_TYPE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: -1, label: 'Automatic' },
  { value: 6101, label: 'CIC-6101 (NTSC)' },
  { value: 6102, label: 'CIC-6102 / 7101' },
  { value: 6103, label: 'CIC-6103 / 7103' },
  { value: 6105, label: 'CIC-6105 / 7105' },
  { value: 6106, label: 'CIC-6106 / 7106' },
  { value: 7102, label: 'CIC-7102 (PAL)' },
  { value: 5101, label: 'CIC-5101 (Aleck64)' },
  { value: 5167, label: 'CIC-5167 (64DD conv.)' },
  { value: 8301, label: 'CIC-8301 (64DD IPL)' },
  { value: 8302, label: 'CIC-8302 (64DD IPL)' },
  { value: 8303, label: 'CIC-8303 (64DD IPL)' },
  { value: 8401, label: 'CIC-8401 (64DD IPL)' },
  { value: 8501, label: 'CIC-8501 (64DD IPL)' },
];

export const SAVE_TYPE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: -1, label: 'Automatic' },
  { value: 0, label: 'None' },
  { value: 1, label: 'EEPROM 4Kbit' },
  { value: 2, label: 'EEPROM 16Kbit' },
  { value: 3, label: 'SRAM 256Kbit' },
  { value: 4, label: 'SRAM Banked' },
  { value: 5, label: 'SRAM 1Mbit' },
  { value: 6, label: 'FlashRAM 1Mbit' },
  { value: 7, label: 'FlashRAM PKST2' },
];

export const TV_TYPE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: -1, label: 'Automatic' },
  { value: 0, label: 'PAL' },
  { value: 1, label: 'NTSC' },
  { value: 2, label: 'MPAL' },
  { value: 3, label: 'Unknown' },
];

/** Region byte -> firmware "market" grouping, mirrors region_label() in games_grid.c. */
export function regionLabel(destByte: string): 'NTSC' | 'NTSC-J' | 'PAL' | 'Unknown' {
  switch (destByte) {
    case 'J':
      return 'NTSC-J';
    case 'E':
      return 'NTSC';
    case 'P':
    case 'A':
    case 'U':
    case 'D':
    case 'F':
    case 'I':
    case 'S':
    case 'X':
    case 'Y':
      return 'PAL';
    default:
      return 'Unknown';
  }
}
