/**
 * Small "Live" indicator with a static status dot. Signals that a screen
 * auto-updates. Uses the v5 design tokens so it fits every page.
 */
export function LiveBadge({ label = 'Live' }: { label?: string }) {
  return (
    <span
      title="This screen refreshes automatically"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', letterSpacing: 'normal',
        fontWeight: 500, color: 'var(--status-success-text, var(--status-success))',
        padding: '2px 8px', borderRadius: 'var(--radius-chip)',
        background: 'var(--status-success-bg, var(--bg-surface))',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--status-success)' }} />
      {label}
    </span>
  );
}
