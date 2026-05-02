import React, { useState, useCallback } from 'react';
import { useEditorStore } from './store/editor';
import Toolbar from './components/Toolbar';
import BeadCanvas from './components/BeadCanvas';
import ColorPalette from './components/ColorPalette';
import ColorUsageList from './components/ColorUsageList';
import ImageImporter from './components/ImageImporter';
import ExportDialog from './components/ExportDialog';

const App: React.FC = () => {
  const isImporting = useEditorStore((s) => s.isImporting);
  const startImport = useEditorStore((s) => s.startImport);
  const [showExport, setShowExport] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // 只响应含有文件的拖拽
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // 只有离开整个窗口时才取消高亮
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = Array.from(e.dataTransfer.files).find((f) =>
        f.type.startsWith('image/'),
      );
      if (!file) return;
      const img = new Image();
      img.onload = () => startImport(img);
      img.src = URL.createObjectURL(file);
    },
    [startImport],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        // 拖拽悬停时整体加蓝色边框提示
        outline: isDragOver ? '3px solid #2196f3' : 'none',
        outlineOffset: '-3px',
      }}
    >
      {/* 拖拽遮罩提示 */}
      {isDragOver && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(33,150,243,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '2px dashed #2196f3',
              borderRadius: 12,
              padding: '32px 48px',
              fontSize: 20,
              fontWeight: 600,
              color: '#2196f3',
            }}
          >
            松手导入图片
          </div>
        </div>
      )}
      {/* 顶部工具栏 */}
      <Toolbar onExport={() => setShowExport(true)} />

      {/* 主体区域 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左侧：画布 */}
        <div
          data-scroll
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f0f0f0',
            padding: 16,
            overflow: 'auto',
          }}
        >
          {isImporting ? <ImageImporter /> : <BeadCanvas />}
        </div>

        {/* 右侧：色板 + 用量 */}
        <div
          style={{
            width: 280,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            borderLeft: '1px solid #e0e0e0',
            overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            <ColorPalette />
          </div>
          <div
            style={{
              height: 200,
              borderTop: '1px solid #e0e0e0',
              overflow: 'auto',
              padding: 12,
            }}
          >
            <ColorUsageList />
          </div>
        </div>
      </div>

      {/* 导出对话框 */}
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
    </div>
  );
};

export default App;
