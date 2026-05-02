// 纯色背景一键去除
import { rgbToLab, deltaE } from './color';

const CORNER_SIZE = 5; // 四角取 5×5 区域
const BG_TOLERANCE = 10; // 背景色判断容差

function getCornerPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cornerX: number,
  cornerY: number,
): Array<[number, number, number]> {
  const pixels: Array<[number, number, number]> = [];
  for (let y = 0; y < CORNER_SIZE; y++) {
    for (let x = 0; x < CORNER_SIZE; x++) {
      const px = cornerX + x;
      const py = cornerY + y;
      if (px >= width || py >= height) continue;
      const i = (py * width + px) * 4;
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  return pixels;
}

function modeColor(pixels: Array<[number, number, number]>): [number, number, number] | null {
  if (pixels.length === 0) return null;
  // 将 RGB 量化到 8×8×8 桶中找众数
  const buckets = new Map<string, { count: number; rgb: [number, number, number] }>();
  for (const [r, g, b] of pixels) {
    const key = `${Math.round(r / 32)},${Math.round(g / 32)},${Math.round(b / 32)}`;
    if (!buckets.has(key)) {
      buckets.set(key, { count: 0, rgb: [r, g, b] });
    }
    buckets.get(key)!.count++;
  }
  let best = { count: 0, rgb: [0, 0, 0] as [number, number, number] };
  for (const v of buckets.values()) {
    if (v.count > best.count) best = v;
  }
  return best.rgb;
}

export function detectSolidBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): [number, number, number] | null {
  const corners = [
    getCornerPixels(data, width, height, 0, 0), // 左上
    getCornerPixels(data, width, height, width - CORNER_SIZE, 0), // 右上
    getCornerPixels(data, width, height, 0, height - CORNER_SIZE), // 左下
    getCornerPixels(data, width, height, width - CORNER_SIZE, height - CORNER_SIZE), // 右下
  ];

  const modes = corners.map(modeColor).filter(Boolean) as Array<[number, number, number]>;
  if (modes.length < 3) return null; // 至少三个角有效

  // 检查四角众数是否一致
  const baseLab = rgbToLab(modes[0][0], modes[0][1], modes[0][2]);
  for (let i = 1; i < modes.length; i++) {
    const lab = rgbToLab(modes[i][0], modes[i][1], modes[i][2]);
    if (deltaE(baseLab, lab) > BG_TOLERANCE) return null;
  }

  return modes[0];
}

// 将图像中所有与 bgColor 接近的像素设为透明
export function removeSolidBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bgColor: [number, number, number],
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data);
  const bgLab = rgbToLab(bgColor[0], bgColor[1], bgColor[2]);

  for (let i = 0; i < width * height; i++) {
    const r = out[i * 4];
    const g = out[i * 4 + 1];
    const b = out[i * 4 + 2];
    const lab = rgbToLab(r, g, b);
    if (deltaE(bgLab, lab) <= BG_TOLERANCE) {
      out[i * 4 + 3] = 0; // alpha = 0
    }
  }
  return out;
}
