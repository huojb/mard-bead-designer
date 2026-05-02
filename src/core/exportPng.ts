// PNG 导出：渲染 N 倍大画布 + 网格线 + 色号文字
import { MARD221, contrastTextColor } from '../data/mard221';

export interface ExportOptions {
  cellSize: number; // 每格像素大小，默认 40
  showLabels: boolean; // 是否显示色号
  monochrome: boolean; // 是否黑白涂色版（只画网格+色号，不填色）
}

export function renderExportCanvas(
  grid: Uint8Array,
  options: Partial<ExportOptions> = {},
): HTMLCanvasElement {
  const { cellSize = 40, showLabels = true, monochrome = false } = options;
  const gridSize = 52;
  const canvasSize = gridSize * cellSize;

  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;

  // 背景白
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // 画色块
  for (let i = 0; i < grid.length; i++) {
    const col = i % gridSize;
    const row = Math.floor(i / gridSize);
    const x = col * cellSize;
    const y = row * cellSize;
    const colorIdx = grid[i];

    if (colorIdx === 0) {
      // 空格：画浅灰斜线表示空白
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.strokeStyle = '#e0e0e0';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + cellSize, y + cellSize);
      ctx.stroke();
    } else {
      const color = MARD221[colorIdx];
      if (!monochrome) {
        ctx.fillStyle = `rgb(${color.rgb[0]},${color.rgb[1]},${color.rgb[2]})`;
        ctx.fillRect(x, y, cellSize, cellSize);
      } else {
        // 黑白版：只画浅灰底色
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
  }

  // 画网格线
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  for (let i = 0; i <= gridSize; i++) {
    const pos = i * cellSize;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvasSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(canvasSize, pos);
    ctx.stroke();
  }

  // 画色号文字
  if (showLabels) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = Math.max(8, Math.floor(cellSize / 4));
    ctx.font = `${fontSize}px sans-serif`;

    for (let i = 0; i < grid.length; i++) {
      const col = i % gridSize;
      const row = Math.floor(i / gridSize);
      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;
      const colorIdx = grid[i];

      if (colorIdx === 0) continue;
      const color = MARD221[colorIdx];
      const text = color.id;

      if (monochrome) {
        ctx.fillStyle = '#333333';
      } else {
        ctx.fillStyle = contrastTextColor(color.rgb);
      }
      ctx.fillText(text, x, y);
    }
  }

  return canvas;
}
