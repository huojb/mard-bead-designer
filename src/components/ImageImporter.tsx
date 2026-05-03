import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useEditorStore, GRID_SIZE } from '../store/editor';
import { resampleToGrid, fitScaleToGrid } from '../core/resample';
import { quantizeRGBA, posterizeRGBA, cleanIsolatedPixels } from '../core/quantize';
import { detectSolidBackground, removeSolidBackground } from '../core/solidBgRemove';
import { MARD221 } from '../data/mard221';

const PREVIEW_CELL = 12;
const PREVIEW_SIZE = GRID_SIZE * PREVIEW_CELL;

// 预设方案
type Preset = {
  label: string; blur: number; contrast: number; brightness: number; saturate: number;
  cleanPasses: number; colorCount: number; preserveLines: boolean; lineThreshold: number;
};
const PRESETS: Preset[] = [
  { label: '普通照片', blur: 1,   contrast: 1.2, brightness: 1.0, saturate: 1.2, cleanPasses: 2, colorCount: 0, preserveLines: false, lineThreshold: 120 },
  { label: '线稿插画', blur: 0,   contrast: 1.4, brightness: 0.95, saturate: 1.5, cleanPasses: 0, colorCount: 0, preserveLines: true,  lineThreshold: 140 },
  { label: '卡通彩图', blur: 0.5, contrast: 1.5, brightness: 1.0, saturate: 2.0, cleanPasses: 1, colorCount: 0, preserveLines: true,  lineThreshold: 100 },
  { label: '简单图标', blur: 0,   contrast: 2.0, brightness: 1.0, saturate: 1.5, cleanPasses: 2, colorCount: 8, preserveLines: false, lineThreshold: 120 },
];

