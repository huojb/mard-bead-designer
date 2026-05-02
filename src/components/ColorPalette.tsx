import React, { useState } from 'react';
import { useEditorStore } from '../store/editor';
import { MARD221, rgbToCss } from '../data/mard221';

const ColorPalette: React.FC = () => {
  const currentColorIdx = useEditorStore((s) => s.currentColorIdx);
  const setCurrentColorIdx = useEditorStore((s) => s.setCurrentColorIdx);
  const [search, setSearch] = useState('');

  const filtered = MARD221.slice(1).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>色板 (221色)</div>
      <input
        type="text"
        placeholder="搜索色号或名称..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '6px 8px',
          fontSize: 12,
          border: '1px solid #ddd',
          borderRadius: 4,
          marginBottom: 8,
          boxSizing: 'border-box',
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(28px, 1fr))',
          gap: 3,
        }}
      >
        {filtered.map((color) => {
          const idx = MARD221.indexOf(color);
          const isActive = currentColorIdx === idx;
          return (
            <button
              key={color.id}
              onClick={() => setCurrentColorIdx(idx)}
              title={`${color.id} ${color.name}`}
              style={{
                width: '100%',
                aspectRatio: '1',
                border: isActive ? '2px solid #2196f3' : '1px solid #e0e0e0',
                borderRadius: 4,
                backgroundColor: rgbToCss(color.rgb),
                cursor: 'pointer',
                padding: 0,
                boxShadow: isActive ? '0 0 0 1px #fff inset' : 'none',
              }}
            />
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#999' }}>
        已显示 {filtered.length} / 221 色
      </div>
    </div>
  );
};

export default ColorPalette;
