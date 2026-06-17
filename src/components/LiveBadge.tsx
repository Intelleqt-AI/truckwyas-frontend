/**
 * Small "Live" indicator with a pulsing dot — signals that a screen
 * auto-updates. Uses the v5 design tokens so it fits every page.
 */
export function LiveBadge({ label = 'Live' }: { label?: string }) {
  return (
    <span
      title="This screen refreshes automatically"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--status-success)',
        padding: '3px 8px', borderRadius: 999,
        background: 'var(--status-success-bg, var(--bg-surface))',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex', width: 6, height: 6 }}>
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'var(--status-success)', animation: 'lb-ping 1.6s cubic-bezier(0,0,0.2,1) infinite',
        }} />
        <span style={{ position: 'relative', display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--status-success)' }} />
      </span>
      {label}
      <style>{`@keyframes lb-ping { 75%,100% { transform: scale(2.2); opacity: 0 } }`}</style>
    </span>
  );
}
