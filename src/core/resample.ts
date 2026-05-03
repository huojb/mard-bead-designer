// 图像缩放与再采样：支持交互式缩放比例 + 平移偏移
export interface ResampleOptions {
  scale: number;        // 图片显示比例，1.0 = 原始大小填满网格
  offsetX: number;      // 水平偏移（像素）
  offsetY: number;      // 垂直偏移（像素）
  gridSize: number;     // 默认 52
  blur: number;         // 下采样前模糊半径（px），0 = 不模糊
  contrast: number;     // 对比度倍数
  brightness: number;   // 亮度倍数
  saturate: number;     // 饱和度倍数
  preserveLines: boolean; // 智能下采样：保留细线
  lineThreshold: number;  // 像素亮度低于此值视为"线条"，0~255，默认 120
}

// 将配置好的图片绘制到 offscreen canvas，再读取为 52×52 的 ImageData
export function resampleToGrid(
  img: HTMLImageElement,
  options: Partial<ResampleOptions> = {},
): ImageData {
  const {
    scale = 1, offsetX = 0, offsetY = 0, gridSize = 52,
    blur = 0, contrast = 1, brightness = 1, saturate = 1,
    preserveLines = false, lineThreshold = 120,
  } = options;

  // 1) 大尺寸画布：把图绘制到 gridSize × oversample 大小，并应用滤镜
  const oversample = Math.max(1, Math.ceil(1 / scale)) * 4; // 4x 过采样，给 min-filter 足够分辨率
  const bigSize = gridSize * oversample;

  const big = document.createElement('canvas');
  big.width = bigSize;
  big.height = bigSize;
  const bctx = big.getContext('2d')!;
  bctx.clearRect(0, 0, bigSize, bigSize);

  const filters: string[] = [];
  if (blur > 0)         filters.push(`blur(${blur * oversample}px)`);
  if (contrast !== 1)   filters.push(`contrast(${contrast})`);
  if (brightness !== 1) filters.push(`brightness(${brightness})`);
  if (saturate !== 1)   filters.push(`saturate(${saturate})`);
  bctx.filter = filters.length > 0 ? filters.join(' ') : 'none';
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';

  const cellW = bigSize * scale;
  const cellH = bigSize * scale;
  const dx = (bigSize - cellW) / 2 + offsetX * oversample;
  const dy = (bigSize - cellH) / 2 + offsetY * oversample;
  bctx.drawImage(img, dx, dy, cellW, cellH);
  bctx.filter = 'none';

  // 2) 缩到目标尺寸
  const off = document.createElement('canvas');
  off.width = gridSize;
  off.height = gridSize;
  const ctx = off.getContext('2d')!;

  if (!preserveLines) {
    // 普通模式：双线性缩放（取平均）
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(big, 0, 0, gridSize, gridSize);
    return ctx.getImageData(0, 0, gridSize, gridSize);
  }

  // 3) 线条保留模式：手动逐格采样
  // 对每个输出格子，扫描其对应的 oversample × oversample 源像素区域
  // - 找出最暗像素（minLum）
  // - 计算平均色（avg）
  // - 如果最暗像素显著比平均色暗（说明这格里有一条细线穿过），就用最暗像素的颜色
  // - 否则用平均色
  // 这样 1 像素粗的细线在被平均掉之前就被"抢救"出来了
  const bigData = bctx.getImageData(0, 0, bigSize, bigSize).data;
  const out = ctx.createImageData(gridSize, gridSize);
  const block = oversample;

  for (let cy = 0; cy < gridSize; cy++) {
    for (let cx = 0; cx < gridSize; cx++) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
      let minLum = 256;
      let minR = 255, minG = 255, minB = 255, minA = 255;

      for (let sy = 0; sy < block; sy++) {
        for (let sx = 0; sx < block; sx++) {
          const px = cx * block + sx;
          const py = cy * block + sy;
          const i = (py * bigSize + px) * 4;
          const r = bigData[i], g = bigData[i + 1], b = bigData[i + 2], a = bigData[i + 3];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          sumR += r; sumG += g; sumB += b; sumA += a; count++;
          if (lum < minLum) {
            minLum = lum;
            minR = r; minG = g; minB = b; minA = a;
          }
        }
      }

      const avgR = sumR / count, avgG = sumG / count, avgB = sumB / count;
      const avgA = sumA / count;
      const avgLum = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;

      const oi = (cy * gridSize + cx) * 4;
      // 关键判定：当格内最暗像素低于阈值，且明显比平均色更暗时，认为有"线条"，直接保留最暗像素
      if (minLum < lineThreshold && avgLum - minLum > 25) {
        out.data[oi]     = minR;
        out.data[oi + 1] = minG;
        out.data[oi + 2] = minB;
        out.data[oi + 3] = minA;
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

// 计算将图片「适配网格」的初始缩放比例
export function fitScaleToGrid(
  imgWidth: number,
  imgHeight: number,
  gridSize: number = 52,
): number {
  const scaleW = gridSize / imgWidth;
  const scaleH = gridSize / imgHeight;
  return Math.min(scaleW, scaleH); // contain 模式
}
