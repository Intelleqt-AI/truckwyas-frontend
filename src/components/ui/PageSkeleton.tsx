/**
 * PageSkeleton Component
 * Pulsing skeleton loader using CSS variables
 */

export function PageSkeleton() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header skeleton */}
      <div
        style={{
          height: 32,
          background: 'var(--bg-surface)',
          borderRadius: 4,
          width: '40%',
          animation: 'skeleton-pulse 1.5s ease-in-out infinite',
        }}
      />

      {/* Card skeletons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                height: 16,
                background: 'var(--input-bg)',
                borderRadius: 4,
                width: '60%',
                animation: 'skeleton-pulse 1.5s ease-in-out infinite',
              }}
            />
            <div
              style={{
                height: 32,
                background: 'var(--input-bg)',
                borderRadius: 4,
                width: '40%',
                animation: 'skeleton-pulse 1.5s ease-in-out infinite',
                animationDelay: '0.2s',
              }}
            />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--card-radius)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              height: 48,
              background: 'var(--input-bg)',
              borderRadius: 4,
              animation: 'skeleton-pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Add keyframe animation to global styles if not already present
if (typeof document !== 'undefined') {
  const styleId = 'skeleton-pulse-keyframes';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes skeleton-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
  }
}
