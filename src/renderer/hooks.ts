import { useEffect, useState } from 'react';
import type { Favorite, RomEntry } from '../shared/types.ts';
import type { ArtInfo } from '../shared/ipc-api.ts';
import { GRID_IMAGE_VIEW_TO_ART_TYPE, type ArtType } from '../shared/enums.ts';
import { getState, useStore } from './store.ts';

const artInfoCache = new Map<string, Promise<ArtInfo>>();

export function fetchArtInfo(code: string | undefined): Promise<ArtInfo> {
  const key = (code ?? '').toUpperCase();
  if (!artInfoCache.has(key)) artInfoCache.set(key, window.api.artInfo(key));
  return artInfoCache.get(key)!;
}

/** Resolve the display image URL for a favorite tile given the current grid image-view. */
export function useFavArtUrl(fav: Favorite | undefined, type: ArtType): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const custom = fav?.art?.[type];

  useEffect(() => {
    let live = true;
    if (custom) {
      setUrl(window.api.artUrlForFile(custom));
      return;
    }
    if (!fav?.gameCode) {
      setUrl(null);
      return;
    }
    fetchArtInfo(fav.gameCode).then((info) => {
      if (live) setUrl(info.url[type] ?? null);
    });
    return () => {
      live = false;
    };
  }, [custom, fav?.gameCode, type]);

  return url;
}

/** Current grid image-view -> art type. */
export function useGridArtType(): ArtType {
  const view = useStore((s) => Number(s.project?.settings['menu.image_view_grid'] ?? 0));
  return GRID_IMAGE_VIEW_TO_ART_TYPE[view] ?? 'front';
}

/** Library entry -> favorite (carrying the identified game code). */
export function entryToFavorite(e: RomEntry): Favorite {
  return { sdPath: e.sdPath, type: e.type, gameCode: e.gameCode };
}

export function libraryEntry(sdPath: string): RomEntry | undefined {
  return getState().library.get(sdPath);
}