const ImageImporter: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const [removeBg, setRemoveBg] = useState(true);
  const [blur, setBlur] = useState(0);
  const [contrast, setContrast] = useState(1.4);
  const [brightness, setBrightness] = useState(0.95);
  const [saturate, setSaturate] = useState(1.5);
  const [cleanPasses, setCleanPasses] = useState(0);
  const [colorCount, setColorCount] = useState(0);
  const [preserveLines, setPreserveLines] = useState(true);
  const [lineThreshold, setLineThreshold] = useState(140);
  const [previewGrid, setPreviewGrid] = useState<Uint8Array | null>(null);

  const importImage = useEditorStore((s) => s.importImage);
  const importScale = useEditorStore((s) => s.importScale);
  const importOffsetX = useEditorStore((s) => s.importOffsetX);
  const importOffsetY = useEditorStore((s) => s.importOffsetY);
  const setImportTransform = useEditorStore((s) => s.setImportTransform);
  const commitImport = useEditorStore((s) => s.commitImport);
  const cancelImport = useEditorStore((s) => s.cancelImport);

  const applyPreset = (p: Preset) => {
    setBlur(p.blur);
    setContrast(p.contrast);
    setBrightness(p.brightness);
    setSaturate(p.saturate);
    setCleanPasses(p.cleanPasses);
    setColorCount(p.colorCount);
    setPreserveLines(p.preserveLines);
    setLineThreshold(p.lineThreshold);
  };

  const updatePreview = useCallback(() => {
    if (!importImage) return;
    const imageData = resampleToGrid(importImage, {
      scale: importScale,
      offsetX: importOffsetX,
      offsetY: importOffsetY,
      gridSize: GRID_SIZE,
      blur,
      contrast,
      brightness,
      saturate,
      preserveLines,
      lineThreshold,
    });

    let data: Uint8ClampedArray = imageData.data as unknown as Uint8ClampedArray;

    if (removeBg) {
      const bg = detectSolidBackground(data, GRID_SIZE, GRID_SIZE);
      if (bg) data = removeSolidBackground(data, GRID_SIZE, GRID_SIZE, bg);
    }

    if (colorCount >= 2) data = posterizeRGBA(data, colorCount);

    let grid = quantizeRGBA(data);
    if (cleanPasses > 0) grid = cleanIsolatedPixels(grid, cleanPasses);

    setPreviewGrid(grid);

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
      } else {
        const color = MARD221[colorIdx];
        ctx.fillStyle = `rgb(${color.rgb[0]},${color.rgb[1]},${color.rgb[2]})`;
        ctx.fillRect(x, y, PREVIEW_CELL, PREVIEW_CELL);
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = i * PREVIEW_CELL;
      ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, PREVIEW_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(PREVIEW_SIZE, pos); ctx.stroke();
    }
    // 10格辅助线
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i += 10) {
      const pos = i * PREVIEW_CELL;
      ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, PREVIEW_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(PREVIEW_SIZE, pos); ctx.stroke();
    }
  }, [importImage, importScale, importOffsetX, importOffsetY,
      removeBg, blur, contrast, brightness, saturate, cleanPasses, colorCount,
      preserveLines, lineThreshold]);

  useEffect(() => { updatePreview(); }, [updatePreview]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!importImage) return;
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    setImportTransform(Math.max(0.1, Math.min(3, importScale * delta)), importOffsetX, importOffsetY);
  }, [importImage, importScale, importOffsetX, importOffsetY, setImportTransform]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setImportTransform(importScale, importOffsetX + dx / PREVIEW_CELL, importOffsetY + dy / PREVIEW_CELL);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, importScale, importOffsetX, importOffsetY, setImportTransform]);

  const handleMouseUp = useCallback(() => { setIsDragging(false); setDragStart(null); }, []);

  const handleFit = () => {
    if (!importImage) return;
    setImportTransform(fitScaleToGrid(importImage.naturalWidth, importImage.naturalHeight, GRID_SIZE), 0, 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>调整图片 · 实时预览</div>

      {/* 预设快选 */}
      <div style={{ display: 'flex', gap: 6 }}>
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p)} style={presetBtnStyle}>
            {p.label}
          </button>
        ))}
      </div>

      {/* 预览画布 */}
      <div
        style={{ position: 'relative', border: '2px solid #2196f3', borderRadius: 4,
          overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas ref={canvasRef} width={PREVIEW_SIZE} height={PREVIEW_SIZE}
          style={{ display: 'block', width: PREVIEW_SIZE, height: PREVIEW_SIZE }} />
      </div>

      {/* 定位控制 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={handleFit} style={btnStyle}>适配网格</button>
        <button onClick={() => setImportTransform(1, 0, 0)} style={btnStyle}>重置位置</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} />
          去除纯色背景
        </label>
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
            cursor: 'pointer', padding: '3px 8px', borderRadius: 12,
            background: preserveLines ? '#fff3e0' : '#f5f5f5',
            border: `1px solid ${preserveLines ? '#ff9800' : '#ddd'}`,
            color: preserveLines ? '#e65100' : '#666',
            fontWeight: preserveLines ? 600 : 400,
          }}
          title="智能下采样：在每个格子内找最暗像素，如果有比平均色明显更暗的像素（说明有细线穿过），就保留细线颜色而不是平均掉。线稿/卡通图必开"
        >
          <input type="checkbox" checked={preserveLines} onChange={(e) => setPreserveLines(e.target.checked)} />
          🖋️ 线条保留
        </label>
        <span style={{ fontSize: 11, color: '#999' }}>{(importScale * 100).toFixed(0)}%</span>
      </div>

      {/* 参数面板 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '80px 1fr 44px',
        alignItems: 'center', gap: '5px 8px', fontSize: 12, color: '#555',
        background: '#f8f8f8', borderRadius: 8, padding: '10px 14px',
        width: PREVIEW_SIZE, boxSizing: 'border-box',
      }}>
        <Row label="对比度" title="增强对比度让线条更清晰（线稿推荐 1.4~2）"
          min={0.5} max={4} step={0.1} value={contrast} onChange={setContrast}
          display={contrast === 1 ? '默认' : `${contrast.toFixed(1)}x`} />
        <Row label="亮度" title="调暗可以让线条更深，去掉浅色背景干扰"
          min={0.5} max={1.5} step={0.05} value={brightness} onChange={setBrightness}
          display={brightness === 1 ? '默认' : `${brightness.toFixed(2)}x`} />
        <Row label="饱和度" title="增强饱和度让淡彩图颜色更鲜明"
          min={0} max={5} step={0.1} value={saturate} onChange={setSaturate}
          display={saturate === 1 ? '默认' : `${saturate.toFixed(1)}x`} />
        {preserveLines && (
          <Row label="线条阈值" title="像素亮度低于此值才视为线条。值越高越容易识别浅色线条；过高会把灰色阴影也当线条"
            min={50} max={200} step={5} value={lineThreshold} onChange={setLineThreshold}
            display={`${lineThreshold}`} />
        )}
        <Row label="前处理模糊" title="先模糊再量化，减少细节噪点。开启线条保留时建议设为 0"
          min={0} max={6} step={0.5} value={blur} onChange={setBlur}
          display={blur === 0 ? '关' : `${blur}px`} />
        <Row label="清理孤立点" title="消除量化后的零散孤立色块。开启线条保留时建议设为 0~1"
          min={0} max={5} step={1} value={cleanPasses} onChange={setCleanPasses}
          display={cleanPasses === 0 ? '关' : `${cleanPasses}遍`} />
        <Row label="色彩简化" title="K-means 聚合成 N 色（最少 2 色），适合图标和简单插画"
          min={0} max={16} step={1} value={colorCount} onChange={(v) => setColorCount(v === 1 ? 0 : v)}
          display={colorCount === 0 ? '关' : `${colorCount}色`} />
      </div>

      {/* 确认/取消 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => { if (previewGrid) commitImport(previewGrid); }}
          style={{ ...btnStyle, backgroundColor: '#2196f3', color: '#fff', border: 'none', padding: '8px 28px', fontSize: 13 }}
        >确认导入</button>
        <button onClick={cancelImport} style={{ ...btnStyle, padding: '8px 28px', fontSize: 13 }}>取消</button>
      </div>
    </div>
  );
};

// 复用行组件，减少重复 JSX
const Row: React.FC<{
  label: string; title: string;
  min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; display: string;
}> = ({ label, title, min, max, step, value, onChange, display }) => (
  <>
    <span title={title} style={{ cursor: 'help' }}>{label}</span>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%' }} />
    <span style={{ textAlign: 'right', color: '#2196f3', fontWeight: 600, fontSize: 11 }}>{display}</span>
  </>
);

const presetBtnStyle: React.CSSProperties = {
  padding: '4px 10px', fontSize: 12, border: '1px solid #2196f3',
  borderRadius: 14, backgroundColor: '#e3f2fd', color: '#1565c0',
  cursor: 'pointer', whiteSpace: 'nowrap',
};

const btnStyle: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, border: '1px solid #ddd',
  borderRadius: 4, backgroundColor: '#fff', cursor: 'pointer',
};

export default ImageImporter;
