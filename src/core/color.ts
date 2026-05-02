// 颜色空间转换与距离计算
import { MARD221 } from '../data/mard221';

export type RGB = [number, number, number];
export type Lab = [number, number, number];

export function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const srgb = [r, g, b].map((v) => {
    const x = v / 255;
    return x > 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92;
  });
  const [R, G, B] = srgb;
  const X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  return [X * 100, Y * 100, Z * 100];
}

export function xyzToLab(x: number, y: number, z: number): Lab {
  const refX = 95.047;
  const refY = 100.0;
  const refZ = 108.883;
  const fx = pivot(x / refX);
  const fy = pivot(y / refY);
  const fz = pivot(z / refZ);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function pivot(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

export function deltaE(a: Lab, b: Lab): number {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

// 预计算调色板的 Lab 值（索引 0 是空，跳过）
const PALETTE_LAB: Lab[] = MARD221.map((c) => rgbToLab(c.rgb[0], c.rgb[1], c.rgb[2]));

// 缓存 RGB → 调色板索引
const QUANT_CACHE = new Map<number, number>();

export function nearestPaletteIndex(r: number, g: number, b: number): number {
  const key = (r << 16) | (g << 8) | b;
  const cached = QUANT_CACHE.get(key);
  if (cached !== undefined) return cached;
  const lab = rgbToLab(r, g, b);
  let bestIdx = 1;
  let bestD = Infinity;
  // 从索引 1 开始（跳过 EMPTY）
  for (let i = 1; i < PALETTE_LAB.length; i++) {
    const d = deltaE(lab, PALETTE_LAB[i]);
    if (d < bestD) {
      bestD = d;
      bestIdx = i;
    }
  }
  QUANT_CACHE.set(key, bestIdx);
  return bestIdx;
}

export function rgbDistance(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
