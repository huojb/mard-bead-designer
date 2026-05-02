import { create } from 'zustand';
import { HistoryStack } from '../core/history';

export type Tool =
  | 'brush'
  | 'eraser'
  | 'bucket'
  | 'eyedropper'
  | 'magicWand'
  | 'rectSelect'
  | 'pan';

export const GRID_SIZE = 52;
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

interface EditorState {
  // 网格数据：索引0为空，1..221对应MARD色卡
  grid: Uint8Array;

  // 工具状态
  tool: Tool;
  brushSize: 1 | 3 | 5;
  currentColorIdx: number; // 1..221

  // 导入状态
  importImage: HTMLImageElement | null;
  importScale: number;
  importOffsetX: number;
  importOffsetY: number;
  isImporting: boolean;

  // 选区
  selection: Set<number> | null;

  // 历史
  history: HistoryStack;

  // 画布缩放
  zoomIdx: number;
  setZoomIdx: (idx: number) => void;

  // Actions
  setTool: (tool: Tool) => void;
  setBrushSize: (size: 1 | 3 | 5) => void;
  setCurrentColorIdx: (idx: number) => void;
  setCell: (idx: number, colorIdx: number) => void;
  setCells: (indices: number[], colorIdx: number) => void;
  floodFill: (startIdx: number, colorIdx: number) => void;
  clearSelection: () => void;
  setSelection: (selection: Set<number> | null) => void;
  deleteSelection: () => void;
  fillSelection: (colorIdx: number) => void;

  // 导入
  startImport: (img: HTMLImageElement) => void;
  setImportTransform: (scale: number, offsetX: number, offsetY: number) => void;
  commitImport: (grid: Uint8Array) => void;
  cancelImport: () => void;

  // 历史
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // 全局
  clearGrid: () => void;
  loadGrid: (grid: Uint8Array) => void;
}

function createEmptyGrid(): Uint8Array {
  return new Uint8Array(TOTAL_CELLS);
}

export const useEditorStore = create<EditorState>((set, get) => {
  const history = new HistoryStack();
  const initialGrid = createEmptyGrid();
  history.init(initialGrid);

  return {
    grid: initialGrid,
    tool: 'brush',
    brushSize: 1,
    currentColorIdx: 1,
    zoomIdx: 2, // 默认 1x
    importImage: null,
    importScale: 1,
    importOffsetX: 0,
    importOffsetY: 0,
    isImporting: false,
    selection: null,
    history,

    setZoomIdx: (zoomIdx) => set({ zoomIdx }),

    setTool: (tool) => set({ tool, selection: null }),
    setBrushSize: (brushSize) => set({ brushSize }),
    setCurrentColorIdx: (currentColorIdx) => set({ currentColorIdx }),

    setCell: (idx, colorIdx) => {
      const { grid } = get();
      if (grid[idx] === colorIdx) return;
      const next = new Uint8Array(grid);
      next[idx] = colorIdx;
      set({ grid: next });
    },

    setCells: (indices, colorIdx) => {
      const { grid } = get();
      const next = new Uint8Array(grid);
      for (const idx of indices) {
        next[idx] = colorIdx;
      }
      set({ grid: next });
    },

    floodFill: (startIdx, colorIdx) => {
      const { grid } = get();
      const targetIdx = grid[startIdx];
      if (targetIdx === colorIdx) return;

      const next = new Uint8Array(grid);
      const queue = [startIdx];
      const visited = new Set<number>([startIdx]);
      next[startIdx] = colorIdx;

      while (queue.length > 0) {
        const idx = queue.shift()!;
        const col = idx % GRID_SIZE;
        const row = Math.floor(idx / GRID_SIZE);

        const neighbors = [
          [col - 1, row],
          [col + 1, row],
          [col, row - 1],
          [col, row + 1],
        ];

        for (const [nc, nr] of neighbors) {
          if (nc < 0 || nc >= GRID_SIZE || nr < 0 || nr >= GRID_SIZE) continue;
          const nidx = nr * GRID_SIZE + nc;
          if (visited.has(nidx)) continue;
          if (next[nidx] !== targetIdx) continue;
          visited.add(nidx);
          next[nidx] = colorIdx;
          queue.push(nidx);
        }
      }

      set({ grid: next });
    },

    clearSelection: () => set({ selection: null }),
    setSelection: (selection) => set({ selection }),

    deleteSelection: () => {
      const { grid, selection } = get();
      if (!selection || selection.size === 0) return;
      const next = new Uint8Array(grid);
      for (const idx of selection) {
        next[idx] = 0;
      }
      set({ grid: next, selection: null });
    },

    fillSelection: (colorIdx) => {
      const { grid, selection } = get();
      if (!selection || selection.size === 0) return;
      const next = new Uint8Array(grid);
      for (const idx of selection) {
        next[idx] = colorIdx;
      }
      set({ grid: next, selection: null });
    },

    startImport: (img) =>
      set({
        importImage: img,
        importScale: Math.min(GRID_SIZE / img.naturalWidth, GRID_SIZE / img.naturalHeight),
        importOffsetX: 0,
        importOffsetY: 0,
        isImporting: true,
        selection: null,
      }),

    setImportTransform: (scale, offsetX, offsetY) =>
      set({ importScale: scale, importOffsetX: offsetX, importOffsetY: offsetY }),

    commitImport: (newGrid) => {
      get().pushHistory();
      set({
        grid: new Uint8Array(newGrid),
        importImage: null,
        isImporting: false,
        selection: null,
      });
    },

    cancelImport: () =>
      set({
        importImage: null,
        isImporting: false,
        importScale: 1,
        importOffsetX: 0,
        importOffsetY: 0,
      }),

    pushHistory: () => {
      const { grid, history } = get();
      history.push(grid);
    },

    undo: () => {
      const { history } = get();
      const prev = history.undo(get().grid);
      if (prev) set({ grid: prev, selection: null });
    },

    redo: () => {
      const { history } = get();
      const next = history.redo(get().grid);
      if (next) set({ grid: next, selection: null });
    },

    canUndo: () => get().history.canUndo(),
    canRedo: () => get().history.canRedo(),

    clearGrid: () => {
      const empty = createEmptyGrid();
      get().history.init(empty);
      set({ grid: empty, selection: null });
    },

    loadGrid: (newGrid) => {
      get().history.init(newGrid);
      set({ grid: new Uint8Array(newGrid), selection: null });
    },
  };
});
