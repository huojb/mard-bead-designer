// 魔棒选区：4 邻域 BFS，基于 CIE Lab ΔE
import { rgbToLab, deltaE } from './color';
import { MARD221 } from '../data/mard221';

export interface WandOptions {
  tolerance: number; // ΔE 容差 0~50
}

export function magicWandSelect(
  grid: Uint8Array,
  startIdx: number,
  options: WandOptions = { tolerance: 10 },
): Set<number> {
  const { tolerance } = options;
  const targetIdx = grid[startIdx];
  if (targetIdx === 0) return new Set(); // 空格子不扩散

  const selected = new Set<number>();
  const queue: number[] = [startIdx];
  selected.add(startIdx);

  const targetColor = MARD221[targetIdx];
  const targetLab = rgbToLab(targetColor.rgb[0], targetColor.rgb[1], targetColor.rgb[2]);

  while (queue.length > 0) {
    const idx = queue.shift()!;
    const col = idx % 52;
    const row = Math.floor(idx / 52);

    const neighbors = [
      [col - 1, row],
      [col + 1, row],
      [col, row - 1],
      [col, row + 1],
    ];

    for (const [nc, nr] of neighbors) {
      if (nc < 0 || nc >= 52 || nr < 0 || nr >= 52) continue;
      const nidx = nr * 52 + nc;
      if (selected.has(nidx)) continue;

      const neighborIdx = grid[nidx];
      if (neighborIdx === 0) continue; // 空格子跳过

      const neighborColor = MARD221[neighborIdx];
      const neighborLab = rgbToLab(neighborColor.rgb[0], neighborColor.rgb[1], neighborColor.rgb[2]);
      const d = deltaE(targetLab, neighborLab);

      if (d <= tolerance) {
        selected.add(nidx);
        queue.push(nidx);
      }
    }
  }

  return selected;
}
