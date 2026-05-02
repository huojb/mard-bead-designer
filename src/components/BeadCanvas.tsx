import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useEditorStore, GRID_SIZE } from '../store/editor';
import { MARD221, contrastTextColor } from '../data/mard221';
import { magicWandSelect } from '../core/magicWand';

const CELL_SIZE = 16;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.5, 2, 3, 4];

const BeadCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null); // 专画虚线框的覆盖层
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ col: number; row: number } | null>(null);
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null);
  const [panStart, setPanStart] = useState<{ x: number; y: number; scrollX: number; scrollY: number } | null>(null);

  const zoomIdx = useEditorStore((s) => s.zoomIdx);
  const zoom = ZOOM_LEVELS[zoomIdx];

  const grid = useEditorStore((s) => s.grid);
  const tool = useEditorStore((s) => s.tool);
  const brushSize = useEditorStore((s) => s.brushSize);
  const currentColorIdx = useEditorStore((s) => s.currentColorIdx);
  const selection = useEditorStore((s) => s.selection);

  const setCell = useEditorStore((s) => s.setCell);
  const setCells = useEditorStore((s) => s.setCells);
  const floodFill = useEditorStore((s) => s.floodFill);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const setCurrentColorIdx = useEditorStore((s) => s.setCurrentColorIdx);
  const setSelection = useEditorStore((s) => s.setSelection);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);
  const fillSelection = useEditorStore((s) => s.fillSelection);

  // 渲染画布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // 背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 画色块
    for (let i = 0; i < grid.length; i++) {
      const col = i % GRID_SIZE;
      const row = Math.floor(i / GRID_SIZE);
      const x = col * CELL_SIZE;
      const y = row * CELL_SIZE;
      const colorIdx = grid[i];

      if (colorIdx === 0) {
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      } else {
        const color = MARD221[colorIdx];
        ctx.fillStyle = `rgb(${color.rgb[0]},${color.rgb[1]},${color.rgb[2]})`;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      }
    }

    // 细网格线（每格）
    ctx.strokeStyle = '#b0b0b0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = i * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(CANVAS_SIZE, pos);
      ctx.stroke();
    }

    // 10×10 辅助线（加粗加深）
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= GRID_SIZE; i += 10) {
      const pos = i * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(CANVAS_SIZE, pos);
      ctx.stroke();
    }

    // 在有颜色的格子上显示色号
    const fontSize = Math.max(5, CELL_SIZE - 8);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < grid.length; i++) {
      const colorIdx = grid[i];
      if (colorIdx === 0) continue;
      const col = i % GRID_SIZE;
      const row = Math.floor(i / GRID_SIZE);
      const x = col * CELL_SIZE + CELL_SIZE / 2;
      const y = row * CELL_SIZE + CELL_SIZE / 2;
      const color = MARD221[colorIdx];
      ctx.fillStyle = contrastTextColor(color.rgb);
      ctx.fillText(color.id, x, y);
    }

    // 画选区高亮（最后画，覆盖在色号上方）
    if (selection) {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      for (const idx of selection) {
        const col = idx % GRID_SIZE;
        const row = Math.floor(idx / GRID_SIZE);
        ctx.strokeRect(col * CELL_SIZE + 1, row * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      }
    }
  }, [grid, selection]);

  // 绘制画笔虚线框覆盖层
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 只在画笔/橡皮工具悬停时显示
    if (!hoverCell || (tool !== 'brush' && tool !== 'eraser')) return;

    const half = Math.floor(brushSize / 2);
    const startCol = hoverCell.col - half;
    const startRow = hoverCell.row - half;
    const px = startCol * CELL_SIZE;
    const py = startRow * CELL_SIZE;
    const size = brushSize * CELL_SIZE;

    // 外描边（白色）防止在深色格子上看不清
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(px - 1, py - 1, size + 2, size + 2);

    // 虚线框
    ctx.strokeStyle = tool === 'eraser' ? '#ff6600' : '#2196f3';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(px, py, size, size);

    ctx.setLineDash([]); // 还原
  }, [hoverCell, brushSize, tool]);

  const getCellFromEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): { col: number; row: number; idx: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const col = Math.floor(x / CELL_SIZE);
      const row = Math.floor(y / CELL_SIZE);
      if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null;
      return { col, row, idx: row * GRID_SIZE + col };
    },
    [],
  );

  const getBrushIndices = useCallback(
    (centerCol: number, centerRow: number): number[] => {
      const indices: number[] = [];
      const half = Math.floor(brushSize / 2);
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const c = centerCol + dx;
          const r = centerRow + dy;
          if (c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE) {
            indices.push(r * GRID_SIZE + c);
          }
        }
      }
      return indices;
    },
    [brushSize],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = getCellFromEvent(e);
      if (!cell) return;

      if (tool === 'brush') {
        pushHistory();
        const indices = getBrushIndices(cell.col, cell.row);
        setCells(indices, currentColorIdx);
        setIsDragging(true);
      } else if (tool === 'eraser') {
        pushHistory();
        const indices = getBrushIndices(cell.col, cell.row);
        setCells(indices, 0);
        setIsDragging(true);
      } else if (tool === 'bucket') {
        pushHistory();
        floodFill(cell.idx, currentColorIdx);
      } else if (tool === 'eyedropper') {
        const colorIdx = grid[cell.idx];
        if (colorIdx > 0) {
          setCurrentColorIdx(colorIdx);
          useEditorStore.getState().setTool('brush');
        }
      } else if (tool === 'magicWand') {
        const selected = magicWandSelect(grid, cell.idx);
        setSelection(selected);
      } else if (tool === 'rectSelect') {
        setDragStart({ col: cell.col, row: cell.row });
        setIsDragging(true);
      } else if (tool === 'pan') {
        const scrollEl = overlayRef.current?.closest('[data-scroll]') as HTMLElement | null;
        setPanStart({
          x: e.clientX,
          y: e.clientY,
          scrollX: scrollEl?.scrollLeft ?? 0,
          scrollY: scrollEl?.scrollTop ?? 0,
        });
        setIsDragging(true);
      }
    },
    [tool, brushSize, currentColorIdx, grid, getCellFromEvent, getBrushIndices, pushHistory, setCells, floodFill, setCurrentColorIdx, setSelection],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = getCellFromEvent(e);
      setHoverCell(cell ? { col: cell.col, row: cell.row } : null);

      if (!isDragging) return;
      if (!cell) return;

      if (tool === 'brush') {
        const indices = getBrushIndices(cell.col, cell.row);
        setCells(indices, currentColorIdx);
      } else if (tool === 'eraser') {
        const indices = getBrushIndices(cell.col, cell.row);
        setCells(indices, 0);
      } else if (tool === 'pan' && panStart) {
        const scrollEl = overlayRef.current?.closest('[data-scroll]') as HTMLElement | null;
        if (scrollEl) {
          scrollEl.scrollLeft = panStart.scrollX - (e.clientX - panStart.x);
          scrollEl.scrollTop = panStart.scrollY - (e.clientY - panStart.y);
        }
      } else if (tool === 'rectSelect' && dragStart) {
        const minCol = Math.min(dragStart.col, cell.col);
        const maxCol = Math.max(dragStart.col, cell.col);
        const minRow = Math.min(dragStart.row, cell.row);
        const maxRow = Math.max(dragStart.row, cell.row);
        const selected = new Set<number>();
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            selected.add(r * GRID_SIZE + c);
          }
        }
        setSelection(selected);
      }
    },
    [isDragging, tool, brushSize, currentColorIdx, dragStart, panStart, getCellFromEvent, getBrushIndices, setCells, setSelection],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
    setPanStart(null);
  }, []);

  // 键盘快捷键：Delete 删除选区
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection && selection.size > 0) {
          pushHistory();
          deleteSelection();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, pushHistory, deleteSelection]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {/* 画布区域 */}
      <div style={{ position: 'relative' }}>
        {/* 主画布 */}
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={{
            display: 'block',
            width: CANVAS_SIZE * zoom,
            height: CANVAS_SIZE * zoom,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        />
        {/* 虚线框覆盖层：接收所有鼠标事件 */}
        <canvas
          ref={overlayRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: CANVAS_SIZE * zoom,
            height: CANVAS_SIZE * zoom,
            pointerEvents: 'auto',
            cursor:
              tool === 'brush'
                ? 'none'
                : tool === 'eraser'
                ? 'none'
                : tool === 'eyedropper'
                ? 'copy'
                : tool === 'magicWand'
                ? 'pointer'
                : tool === 'pan'
                ? isDragging ? 'grabbing' : 'grab'
                : 'default',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setHoverCell(null); }}
        />
        {/* 选区操作提示 */}
        {selection && selection.size > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: -40,
              left: 0,
              right: 0,
              display: 'flex',
              gap: 8,
              justifyContent: 'center',
            }}
          >
            <button onClick={() => { pushHistory(); deleteSelection(); }} style={btnStyle}>
              删除选区
            </button>
            <button onClick={() => { pushHistory(); fillSelection(currentColorIdx); }} style={btnStyle}>
              填充当前色
            </button>
            <button onClick={() => setSelection(null)} style={btnStyle}>
              取消选区
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  border: '1px solid #ccc',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
};

export default BeadCanvas;
