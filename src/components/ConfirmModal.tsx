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
        background: 'var(--modal-backdrop, rgba(0,0,0,0.6))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onCancel}
    >
      <div
        className="dashboard-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-dialog)',
          padding: 24,
          maxWidth: 440,
          width: '100%',
          boxShadow: 'none',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className="dashboard-confirm-title" style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          {title}
        </h2>
        <div id="confirm-modal-message" className="dashboard-confirm-message" style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: '20px', marginBottom: 24 }}>
          {message}
        </div>
        <div className="dashboard-confirm-actions" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            className="dashboard-confirm-button"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              minHeight: 40,
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-control)',
              fontSize: 14,
              lineHeight: '20px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
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
              padding: '8px 16px',
              minHeight: 40,
              background: danger ? 'var(--confirm-danger-surface)' : 'var(--accent-primary)',
              border: danger ? '1px solid var(--confirm-danger-text)' : '1px solid transparent',
              color: danger ? 'var(--confirm-danger-text)' : 'var(--btn-action-color, #fff)',
              borderRadius: 'var(--radius-control)',
              fontSize: 14,
              lineHeight: '20px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
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
