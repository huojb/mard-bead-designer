import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useEditorStore, GRID_SIZE } from '../store/editor';
import { resampleToGrid, fitScaleToGrid } from '../core/resample';
import { quantizeRGBA, posterizeRGBA, cleanIsolatedPixels, centerGridOnCanvas, suggestKmeansK } from '../core/quantize';
import { detectSolidBackground, removeSolidBackground } from '../core/solidBgRemove';
import { MARD221 } from '../data/mard221';

const MAX_LONG_SIDE = 52;

// 尺寸预设
const SIZE_PRESETS = [
  { label: '极小', value: 12 },
  { label: '小型', value: 18 },
  { label: '标准', value: 24 },
  { label: '中型', value: 32 },
  { label: '大型', value: 48 },
];

// 图像预设方案
type Preset = {
  label: string; blur: number; contrast: number; brightness: number; saturate: number;
  cleanPasses: number; colorCount: number; preserveLines: boolean; lineThreshold: number;
  cropSubject: boolean; preShrink: boolean; preShrinkSize: number;
  hardEdges: boolean; removeBg: boolean;
};
const PRESETS: Preset[] = [
  { label: '标志图案', blur: 0,   contrast: 1.8, brightness: 1.0, saturate: 1.6, cleanPasses: 1, colorCount: 3, preserveLines: false, lineThreshold: 120, cropSubject: true,  preShrink: true,  preShrinkSize: 36, hardEdges: true,  removeBg: false },
  { label: '普通照片', blur: 1,   contrast: 1.2, brightness: 1.0, saturate: 1.2, cleanPasses: 2, colorCount: 0, preserveLines: false, lineThreshold: 120, cropSubject: false, preShrink: false, preShrinkSize: 52, hardEdges: false, removeBg: true },
  { label: '线稿插画', blur: 0,   contrast: 1.4, brightness: 0.95, saturate: 1.5, cleanPasses: 0, colorCount: 0, preserveLines: true,  lineThreshold: 140, cropSubject: true,  preShrink: true,  preShrinkSize: 44, hardEdges: false, removeBg: true },
  { label: '卡通彩图', blur: 0.5, contrast: 1.5, brightness: 1.0, saturate: 2.0, cleanPasses: 1, colorCount: 0, preserveLines: true,  lineThreshold: 100, cropSubject: true,  preShrink: true,  preShrinkSize: 44, hardEdges: false, removeBg: true },
  { label: '简单图标', blur: 0,   contrast: 2.0, brightness: 1.0, saturate: 1.5, cleanPasses: 2, colorCount: 8, preserveLines: false, lineThreshold: 120, cropSubject: true,  preShrink: true,  preShrinkSize: 32, hardEdges: true, removeBg: true },
];

