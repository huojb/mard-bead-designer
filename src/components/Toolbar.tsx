import React, { useRef } from 'react';
import { useEditorStore } from '../store/editor';
import type { Tool } from '../store/editor';
import { MARD221 } from '../data/mard221';

interface ToolbarProps {
  onExport: () => void;
}

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'brush', label: '画笔', icon: '✏️' },
  { id: 'eraser', label: '橡皮', icon: '🧼' },
  { id: 'bucket', label: '油漆桶', icon: '🪣' },
  { id: 'eyedropper', label: '吸管', icon: '💧' },
  { id: 'magicWand', label: '魔棒', icon: '✨' },
  { id: 'rectSelect', label: '框选', icon: '▭' },
];

const Toolbar: React.FC<ToolbarProps> = ({ onExport }) => {
  const tool = useEditorStore((s) => s.tool);
  const brushSize = useEditorStore((s) => s.brushSize);
  const currentColorIdx = useEditorStore((s) => s.currentColorIdx);
  const setTool = useEditorStore((s) => s.setTool);
  const setBrushSize = useEditorStore((s) => s.setBrushSize);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo());
  const canRedo = useEditorStore((s) => s.canRedo());
  const clearGrid = useEditorStore((s) => s.clearGrid);
  const startImport = useEditorStore((s) => s.startImport);
  const isImporting = useEditorStore((s) => s.isImporting);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      startImport(img);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = ''; // 允许重复选择同一文件
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e0e0e0',
        flexWrap: 'wrap',
      }}
    >
      {/* 工具按钮 */}
      <div style={{ display: 'flex', gap: 4 }}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={t.label}
            style={{
              ...toolBtnStyle,
              backgroundColor: tool === t.id ? '#e3f2fd' : '#f5f5f5',
              borderColor: tool === t.id ? '#2196f3' : '#ddd',
            }}
          >
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span style={{ fontSize: 11 }}>{t.label}</span>
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 28, backgroundColor: '#e0e0e0' }} />

      {/* 画笔大小 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#666' }}>画笔</span>
        {([1, 3, 5] as const).map((size) => {
          const dotSize = size === 1 ? 5 : size === 3 ? 9 : 13;
          const isActive = brushSize === size;
          return (
            <button
              key={size}
              onClick={() => setBrushSize(size)}
              title={`${size}×${size}`}
              style={{
                width: 32,
                height: 32,
                border: `1px solid ${isActive ? '#2196f3' : '#ddd'}`,
                borderRadius: 6,
                backgroundColor: isActive ? '#e3f2fd' : '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <div
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: '50%',
                  backgroundColor: isActive ? '#2196f3' : '#555',
                }}
              />
            </button>
          );
        })}
      </div>

      <div style={{ width: 1, height: 28, backgroundColor: '#e0e0e0' }} />

      {/* 撤销/重做 */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={undo} disabled={!canUndo} style={{ ...iconBtnStyle, opacity: canUndo ? 1 : 0.4 }}>
          ↩️ 撤销
        </button>
        <button onClick={redo} disabled={!canRedo} style={{ ...iconBtnStyle, opacity: canRedo ? 1 : 0.4 }}>
          ↪️ 重做
        </button>
      </div>

      <div style={{ width: 1, height: 28, backgroundColor: '#e0e0e0' }} />

      {/* 导入/导出/清空 */}
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImport}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          style={iconBtnStyle}
        >
          📁 导入图片
        </button>
        <button onClick={onExport} style={iconBtnStyle}>
          💾 导出 PNG
        </button>
        <button
          onClick={() => {
            if (confirm('确定清空画布吗？')) clearGrid();
          }}
          style={{ ...iconBtnStyle, color: '#d32f2f' }}
        >
          🗑️ 清空
        </button>
      </div>

      {/* 当前颜色指示 */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#666' }}>当前色号</span>
        {currentColorIdx > 0 && currentColorIdx < MARD221.length ? (
          <>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                border: '1px solid #ddd',
                backgroundColor: `rgb(${MARD221[currentColorIdx].rgb.join(',')})`,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {MARD221[currentColorIdx].id} {MARD221[currentColorIdx].name}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 13, color: '#999' }}>未选色</span>
        )}
      </div>
    </div>
  );
};

const toolBtnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  padding: '4px 8px',
  border: '1px solid #ddd',
  borderRadius: 6,
  cursor: 'pointer',
  minWidth: 48,
};

const iconBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 12,
  border: '1px solid #ddd',
  borderRadius: 4,
  backgroundColor: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

export default Toolbar;
