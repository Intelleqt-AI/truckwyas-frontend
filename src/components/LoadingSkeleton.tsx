import React from 'react';

interface Props {
  rows?: number;
  cols?: number;
  height?: number;
}

export default function LoadingSkeleton({ rows = 5, cols = 3, height = 20 }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12 }}>
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="skeleton-pulse"
              style={{
                flex: 1,
                height,
                borderRadius: 4,
                background: 'var(--bg-surface-hover)',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
