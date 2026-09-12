/** Image conversion for exported assets. Uses jimp (pure JS) so packaging stays simple. */

import { readFile } from 'node:fs/promises';
import { Jimp } from 'jimp';

export interface FitResult {
  buffer: Buffer;
  width: number;
  height: number;
  resized: boolean;
  /** Set when jimp could not process the file and the original bytes were passed through. */
  passthrough?: boolean;
}

/**
 * Return PNG bytes for `hostPath`, scaled down to fit within maxW x maxH (aspect
 * preserved, never upscaled). On any decode failure the original bytes are
 * returned unchanged with `passthrough: true`.
 */
export async function fitPng(hostPath: string, maxW: number, maxH: number): Promise<FitResult> {
  const original = await readFile(hostPath);
  try {
    const img = await Jimp.read(original);
    const { width, height } = img.bitmap;
    if (width <= maxW && height <= maxH) {
      const buffer = await img.getBuffer('image/png');
      return { buffer, width, height, resized: false };
    }
    const scale = Math.min(maxW / width, maxH / height);
    img.scale(scale);
    const buffer = await img.getBuffer('image/png');
    return { buffer, width: img.bitmap.width, height: img.bitmap.height, resized: true };
  } catch {
    return { buffer: original, width: 0, height: 0, resized: false, passthrough: true };
  }
}

export async function imageSize(hostPath: string): Promise<{ width: number; height: number } | null> {
  try {
    const img = await Jimp.read(await readFile(hostPath));
    return { width: img.bitmap.width, height: img.bitmap.height };
  } catch {
    return null;
  }
}
