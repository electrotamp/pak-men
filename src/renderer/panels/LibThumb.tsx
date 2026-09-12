import { useEffect, useState } from 'react';
import { fetchArtInfo } from '../hooks.ts';
import { artCodeForClient } from '../util.ts';
import type { ArtType } from '../../shared/enums.ts';

export function LibThumb({
  code,
  special,
  type,
}: {
  code: string | undefined;
  special: number;
  type: ArtType;
}) {
  const artCode = artCodeForClient(code, special);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setUrl(null);
    if (!artCode) return;
    fetchArtInfo(artCode).then((info) => {
      if (!live) return;
      setUrl(info.url[type] ?? info.url.front ?? null);
    });
    return () => {
      live = false;
    };
  }, [artCode, type]);

  if (!url) return <div className="lib-thumb" />;
  return <img className="lib-thumb" src={url} alt="" onError={() => setUrl(null)} />;
}
