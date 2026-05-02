// 魔棒选区：选取全图所有颜色相同的格子
export function magicWandSelect(
  grid: Uint8Array,
  startIdx: number,
): Set<number> {
  const targetColorIdx = grid[startIdx];
  if (targetColorIdx === 0) return new Set(); // 空格子不选

  const selected = new Set<number>();
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === targetColorIdx) {
      selected.add(i);
    }
  }
  return selected;
}
