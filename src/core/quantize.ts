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

/**
 * 根据目标长边 bead 数推荐 K-means 色数
 * 小图用较少色，大图用较多色
 */
export function suggestKmeansK(targetLongSide: number): number {
  if (targetLongSide <= 16) return 4;
  if (targetLongSide <= 20) return 6;
  if (targetLongSide <= 28) return 10;
  if (targetLongSide <= 36) return 14;
  return 20;
}

/**
 * 孤立像素清理：对量化后的网格做 N 遍"众数滤波"
 * 每一遍：凡是某格颜色在 8 邻域里同色数 ≤ minSame，就替换为邻域中出现最多的颜色
 * passes=1~3 足够清理大多数噪点
 */
export function cleanIsolatedPixels(
  grid: Uint8Array,
  width: number,
  height: number,
  passes: number = 1,
): Uint8Array {
  let cur = new Uint8Array(grid);
  for (let p = 0; p < passes; p++) {
    const next = new Uint8Array(cur);
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const i = row * width + col;
        const myColor = cur[i];
        if (myColor === 0) continue;

        const counts = new Map<number, number>();
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nc = col + dx, nr = row + dy;
            if (nc < 0 || nc >= width || nr < 0 || nr >= height) continue;
            const c = cur[nr * width + nc];
            if (c > 0) counts.set(c, (counts.get(c) || 0) + 1);
          }
        }

        const sameCount = counts.get(myColor) || 0;
        if (sameCount <= 1) {
          let bestColor = myColor, bestCount = 0;
          for (const [c, cnt] of counts) {
            if (cnt > bestCount) { bestCount = cnt; bestColor = c; }
          }
          if (bestCount > sameCount) next[i] = bestColor;
        }
      }
    }
    cur = next;
  }
  return cur;
}

// 把 HTMLImageElement 缩放到指定尺寸并量化到 MARD 调色板
// fit: 'contain' (保持比例留空) 或 'cover' (填满，可能裁剪)
export function quantizeImageToGrid(
  img: HTMLImageElement,
  options: {
    width?: number;
    height?: number;
    fit?: 'contain' | 'cover';
    bgTransparent?: boolean;
    transparentThreshold?: number;
  } = {},
): Uint8Array {
  const { width = 52, height = 52, fit = 'contain', bgTransparent = true, transparentThreshold = 128 } = options;

  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  const ctx = off.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, width, height);

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  let dx = 0, dy = 0, dw = width, dh = height;
  if (fit === 'contain') {
    const r = Math.min(width / iw, height / ih);
    dw = Math.round(iw * r);
    dh = Math.round(ih * r);
    dx = Math.floor((width - dw) / 2);
    dy = Math.floor((height - dh) / 2);
  } else {
    const r = Math.max(width / iw, height / ih);
    dw = Math.round(iw * r);
    dh = Math.round(ih * r);
    dx = Math.floor((width - dw) / 2);
    dy = Math.floor((height - dh) / 2);
  }
  ctx.drawImage(img, dx, dy, dw, dh);

  const data = ctx.getImageData(0, 0, width, height).data;
  const out = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    if (bgTransparent && a < transparentThreshold) {
      out[i] = 0;
    } else {
      out[i] = nearestPaletteIndex(r, g, b);
    }
  }
  return out;
}

// 直接对一段 RGBA imageData 数据量化
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

/**
 * 将小网格居中放置到大画布上（用于导入后自动居中）
 * 返回大画布的 Uint8Array（画布尺寸 × 画布尺寸）
 */
export function centerGridOnCanvas(
  smallGrid: Uint8Array,
  smallW: number,
  smallH: number,
  canvasSize: number = 52,
): Uint8Array {
  const full = new Uint8Array(canvasSize * canvasSize);
  const dx = Math.floor((canvasSize - smallW) / 2);
  const dy = Math.floor((canvasSize - smallH) / 2);
  for (let row = 0; row < smallH; row++) {
    for (let col = 0; col < smallW; col++) {
      const srcIdx = row * smallW + col;
      const dstCol = dx + col;
      const dstRow = dy + row;
      if (dstRow >= 0 && dstRow < canvasSize && dstCol >= 0 && dstCol < canvasSize) {
        full[dstRow * canvasSize + dstCol] = smallGrid[srcIdx];
      }
    }
  }
  return full;
}
