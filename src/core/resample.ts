// 图像缩放与再采样：支持动态目标网格尺寸和插值方式
export interface ResampleOptions {
  targetWidth: number;   // 目标宽度（bead 数）
  targetHeight: number;  // 目标高度（bead 数）
  scale: number;         // 图片显示比例，1.0 = 填满网格
  offsetX: number;       // 水平偏移（像素）
  offsetY: number;       // 垂直偏移（像素）
  blur: number;          // 下采样前模糊半径（px），0 = 不模糊
  contrast: number;      // 对比度倍数
  brightness: number;    // 亮度倍数
  saturate: number;      // 饱和度倍数
  cropSubject: boolean;  // 先按高饱和/深色区域找到主体，排除截图留白和投影
  preShrink: boolean;    // 先把主体强制缩小成低分辨率草稿，再适配网格
  preShrinkSize: number; // 预缩小后的最长边像素
  hardEdges: boolean;    // 平面图案：每格取主导颜色，避免边缘被平均成杂色
  preserveLines: boolean; // 智能下采样：保留细线
  lineThreshold: number;  // 像素亮度低于此值视为"线条"，0~255，默认 120
  interpolation: 'bilinear' | 'nearest'; // 插值方式
}

// 将配置好的图片绘制到 offscreen canvas，再读取为目标尺寸的 ImageData
export function resampleToGrid(
  img: HTMLImageElement,
  options: Partial<ResampleOptions> = {},
): ImageData {
  const {
    targetWidth = 52,
    targetHeight = 52,
    scale = 1, offsetX = 0, offsetY = 0,
    blur = 0, contrast = 1, brightness = 1, saturate = 1,
    cropSubject = false, preShrink = false, preShrinkSize = 48,
    hardEdges = false, preserveLines = false, lineThreshold = 120,
    interpolation = 'bilinear',
  } = options;

  // 1) 大尺寸画布：把图绘制到 targetWidth/Height × oversample 大小，并应用滤镜
  const oversample = 4;
  const bigW = targetWidth * oversample;
  const bigH = targetHeight * oversample;

  const big = document.createElement('canvas');
  big.width = bigW;
  big.height = bigH;
  const bctx = big.getContext('2d')!;
  bctx.clearRect(0, 0, bigW, bigH);

  const filters: string[] = [];
  if (blur > 0)         filters.push(`blur(${blur * oversample}px)`);
  if (contrast !== 1)   filters.push(`contrast(${contrast})`);
  if (brightness !== 1) filters.push(`brightness(${brightness})`);
  if (saturate !== 1)   filters.push(`saturate(${saturate})`);
  bctx.filter = filters.length > 0 ? filters.join(' ') : 'none';
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';

  const crop = cropSubject ? detectSubjectCrop(img) : null;
  const sx = crop?.x ?? 0;
  const sy = crop?.y ?? 0;
  const sw = crop?.w ?? img.naturalWidth;
  const sh = crop?.h ?? img.naturalHeight;

  const source = preShrink
    ? createPreShrunkSource(img, sx, sy, sw, sh, preShrinkSize)
    : { image: img, sx, sy, sw, sh };

  const fitRatio = Math.min(bigW / source.sw, bigH / source.sh);
  const drawW = source.sw * fitRatio * scale;
  const drawH = source.sh * fitRatio * scale;
  const dx = (bigW - drawW) / 2 + offsetX * oversample;
  const dy = (bigH - drawH) / 2 + offsetY * oversample;
  bctx.imageSmoothingEnabled = !preShrink;
  bctx.drawImage(source.image, source.sx, source.sy, source.sw, source.sh, dx, dy, drawW, drawH);
  bctx.filter = 'none';

  // 2) 缩到目标尺寸
  const off = document.createElement('canvas');
  off.width = targetWidth;
  off.height = targetHeight;
  const ctx = off.getContext('2d')!;

  if (!preserveLines && !hardEdges) {
    if (interpolation === 'nearest') {
      // Nearest Neighbor：关闭平滑，像素保持清晰边缘
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(big, 0, 0, targetWidth, targetHeight);
    } else {
      // 双线性缩放（取平均）
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(big, 0, 0, targetWidth, targetHeight);
    }
    return ctx.getImageData(0, 0, targetWidth, targetHeight);
  }

  // 3) 手动逐格采样（hardEdges / preserveLines 模式）
  const bigData = bctx.getImageData(0, 0, bigW, bigH).data;
  const out = ctx.createImageData(targetWidth, targetHeight);
  const blockX = oversample;
  const blockY = oversample;

  for (let cy = 0; cy < targetHeight; cy++) {
    for (let cx = 0; cx < targetWidth; cx++) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
      let darkR = 0, darkG = 0, darkB = 0, darkA = 0, darkCount = 0;
      const bins = new Map<number, { count: number; r: number; g: number; b: number; a: number }>();

      for (let sy = 0; sy < blockY; sy++) {
        for (let sx = 0; sx < blockX; sx++) {
          const px = cx * blockX + sx;
          const py = cy * blockY + sy;
          const i = (py * bigW + px) * 4;
          const r = bigData[i], g = bigData[i + 1], b = bigData[i + 2], a = bigData[i + 3];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          sumR += r; sumG += g; sumB += b; sumA += a; count++;
          if (hardEdges && a >= 128) {
            const rb = Math.round(r / 24);
            const gb = Math.round(g / 24);
            const bb = Math.round(b / 24);
            const key = (rb << 16) | (gb << 8) | bb;
            const bin = bins.get(key) || { count: 0, r: 0, g: 0, b: 0, a: 0 };
            bin.count++;
            bin.r += r;
            bin.g += g;
            bin.b += b;
            bin.a += a;
            bins.set(key, bin);
          }
          if (a >= 128 && lum < lineThreshold) {
            darkR += r;
            darkG += g;
            darkB += b;
            darkA += a;
            darkCount++;
          }
        }
      }

      const avgR = sumR / count, avgG = sumG / count, avgB = sumB / count;
      const avgA = sumA / count;
      const avgLum = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;

      const oi = (cy * targetWidth + cx) * 4;
      if (hardEdges && bins.size > 0) {
        let best = Array.from(bins.values())[0];
        for (const bin of bins.values()) {
          if (bin.count > best.count) best = bin;
        }
        out.data[oi]     = best.r / best.count;
        out.data[oi + 1] = best.g / best.count;
        out.data[oi + 2] = best.b / best.count;
        out.data[oi + 3] = best.a / best.count;
        continue;
      }

      const darkCoverage = darkCount / count;
      const darkAvgLum = darkCount > 0
        ? 0.299 * (darkR / darkCount) + 0.587 * (darkG / darkCount) + 0.114 * (darkB / darkCount)
        : 256;

      if (darkCoverage >= 0.12 && avgLum - darkAvgLum > 22) {
        out.data[oi]     = darkR / darkCount;
        out.data[oi + 1] = darkG / darkCount;
        out.data[oi + 2] = darkB / darkCount;
        out.data[oi + 3] = darkA / darkCount;
      } else {
        out.data[oi]     = avgR;
        out.data[oi + 1] = avgG;
        out.data[oi + 2] = avgB;
        out.data[oi + 3] = avgA;
      }
    }
  }
  return out;
}

