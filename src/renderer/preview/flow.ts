/**
 * Port of compute_flow() from src/menu/views/games_grid.c so the preview grid
 * lays tiles out exactly like the console: <=4 columns, fixed cells, centered
 * rows, an 18px caption strip. Values are in the firmware's 576x432 visible-area
 * coordinate space; the component scales the whole thing to fit.
 */

export const GRID = {
  visibleW: 576,
  visibleH: 432,
  padX: 20,
  padY: 8,
  gap: 8,
  columns: 4,
  cellW: 128,
  cellH: 102,
  labelH: 18,
  headerH: 40,
};

export interface TileBox {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
}

export function computeFlow(count: number, opts: { square: boolean; large: boolean }): {
  tiles: TileBox[];
  rows: number;
  contentW: number;
} {
  const left = GRID.padX;
  const right = GRID.visibleW - GRID.padX;
  const avail = right - left;

  let cellW = opts.square ? GRID.cellH : GRID.cellW;
  let cellH = GRID.cellH;
  if (opts.large) {
    cellW = Math.trunc((cellW * 13) / 10);
    cellH = Math.trunc((cellH * 13) / 10);
  }

  let columns = Math.trunc((avail + GRID.gap) / (cellW + GRID.gap));
  columns = Math.max(1, Math.min(GRID.columns, columns));

  const tiles: TileBox[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.trunc(i / columns);
    const col = i % columns;
    tiles.push({ index: i, x: left + col * (cellW + GRID.gap), y: 0, w: cellW, h: cellH, row });
  }
  const rows = count ? Math.ceil(count / columns) : 0;

  // center each row (including a short final row)
  for (let r = 0; r < rows; r++) {
    const rowTiles = tiles.filter((t) => t.row === r);
    if (!rowTiles.length) continue;
    const last = rowTiles[rowTiles.length - 1]!;
    const used = last.x + last.w - left;
    const offset = Math.trunc((avail - used) / 2);
    if (offset > 0) for (const t of rowTiles) t.x += offset;
  }

  // vertical placement below the header
  const y0 = GRID.headerH + GRID.padY;
  for (const t of tiles) {
    t.y = y0 + t.row * (cellH + GRID.labelH + GRID.gap);
  }

  return { tiles, rows, contentW: avail };
}
