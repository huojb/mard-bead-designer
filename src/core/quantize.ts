import { nearestPaletteIndex } from './color';

export const GRID = 52;

// 把 HTMLImageElement 缩放到 52x52 并量化到 MARD 调色板
// fit: 'contain' (保持比例留空) 或 'cover' (填满，可能裁剪)
export function quantizeImageToGrid(
  img: HTMLImageElement,
  options: {
    fit?: 'contain' | 'cover';
    bgTransparent?: boolean;       // alpha=0 视为空
    transparentThreshold?: number; // 透明度阈值 0~255
  } = {},
): Uint8Array {
  const { fit = 'contain', bgTransparent = true, transparentThreshold = 128 } = options;

  const off = document.createElement('canvas');
  off.width = GRID;
  off.height = GRID;
  const ctx = off.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, GRID, GRID);

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  let dx = 0, dy = 0, dw = GRID, dh = GRID;
  if (fit === 'contain') {
    const r = Math.min(GRID / iw, GRID / ih);
    dw = Math.round(iw * r);
    dh = Math.round(ih * r);
    dx = Math.floor((GRID - dw) / 2);
    dy = Math.floor((GRID - dh) / 2);
  } else {
    const r = Math.max(GRID / iw, GRID / ih);
    dw = Math.round(iw * r);
    dh = Math.round(ih * r);
    dx = Math.floor((GRID - dw) / 2);
    dy = Math.floor((GRID - dh) / 2);
  }
  ctx.drawImage(img, dx, dy, dw, dh);

  const data = ctx.getImageData(0, 0, GRID, GRID).data;
  const out = new Uint8Array(GRID * GRID);
  for (let i = 0; i < GRID * GRID; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    if (bgTransparent && a < transparentThreshold) {
      out[i] = 0; // 空
    } else {
      out[i] = nearestPaletteIndex(r, g, b);
    }
  }
  return out;
}

// 直接对一段 RGBA imageData 数据量化（用于裁剪后已经是 52x52）
export function quantizeRGBA(data: Uint8ClampedArray): Uint8Array {
  const n = data.length / 4;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3];
    if (a < 128) {
      out[i] = 0;
    } else {
      out[i] = nearestPaletteIndex(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    }
  }
  return out;
}
