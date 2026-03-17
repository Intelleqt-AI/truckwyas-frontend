/**
 * LoadingSpinner Component
 * Uses CSS variables for theme compatibility
 */

export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: '2px solid var(--border-subtle)',
        borderTopColor: 'var(--accent-primary)',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }}
    />
  );
}

// Add keyframe animation to global styles if not already present
if (typeof document !== 'undefined') {
  const styleId = 'loading-spinner-keyframes';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}
