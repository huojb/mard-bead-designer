import React, { useState } from 'react';
import { useEditorStore } from '../store/editor';
import { renderExportCanvas } from '../core/exportPng';

interface ExportDialogProps {
  onClose: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ onClose }) => {
  const grid = useEditorStore((s) => s.grid);
  const [cellSize, setCellSize] = useState(40);
  const [showLabels, setShowLabels] = useState(true);
  const [monochrome, setMonochrome] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const canvas = renderExportCanvas(grid, { cellSize, showLabels, monochrome });
      const dataUrl = canvas.toDataURL('image/png');

      if (window.beadAPI?.isElectron) {
        const result = await window.beadAPI.savePng(
          dataUrl,
          `拼豆图纸_${new Date().toISOString().slice(0, 10)}.png`,
        );
        if (result.ok) {
          alert(`已保存到：${result.filePath}`);
        }
      } else {
        // 浏览器环境：直接下载
        const link = document.createElement('a');
        link.download = `拼豆图纸_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (e) {
      alert('导出失败：' + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 8,
          padding: 24,
          width: 360,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>导出 PNG 图纸</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 格子大小 */}
          <div>
            <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
              每格像素：{cellSize}px（总尺寸 {cellSize * 52}×{cellSize * 52}）
            </label>
            <input
              type="range"
              min={10}
              max={80}
              value={cellSize}
              onChange={(e) => setCellSize(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* 显示色号 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
            显示色号文字
          </label>

          {/* 黑白涂色版 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={monochrome} onChange={(e) => setMonochrome(e.target.checked)} />
            黑白涂色版（不填充颜色，只画网格和色号）
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...btnStyle, backgroundColor: '#f5f5f5' }}>
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{ ...btnStyle, backgroundColor: '#2196f3', color: '#fff', border: 'none' }}
          >
            {exporting ? '导出中...' : '导出 PNG'}
          </button>
        </div>
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 13,
  border: '1px solid #ddd',
  borderRadius: 4,
  cursor: 'pointer',
};

export default ExportDialog;
