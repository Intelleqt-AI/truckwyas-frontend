// Reusable loading indicator — the brand mark (public/logo.svg), inlined so
// its color follows `currentColor` (adapts to the current theme via the
// `color` prop) instead of the fixed black fill baked into the SVG file.
interface LoaderProps {
  /** Width/height in px. */
  size?: number;
  /** CSS color (or var) the mark spins in. */
  color?: string;
  /** Optional caption under the mark. */
  label?: string;
  /** Center within the available space (min-height: 60vh) instead of sizing to content. */
  fullScreen?: boolean;
  className?: string;
}

export function Loader({ size = 40, color = 'var(--accent-primary)', label, fullScreen = false, className }: LoaderProps) {
  const spinner = (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <svg
        viewBox="0 0 713.5 713.5"
        width={size}
        height={size}
        style={{ color, animation: 'tw-loader-spin 0.9s linear infinite' }}
        role="img"
        aria-label={label || 'Loading'}
      >
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M289,273.2 218.5,139.8 257.5,39.8 495,38.2 453,136.2 337.5,137.8ZM251,371.2 96,367.2 26.5,282.8 144,84.2 208.5,158.8 149.5,260.8ZM606,330.2 598.5,326.8 543,233.2 391.5,263.8 481,132.2 585,113.2 705.5,316.8ZM566,634.2 503.5,556.8 562.5,455.8 458,347.2 617,350.2 688.5,435.8ZM129,604.2 121.5,598.8 8,400.2 109,385.2 166,482.2 316.5,451.8 228,583.2ZM453,675.2 215.5,673.8 256,579.2 372.5,578.8 418,441.2 492.5,575.8Z"
        />
      </svg>
      {label && (
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{label}</div>
      )}
    </div>
  );

  if (!fullScreen) return spinner;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', width: '100%' }}>
      {spinner}
    </div>
  );
}
