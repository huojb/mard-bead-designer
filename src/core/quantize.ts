import { nearestPaletteIndex } from './color';

/**
 * K-means 色彩简化：把图片先聚合成 k 种主色，再量化到 MARD 调色板。
 * 适合处理颜色简单、边缘清晰的图案（如图标、简笔画）。
 * k=0 表示不做简化，直接量化。
 */
export function posterizeRGBA(data: Uint8ClampedArray, k: number): Uint8ClampedArray {
  if (k <= 0) return data;

  // 收集不透明像素
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < data.length / 4; i++) {
    if (data[i * 4 + 3] >= 128) {
      pixels.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
    }
  }
  if (pixels.length === 0) return data;

  const numColors = Math.min(k, pixels.length);

  // 初始化质心：均匀采样
  const centroids: [number, number, number][] = [];
  for (let i = 0; i < numColors; i++) {
    centroids.push([...pixels[Math.floor(i * pixels.length / numColors)]]);
  }

  // K-means 迭代
  for (let iter = 0; iter < 12; iter++) {
    const sums: [number, number, number, number][] = Array.from({ length: numColors }, () => [0, 0, 0, 0]);
    for (const [r, g, b] of pixels) {
      let minDist = Infinity, minIdx = 0;
      for (let c = 0; c < numColors; c++) {
        const dr = r - centroids[c][0], dg = g - centroids[c][1], db = b - centroids[c][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < minDist) { minDist = d; minIdx = c; }
      }
      sums[minIdx][0] += r; sums[minIdx][1] += g; sums[minIdx][2] += b; sums[minIdx][3]++;
    }
    for (let c = 0; c < numColors; c++) {
      if (sums[c][3] > 0) {
        centroids[c] = [
          Math.round(sums[c][0] / sums[c][3]),
          Math.round(sums[c][1] / sums[c][3]),
          Math.round(sums[c][2] / sums[c][3]),
        ];
      }
    }
  }

  // 把每个像素替换为最近质心的颜色
  const result = new Uint8ClampedArray(data);
  for (let i = 0; i < data.length / 4; i++) {
    if (data[i * 4 + 3] < 128) continue;
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    let minDist = Infinity, minIdx = 0;
    for (let c = 0; c < numColors; c++) {
      const dr = r - centroids[c][0], dg = g - centroids[c][1], db = b - centroids[c][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < minDist) { minDist = d; minIdx = c; }
    }
    result[i * 4] = centroids[minIdx][0];
    result[i * 4 + 1] = centroids[minIdx][1];
    result[i * 4 + 2] = centroids[minIdx][2];
  }
  return result;
}

export const GRID = 52;

/**
 * 孤立像素清理：对量化后的网格做 N 遍"众数滤波"
 * 每一遍：凡是某格颜色在 8 邻域里同色数 ≤ minSame，就替换为邻域中出现最多的颜色
 * passes=1~3 足够清理大多数噪点；passes 越多颜色越"团块化"
 */
export function cleanIsolatedPixels(grid: Uint8Array, passes: number = 1): Uint8Array {
  const G = 52;
  let cur = new Uint8Array(grid);
  for (let p = 0; p < passes; p++) {
    const next = new Uint8Array(cur);
    for (let i = 0; i < G * G; i++) {
      const myColor = cur[i];
      if (myColor === 0) continue;
      const col = i % G;
      const row = Math.floor(i / G);

      const counts = new Map<number, number>();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nc = col + dx, nr = row + dy;
          if (nc < 0 || nc >= G || nr < 0 || nr >= G) continue;
          const c = cur[nr * G + nc];
          if (c > 0) counts.set(c, (counts.get(c) || 0) + 1);
        }
      }

      const sameCount = counts.get(myColor) || 0;
      // 如果这格颜色在邻域里只有 0 或 1 个同伴，则替换为邻域最多色
      if (sameCount <= 1) {
        let bestColor = myColor, bestCount = 0;
        for (const [c, cnt] of counts) {
          if (cnt > bestCount) { bestCount = cnt; bestColor = c; }
        }
        if (bestCount > sameCount) next[i] = bestColor;
      }
    }
    cur = next;
  }
  return cur;
}

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
