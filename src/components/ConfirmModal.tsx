import { useEffect } from 'react';
import './confirm-dialog-brand.css';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onCancel}
    >
      <div
        className="dashboard-confirm-dialog"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--confirm-radius, 4px)',
          padding: 'var(--confirm-padding, 28px)',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="dashboard-confirm-title" style={{ fontSize: 'var(--confirm-title-size, 15px)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 var(--confirm-title-gap, 10px)' }}>
          {title}
        </h2>
        <div className="dashboard-confirm-message" style={{ fontSize: 'var(--confirm-body-size, 13px)', color: 'var(--text-secondary)', lineHeight: 'var(--confirm-body-line, 1.6)', marginBottom: 24 }}>
          {message}
        </div>
        <div className="dashboard-confirm-actions" style={{ display: 'flex', gap: 'var(--confirm-actions-gap, 10px)', justifyContent: 'flex-end' }}>
          <button
            className="dashboard-confirm-button"
            onClick={onCancel}
            style={{
              padding: 'var(--confirm-button-padding, 8px 18px)',
              background: 'transparent',
              border: '1px solid var(--confirm-control-border, var(--border-subtle))',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--confirm-button-radius, 2px)',
              fontSize: 'var(--confirm-button-size, 11px)',
              fontFamily: 'var(--confirm-button-font, var(--font-mono))',
              letterSpacing: 'var(--confirm-button-tracking, 0.06em)',
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            className="dashboard-confirm-button dashboard-confirm-primary"
            data-danger={danger || undefined}
            onClick={() => { onConfirm(); onCancel(); }}
            style={{
              padding: 'var(--confirm-button-padding, 8px 18px)',
              background: danger ? 'var(--confirm-danger-surface, var(--status-danger))' : 'var(--accent-primary)',
              border: 'none',
              color: danger ? 'var(--confirm-danger-text, #fff)' : 'var(--confirm-on-accent, #fff)',
              borderRadius: 'var(--confirm-button-radius, 2px)',
              fontSize: 'var(--confirm-button-size, 11px)',
              fontFamily: 'var(--confirm-button-font, var(--font-mono))',
              fontWeight: 'var(--confirm-button-weight, 600)',
              letterSpacing: 'var(--confirm-button-tracking, 0.06em)',
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