const ImageImporter: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // 基础图像处理参数
  const [removeBg, setRemoveBg] = useState(false);
  const [blur, setBlur] = useState(0);
  const [contrast, setContrast] = useState(1.8);
  const [brightness, setBrightness] = useState(1);
  const [saturate, setSaturate] = useState(1.6);
  const [cleanPasses, setCleanPasses] = useState(1);
  const [colorCount, setColorCount] = useState(3);
  const [cropSubject, setCropSubject] = useState(true);
  const [preShrink, setPreShrink] = useState(true);
  const [preShrinkSize, setPreShrinkSize] = useState(36);
  const [hardEdges, setHardEdges] = useState(true);
  const [preserveLines, setPreserveLines] = useState(false);
  const [lineThreshold, setLineThreshold] = useState(120);
  const [previewGrid, setPreviewGrid] = useState<Uint8Array | null>(null);

  // 目标尺寸参数
  const [sizeMode, setSizeMode] = useState<'auto' | 'manual'>('auto');
  const [targetLongSide, setTargetLongSide] = useState(24);
  const [manualWidth, setManualWidth] = useState(24);
  const [manualHeight, setManualHeight] = useState(24);
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);
  const [interpolation, setInterpolation] = useState<'bilinear' | 'nearest'>('bilinear');

  const importImage = useEditorStore((s) => s.importImage);
  const importScale = useEditorStore((s) => s.importScale);
  const importOffsetX = useEditorStore((s) => s.importOffsetX);
  const importOffsetY = useEditorStore((s) => s.importOffsetY);
  const setImportTransform = useEditorStore((s) => s.setImportTransform);
  const setImportConfig = useEditorStore((s) => s.setImportConfig);
  const commitImport = useEditorStore((s) => s.commitImport);
  const cancelImport = useEditorStore((s) => s.cancelImport);

  // 计算有效宽高
  const { effectiveW, effectiveH } = useMemo(() => {
    if (!importImage) return { effectiveW: 24, effectiveH: 24 };
    const imgW = importImage.naturalWidth;
    const imgH = importImage.naturalHeight;
    if (sizeMode === 'auto' && keepAspectRatio) {
      const aspect = imgW / imgH;
      if (aspect >= 1) {
        return { effectiveW: targetLongSide, effectiveH: Math.max(1, Math.round(targetLongSide / aspect)) };
      } else {
        return { effectiveW: Math.max(1, Math.round(targetLongSide * aspect)), effectiveH: targetLongSide };
      }
    } else if (sizeMode === 'auto') {
      return { effectiveW: targetLongSide, effectiveH: targetLongSide };
    } else {
      return { effectiveW: manualWidth, effectiveH: manualHeight };
    }
  }, [importImage, sizeMode, targetLongSide, manualWidth, manualHeight, keepAspectRatio]);

  // 预览单元格大小（自适应，让预览保持在合理尺寸）
  const previewCell = useMemo(() =>
    Math.max(8, Math.min(18, Math.floor(480 / Math.max(effectiveW, effectiveH)))),
    [effectiveW, effectiveH]
  );
  const previewW = effectiveW * previewCell;
  const previewH = effectiveH * previewCell;

  const applyPreset = (p: Preset) => {
    setBlur(p.blur);
    setContrast(p.contrast);
    setBrightness(p.brightness);
    setSaturate(p.saturate);
    setCleanPasses(p.cleanPasses);
    setColorCount(p.colorCount);
    setCropSubject(p.cropSubject);
    setPreShrink(p.preShrink);
    setPreShrinkSize(p.preShrinkSize);
    setHardEdges(p.hardEdges);
    setPreserveLines(p.preserveLines);
    setLineThreshold(p.lineThreshold);
    setRemoveBg(p.removeBg);
  };

  const updatePreview = useCallback(() => {
    if (!importImage) return;
    const imageData = resampleToGrid(importImage, {
      targetWidth: effectiveW,
      targetHeight: effectiveH,
      scale: importScale,
      offsetX: importOffsetX,
      offsetY: importOffsetY,
      blur,
      contrast,
      brightness,
      saturate,
      cropSubject,
      preShrink,
      preShrinkSize,
      hardEdges,
      preserveLines,
      lineThreshold,
      interpolation,
    });

    let data: Uint8ClampedArray = imageData.data as unknown as Uint8ClampedArray;

    if (removeBg) {
      const bg = detectSolidBackground(data, effectiveW, effectiveH);
      if (bg) data = removeSolidBackground(data, effectiveW, effectiveH, bg);
    }

    const k = colorCount >= 2 ? colorCount : 0;
    if (k > 0) data = posterizeRGBA(data, k);

    let grid = quantizeRGBA(data);
    if (cleanPasses > 0) grid = cleanIsolatedPixels(grid, effectiveW, effectiveH, cleanPasses);

    setPreviewGrid(grid);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, previewW, previewH);

    for (let i = 0; i < grid.length; i++) {
      const col = i % effectiveW;
      const row = Math.floor(i / effectiveW);
      const x = col * previewCell;
      const y = row * previewCell;
      const colorIdx = grid[i];
      if (colorIdx === 0) {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(x, y, previewCell, previewCell);
      } else {
        const color = MARD221[colorIdx];
        ctx.fillStyle = `rgb(${color.rgb[0]},${color.rgb[1]},${color.rgb[2]})`;
        ctx.fillRect(x, y, previewCell, previewCell);
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= effectiveW; i++) {
      const pos = i * previewCell;
      ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, previewH); ctx.stroke();
    }
    for (let i = 0; i <= effectiveH; i++) {
      const pos = i * previewCell;
      ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(previewW, pos); ctx.stroke();
    }

    // 10格辅助线
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i <= effectiveW; i += 10) {
      const pos = i * previewCell;
      ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, previewH); ctx.stroke();
    }
    for (let i = 0; i <= effectiveH; i += 10) {
      const pos = i * previewCell;
      ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(previewW, pos); ctx.stroke();
    }
  }, [importImage, effectiveW, effectiveH, previewCell, previewW, previewH,
      importScale, importOffsetX, importOffsetY,
      removeBg, blur, contrast, brightness, saturate, cleanPasses, colorCount,
      cropSubject, preShrink, preShrinkSize, hardEdges, preserveLines, lineThreshold,
      interpolation]);

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
    setImportTransform(importScale, importOffsetX + dx / previewCell, importOffsetY + dy / previewCell);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, importScale, importOffsetX, importOffsetY, setImportTransform, previewCell]);

  const handleMouseUp = useCallback(() => { setIsDragging(false); setDragStart(null); }, []);

  const handleFit = () => {
    if (!importImage) return;
    setImportTransform(fitScaleToGrid(importImage.naturalWidth, importImage.naturalHeight, effectiveW, effectiveH), 0, 0);
  };

  const handleFill = () => {
    if (!importImage) return;
    setImportTransform(1, 0, 0);
  };

  // 提交时自动居中到 52×52 画布
  const handleCommit = () => {
    if (!previewGrid) return;
    const centered = centerGridOnCanvas(previewGrid, effectiveW, effectiveH, GRID_SIZE);
    // 记住用户配置
    setImportConfig({
      sizeMode,
      targetLongSide,
      manualWidth,
      manualHeight,
      keepAspectRatio,
      interpolation,
    });
    commitImport(centered);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingBottom: 16, maxWidth: 700 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>调整图片 · 实时预览</div>

      {/* 预设快选 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p)} style={presetBtnStyle}>
            {p.label}
          </button>
        ))}
      </div>

      {/* === 目标尺寸控制 === */}
      <div style={{
        background: '#f0f8ff', borderRadius: 8, padding: '8px 14px',
        width: '100%', boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1565c0', marginBottom: 6 }}>
          输出网格尺寸
        </div>

        {/* 尺寸模式切换 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <label style={modeBtnStyle(sizeMode === 'auto')}>
            <input type="radio" name="sizeMode" checked={sizeMode === 'auto'}
              onChange={() => setSizeMode('auto')} style={{ marginRight: 4 }} />
            自动（设长边）
          </label>
          <label style={modeBtnStyle(sizeMode === 'manual')}>
            <input type="radio" name="sizeMode" checked={sizeMode === 'manual'}
              onChange={() => setSizeMode('manual')} style={{ marginRight: 4 }} />
            手动指定
          </label>
        </div>

        {sizeMode === 'auto' ? (
          <>
            {/* 长边滑条 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#555', whiteSpace: 'nowrap' }}>长边 bead 数</span>
              <input type="range" min={4} max={MAX_LONG_SIDE} step={1}
                value={targetLongSide} onChange={(e) => setTargetLongSide(Number(e.target.value))}
                style={{ flex: 1 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1565c0', minWidth: 28, textAlign: 'right' }}>
                {targetLongSide}
              </span>
            </div>
            {/* 尺寸快捷按钮 */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
              {SIZE_PRESETS.map((sp) => (
                <button key={sp.label}
                  onClick={() => setTargetLongSide(sp.value)}
                  style={{
                    ...chipStyle,
                    background: targetLongSide === sp.value ? '#1565c0' : '#e3f2fd',
                    color: targetLongSide === sp.value ? '#fff' : '#1565c0',
                  }}
                >{sp.label} ({sp.value})</button>
              ))}
            </div>
            {/* 保持比例 */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={keepAspectRatio}
                onChange={(e) => setKeepAspectRatio(e.target.checked)} />
              保持原图比例
            </label>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              有效尺寸：{effectiveW} × {effectiveH} bead
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#555' }}>宽</span>
              <input type="number" min={1} max={MAX_LONG_SIDE} value={manualWidth}
                onChange={(e) => setManualWidth(Math.max(1, Math.min(MAX_LONG_SIDE, Number(e.target.value) || 1)))}
                style={numInputStyle} />
            </div>
            <span style={{ fontSize: 14, color: '#999' }}>×</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#555' }}>高</span>
              <input type="number" min={1} max={MAX_LONG_SIDE} value={manualHeight}
                onChange={(e) => setManualHeight(Math.max(1, Math.min(MAX_LONG_SIDE, Number(e.target.value) || 1)))}
                style={numInputStyle} />
            </div>
            <span style={{ fontSize: 11, color: '#888' }}>bead</span>
          </div>
        )}

        {/* 插值方式 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 12, color: '#555' }}>插值方式</span>
          <label style={{ fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            <input type="radio" name="interp" checked={interpolation === 'bilinear'}
              onChange={() => setInterpolation('bilinear')} />
            平滑
          </label>
          <label style={{ fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            <input type="radio" name="interp" checked={interpolation === 'nearest'}
              onChange={() => setInterpolation('nearest')} />
            硬边缘
          </label>
        </div>
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
        <canvas ref={canvasRef} width={previewW} height={previewH}
          style={{ display: 'block', width: previewW, height: previewH }} />
      </div>

      {/* 定位控制 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={handleFit} style={btnStyle}>留白适配</button>
        <button onClick={handleFill} style={btnStyle}>填满网格</button>
        <button onClick={() => setImportTransform(fitScaleToGrid(importImage?.naturalWidth || 1, importImage?.naturalHeight || 1, effectiveW, effectiveH), 0, 0)} style={btnStyle}>重置位置</button>
        <span style={{ fontSize: 11, color: '#999' }}>{(importScale * 100).toFixed(0)}%</span>
      </div>

      {/* 图像处理参数 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '80px 1fr 44px',
        alignItems: 'center', gap: '5px 8px', fontSize: 12, color: '#555',
        background: '#f8f8f8', borderRadius: 8, padding: '10px 14px',
        width: '100%', boxSizing: 'border-box',
      }}>
        <Row label="对比度" title="增强对比度让线条更清晰"
          min={0.5} max={4} step={0.1} value={contrast} onChange={setContrast}
          display={contrast === 1 ? '默认' : `${contrast.toFixed(1)}x`} />
        <Row label="亮度" title="调暗可以让线条更深"
          min={0.5} max={1.5} step={0.05} value={brightness} onChange={setBrightness}
          display={brightness === 1 ? '默认' : `${brightness.toFixed(2)}x`} />
        <Row label="饱和度" title="增强饱和度让颜色更鲜明"
          min={0} max={5} step={0.1} value={saturate} onChange={setSaturate}
          display={saturate === 1 ? '默认' : `${saturate.toFixed(1)}x`} />
        {preserveLines && (
          <Row label="线条阈值" title="像素亮度低于此值才视为线条"
            min={50} max={200} step={5} value={lineThreshold} onChange={setLineThreshold}
            display={`${lineThreshold}`} />
        )}
        <Row label="前处理模糊" title="先模糊再量化，减少噪点"
          min={0} max={6} step={0.5} value={blur} onChange={setBlur}
          display={blur === 0 ? '关' : `${blur}px`} />
        <Row label="清理孤立点" title="消除量化后的零散色块"
          min={0} max={5} step={1} value={cleanPasses} onChange={setCleanPasses}
          display={cleanPasses === 0 ? '关' : `${cleanPasses}遍`} />
        <Row label="色彩简化" title="K-means 聚合成 N 色"
          min={0} max={16} step={1} value={colorCount} onChange={(v) => setColorCount(v === 1 ? 0 : v)}
          display={colorCount === 0 ? '关' : `${colorCount}色`} />
        {preShrink && (
          <Row label="预缩小" title="先把主体最长边缩到这个像素数"
            min={16} max={64} step={2} value={preShrinkSize} onChange={setPreShrinkSize}
            display={`${preShrinkSize}px`} />
        )}
      </div>

      {/* 其他选项 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <label style={chipStyle2(removeBg)}>
          <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)}
            style={{ marginRight: 4 }} />
          去背景
        </label>
        <label style={chipStyle2(cropSubject)}>
          <input type="checkbox" checked={cropSubject} onChange={(e) => setCropSubject(e.target.checked)}
            style={{ marginRight: 4 }} />
          主体裁剪
        </label>
        <label style={chipStyle2(preShrink)}>
          <input type="checkbox" checked={preShrink} onChange={(e) => setPreShrink(e.target.checked)}
            style={{ marginRight: 4 }} />
          预缩小
        </label>
        <label style={chipStyle2(hardEdges)}>
          <input type="checkbox" checked={hardEdges} onChange={(e) => setHardEdges(e.target.checked)}
            style={{ marginRight: 4 }} />
          硬边
        </label>
        <label style={chipStyle2(preserveLines)}>
          <input type="checkbox" checked={preserveLines} onChange={(e) => setPreserveLines(e.target.checked)}
            style={{ marginRight: 4 }} />
          线条保留
        </label>
      </div>

      {/* 确认/取消 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={handleCommit}
          style={{ ...btnStyle, backgroundColor: '#2196f3', color: '#fff', border: 'none', padding: '8px 28px', fontSize: 13 }}>
          确认导入
        </button>
        <button onClick={cancelImport} style={{ ...btnStyle, padding: '8px 28px', fontSize: 13 }}>取消</button>
      </div>

      <div style={{ fontSize: 11, color: '#999' }}>
        导入后将自动居中放置到 52×52 画布上
      </div>
    </div>
  );
};

// 表单行组件
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

// 样式
const presetBtnStyle: React.CSSProperties = {
  padding: '4px 10px', fontSize: 12, border: '1px solid #2196f3',
  borderRadius: 14, backgroundColor: '#e3f2fd', color: '#1565c0',
  cursor: 'pointer', whiteSpace: 'nowrap',
};

const modeBtnStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', fontSize: 12,
  cursor: 'pointer', padding: '3px 10px', borderRadius: 12,
  background: active ? '#e3f2fd' : '#f5f5f5',
  border: `1px solid ${active ? '#1e88e5' : '#ddd'}`,
  color: active ? '#1565c0' : '#666',
  fontWeight: active ? 600 : 400,
});

const chipStyle: React.CSSProperties = {
  padding: '3px 8px', fontSize: 11, border: 'none',
  borderRadius: 10, cursor: 'pointer',
};

const chipStyle2 = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', fontSize: 12,
  cursor: 'pointer', padding: '3px 10px', borderRadius: 12,
  background: active ? '#e3f2fd' : '#f5f5f5',
  border: `1px solid ${active ? '#1e88e5' : '#ddd'}`,
  color: active ? '#1565c0' : '#666',
  fontWeight: active ? 600 : 400,
});

const numInputStyle: React.CSSProperties = {
  width: 50, padding: '4px 6px', fontSize: 13, textAlign: 'center',
  border: '1px solid #ccc', borderRadius: 4,
};

const btnStyle: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, border: '1px solid #ddd',
  borderRadius: 4, backgroundColor: '#fff', cursor: 'pointer',
};

export default ImageImporter;
