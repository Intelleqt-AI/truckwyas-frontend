import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { LOSS_REASONS, type LossReason, type LossReasonCode } from '@/lib/pricing';
import './loss-reason-dialog.css';

/**
 * Marking a quote lost or declined: one calm step with an optional reason.
 * Nothing is required: "Mark declined" works with no reason picked.
 */
export default function LossReasonDialog({
  quoteNumber, title = 'Mark quote as declined', confirmLabel = 'Mark declined', busy = false, onConfirm, onCancel,
}: {
  quoteNumber?: string;
  title?: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: (reason: LossReason) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const noteId = useId();
  const [code, setCode] = useState<LossReasonCode | null>(null);
  const [note, setNote] = useState('');
  useFocusTrap(ref, true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  return createPortal(
    <div className="bk-dialog-backdrop" onMouseDown={() => { if (!busy) onCancel(); }}>
      <div
        ref={ref}
        className="bk-dialog lr-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="bk-dialog__title" id={titleId} tabIndex={-1} data-autofocus>{title}</h2>
        <p className="bk-dialog__body" id={descId}>
          {quoteNumber ? `${quoteNumber}. ` : ''}Why did it not go ahead? Optional, and it sharpens future price suggestions.
        </p>
        <div className="lr-reasons" role="group" aria-label="Reason (optional)">
          {LOSS_REASONS.map((r) => (
            <button
              key={r.code}
              type="button"
              aria-pressed={code === r.code}
              className="lr-reason"
              // A second tap clears it: the reason stays optional.
              onClick={() => setCode(code === r.code ? null : r.code)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <label className="lr-note-label" htmlFor={noteId}>Note (optional)</label>
        <input
          id={noteId}
          className="qi-input lr-note"
          type="text"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !busy) onConfirm({ code, note }); }}
        />
        <div className="bk-dialog__footer">
          <button type="button" className="bk-btn bk-btn--secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="bk-btn bk-btn--primary" onClick={() => onConfirm({ code, note })} disabled={busy}>
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
