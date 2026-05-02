import React from 'react';
import { useEditorStore } from '../store/editor';
import { MARD221, rgbToCss } from '../data/mard221';

const ColorUsageList: React.FC = () => {
  const grid = useEditorStore((s) => s.grid);

  // 统计用量
  const counts = new Map<number, number>();
  for (let i = 0; i < grid.length; i++) {
    const idx = grid[i];
    if (idx > 0) {
      counts.set(idx, (counts.get(idx) || 0) + 1);
    }
  }

  const sorted = Array.from(counts.entries())
    .map(([idx, count]) => ({ color: MARD221[idx], idx, count }))
    .sort((a, b) => b.count - a.count);

  const totalBeads = Array.from(counts.values()).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        色号用量 {totalBeads > 0 && `(${totalBeads} 颗)`}
      </div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: '20px 0' }}>
          画布为空
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sorted.map(({ color, idx, count }) => (
            <div
              key={color.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 6px',
                borderRadius: 4,
                backgroundColor: '#f8f8f8',
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  border: '1px solid #ddd',
                  backgroundColor: rgbToCss(color.rgb),
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, flex: 1 }}>
                {color.id} {color.name}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#666' }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ColorUsageList;
