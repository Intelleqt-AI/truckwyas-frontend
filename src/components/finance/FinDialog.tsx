import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import '@/pages/finance-brand.css';
import './finance-ledger.css';

/**
 * The finance dialog shell (the Expenses modal's look): backdrop, 16px
 * radius surface, title row with a close button, Escape to close, focus
 * kept inside. `busy` blocks closing while a request is in flight.
 */
export function FinDialog({ title, description, onClose, busy, wide, children }: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(ref, true);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, busy]);
  return (
    <div className="fin-dialog-backdrop fin-page" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={ref} className={`fin-dialog${wide ? ' fl-dialog--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined}>
        <div className="fin-dialog__head" style={description ? { marginBottom: 4 } : undefined}>
          <h2 id={titleId} className="fin-dialog__title">{title}</h2>
          <button type="button" className="fin-dialog__close" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {description && <p id={descId} className="fin-help" style={{ margin: '0 0 20px' }}>{description}</p>}
        {children}
      </div>
    </div>
  );
}

/**
 * Ask for a reason, then run an action (void an invoice, void a credit note).
 * The reason is required; the API's error is shown in place.
 */
export function ReasonDialog({ title, description, label = 'Reason', placeholder, confirmLabel, danger, onSubmit, onClose }: {
  title: string;
  description?: ReactNode;
  label?: string;
  placeholder?: string;
  confirmLabel: string;
  danger?: boolean;
  onSubmit: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = useId();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setBusy(true); setError('');
    try { await onSubmit(reason.trim()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong. Try again.'); setBusy(false); }
  };
  return (
    <FinDialog title={title} description={description} onClose={onClose} busy={busy}>
      <form className="fin-form" onSubmit={submit}>
        <div>
          <label className="fin-label" htmlFor={id}>{label}</label>
          <textarea id={id} className="fin-control" rows={3} value={reason} placeholder={placeholder} required data-autofocus
            onChange={e => setReason(e.target.value)} />
        </div>
        {error && <p className="fin-help fin-text-danger" role="alert" style={{ margin: 0 }}>{error}</p>}
        <div className="fin-dialog__foot">
          <button type="button" className="tw-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="tw-btn tw-btn--primary" disabled={busy || !reason.trim()}
            style={danger && !busy && reason.trim() ? { background: 'var(--confirm-danger-surface)', borderColor: 'var(--confirm-danger-text)', color: 'var(--confirm-danger-text)' } : undefined}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </FinDialog>
  );
}

export default FinDialog;
