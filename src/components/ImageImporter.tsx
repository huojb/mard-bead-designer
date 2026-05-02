import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useEditorStore, GRID_SIZE } from '../store/editor';
import { resampleToGrid, fitScaleToGrid } from '../core/resample';
import { quantizeRGBA, posterizeRGBA } from '../core/quantize';
import { detectSolidBackground, removeSolidBackground } from '../core/solidBgRemove';
import { MARD221 } from '../data/mard221';

const PREVIEW_CELL = 12; // 预览时每格像素大小
const PREVIEW_SIZE = GRID_SIZE * PREVIEW_CELL;

const ImageImporter: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [colorCount, setColorCount] = useState(0); // 0 = 不简化
  const [previewGrid, setPreviewGrid] = useState<Uint8Array | null>(null);

  const importImage = useEditorStore((s) => s.importImage);
  const importScale = useEditorStore((s) => s.importScale);
  const importOffsetX = useEditorStore((s) => s.importOffsetX);
  const importOffsetY = useEditorStore((s) => s.importOffsetY);
  const setImportTransform = useEditorStore((s) => s.setImportTransform);
  const commitImport = useEditorStore((s) => s.commitImport);
  const cancelImport = useEditorStore((s) => s.cancelImport);

  // 更新预览
  const updatePreview = useCallback(() => {
    if (!importImage) return;
    const imageData = resampleToGrid(importImage, {
      scale: importScale,
      offsetX: importOffsetX,
      offsetY: importOffsetY,
      gridSize: GRID_SIZE,
    });

    let data: Uint8ClampedArray = imageData.data as unknown as Uint8ClampedArray;

    // 纯色背景去除
    if (removeBg) {
      const bg = detectSolidBackground(data, GRID_SIZE, GRID_SIZE);
      if (bg) {
        data = removeSolidBackground(data, GRID_SIZE, GRID_SIZE, bg);
      }
    }

    // 色彩简化（k-means）
    if (colorCount > 0) {
      data = posterizeRGBA(data, colorCount);
    }

    const grid = quantizeRGBA(data);
    setPreviewGrid(grid);

    // 渲染预览画布
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    for (let i = 0; i < grid.length; i++) {
      const col = i % GRID_SIZE;
      const row = Math.floor(i / GRID_SIZE);
      const x = col * PREVIEW_CELL;
      const y = row * PREVIEW_CELL;
      const colorIdx = grid[i];

      if (colorIdx === 0) {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(x, y, PREVIEW_CELL, PREVIEW_CELL);
        ctx.strokeStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + PREVIEW_CELL, y + PREVIEW_CELL);
        ctx.stroke();
      } else {
        const color = MARD221[colorIdx];
        ctx.fillStyle = `rgb(${color.rgb[0]},${color.rgb[1]},${color.rgb[2]})`;
        ctx.fillRect(x, y, PREVIEW_CELL, PREVIEW_CELL);
      }
    }

    // 网格线
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = i * PREVIEW_CELL;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, PREVIEW_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(PREVIEW_SIZE, pos);
      ctx.stroke();
    }

    // 边界遮罩（表示超出52x52区域的部分，这里因为是精确52x52所以没有超出）
  }, [importImage, importScale, importOffsetX, importOffsetY, removeBg, colorCount]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (!importImage) return;
      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      const newScale = Math.max(0.1, Math.min(3, importScale * delta));
      setImportTransform(newScale, importOffsetX, importOffsetY);
    },
    [importImage, importScale, importOffsetX, importOffsetY, setImportTransform],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStart) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setImportTransform(importScale, importOffsetX + dx / PREVIEW_CELL, importOffsetY + dy / PREVIEW_CELL);
      setDragStart({ x: e.clientX, y: e.clientY });
    },
    [isDragging, dragStart, importScale, importOffsetX, importOffsetY, setImportTransform],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  const handleFit = () => {
    if (!importImage) return;
    const scale = fitScaleToGrid(importImage.naturalWidth, importImage.naturalHeight, GRID_SIZE);
    setImportTransform(scale, 0, 0);
  };

  const handleReset = () => {
    setImportTransform(1, 0, 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>调整图片位置和大小</div>

      <div
        style={{
          position: 'relative',
          border: '2px solid #2196f3',
          borderRadius: 4,
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          style={{ display: 'block', width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={handleFit} style={btnStyle}>适配网格</button>
        <button onClick={handleReset} style={btnStyle}>重置</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} />
          去除纯色背景
        </label>
      </div>

      {/* 色彩简化 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555' }}>
        <span style={{ whiteSpace: 'nowrap' }}>色彩简化</span>
        <input
          type="range"
          min={0}
          max={16}
          step={1}
          value={colorCount}
          onChange={(e) => setColorCount(Number(e.target.value))}
          style={{ width: 120 }}
        />
        <span style={{ minWidth: 48, color: colorCount === 0 ? '#aaa' : '#2196f3', fontWeight: colorCount > 0 ? 600 : 400 }}>
          {colorCount === 0 ? '关闭' : `${colorCount} 色`}
        </span>
      </div>

      <div style={{ fontSize: 11, color: '#999' }}>
        滚轮缩放 · 拖拽移动 · 当前缩放 {(importScale * 100).toFixed(0)}%
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => {
            if (previewGrid) commitImport(previewGrid);
          }}
          style={{ ...btnStyle, backgroundColor: '#2196f3', color: '#fff', border: 'none', padding: '8px 24px' }}
        >
          确认导入
        </button>
        <button
          onClick={cancelImport}
          style={{ ...btnStyle, padding: '8px 24px' }}
        >
          取消
        </button>
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  border: '1px solid #ddd',
  borderRadius: 4,
  backgroundColor: '#fff',
  cursor: 'pointer',
};

export default ImageImporter;
