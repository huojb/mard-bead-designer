// 图像缩放与再采样：支持交互式缩放比例 + 平移偏移
export interface ResampleOptions {
  scale: number; // 图片显示比例，1.0 = 原始大小填满网格
  offsetX: number; // 水平偏移（像素）
  offsetY: number; // 垂直偏移（像素）
  gridSize: number; // 默认 52
}

// 将配置好的图片绘制到 offscreen canvas，再读取为 52×52 的 ImageData
export function resampleToGrid(
  img: HTMLImageElement,
  options: Partial<ResampleOptions> = {},
): ImageData {
  const { scale = 1, offsetX = 0, offsetY = 0, gridSize = 52 } = options;

  const off = document.createElement('canvas');
  off.width = gridSize;
  off.height = gridSize;
  const ctx = off.getContext('2d')!;
  ctx.clearRect(0, 0, gridSize, gridSize);

  // 计算 drawImage 参数
  // 以网格中心为基准，应用缩放和偏移
  const cellW = gridSize * scale;
  const cellH = gridSize * scale;
  const dx = (gridSize - cellW) / 2 + offsetX;
  const dy = (gridSize - cellH) / 2 + offsetY;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, cellW, cellH);

  return ctx.getImageData(0, 0, gridSize, gridSize);
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