function createPreShrunkSource(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  maxSide: number,
): { image: HTMLCanvasElement; sx: number; sy: number; sw: number; sh: number } {
  const longest = Math.max(sw, sh);
  const ratio = Math.min(1, Math.max(8, maxSide) / longest);
  const w = Math.max(1, Math.round(sw * ratio));
  const h = Math.max(1, Math.round(sh * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

  return { image: canvas, sx: 0, sy: 0, sw: w, sh: h };
}

function detectSubjectCrop(img: HTMLImageElement): { x: number; y: number; w: number; h: number } | null {
  const maxSide = 360;
  const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * ratio));
  const h = Math.max(1, Math.round(img.naturalHeight * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 128) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (saturation > 0.18 || lum < 90) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const subjectW = maxX - minX + 1;
  const subjectH = maxY - minY + 1;
  const pad = Math.round(Math.max(subjectW, subjectH) * 0.14);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  return {
    x: minX / ratio,
    y: minY / ratio,
    w: (maxX - minX + 1) / ratio,
    h: (maxY - minY + 1) / ratio,
  };
}

// 计算将图片「适配网格」的初始缩放比例
export function fitScaleToGrid(
  _imgWidth: number,
  _imgHeight: number,
  targetW: number = 52,
  targetH: number = 52,
  paddingCells: number = 4,
): number {
  const maxDim = Math.max(targetW, targetH);
  const usableCells = Math.max(1, maxDim - paddingCells * 2);
  return usableCells / maxDim;
}
