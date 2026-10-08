import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import './send-preview-dialog.css';

export interface SendPreviewRow {
  label: string;
  value: ReactNode;
}

interface SendPreviewDialogProps {
  /** e.g. "Send reminder", "Send invoice", "Send quote". */
  title: string;
  /** Recipient email. `undefined` while it loads, `null` when none is on file. */
  to: string | null | undefined;
  /** Who the recipient is, e.g. the customer name. */
  toName?: string;
  /** Recipient lookup failed. */
  toError?: boolean;
  /** Subject line exactly as the server sends it, when known. */
  subject?: string;
  /** What the message says, as short label/value rows. */
  rows: SendPreviewRow[];
  /** One short line under the summary (e.g. what the email links to). */
  note?: ReactNode;
  confirmLabel: string;
  /** Allow sending without an email on file (e.g. a quote is still marked sent). */
  noEmailConfirmLabel?: string;
  /** Shown instead of the Send button's action when nothing can be sent. */
  noEmailHint?: ReactNode;
  sending?: boolean;
  /** A better next step than sending (e.g. "Edit quote" on an expired quote).
   *  When set, it is the primary button and the send button steps down to
   *  secondary; the send handler itself is unchanged. */
  preferredAction?: { label: string; onClick: () => void };
  /** Sending is not allowed (a block warning); the confirm button is off. */
  confirmBlocked?: boolean;
  /** The confirm button shows but can't be pressed yet (e.g. the preview is updating). */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Preview-and-confirm for every message that leaves TruckWys (invoice,
 * reminder, quote). Shows who gets it, the subject and what it says, and
 * sends only on an explicit second click. Nothing is sent from this component
 * itself: `onConfirm` runs the caller's existing API call unchanged.
 */
export default function SendPreviewDialog({
  title, to, toName, toError, subject, rows, note, confirmLabel, noEmailConfirmLabel, noEmailHint,
  sending = false, preferredAction, confirmBlocked = false, confirmDisabled = false, onConfirm, onCancel,
}: SendPreviewDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, sending]);

  const loadingTo = to === undefined && !toError;
  const noEmail = to === null;
  const blocked = confirmBlocked || confirmDisabled || loadingTo || (noEmail && !noEmailConfirmLabel);
  const label = sending ? 'Sending…' : noEmail && noEmailConfirmLabel ? noEmailConfirmLabel : confirmLabel;

  return createPortal(
    <div className="send-preview__backdrop" onMouseDown={() => { if (!sending) onCancel(); }}>
      <div
        ref={ref}
        className="send-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="send-preview__title" tabIndex={-1} data-autofocus>{title}</h2>

        <dl className="send-preview__meta">
          <div className="send-preview__row">
            <dt>To</dt>
            <dd>
              {loadingTo ? (
                <span className="send-preview__muted">Looking up email…</span>
              ) : toError ? (
                <span className="send-preview__muted">{toName ? `${toName}, ` : ''}email on file (couldn’t check it here)</span>
              ) : noEmail ? (
                <span className="send-preview__warn">{toName ? `${toName} has` : 'This customer has'} no email on file</span>
              ) : (
                <>
                  {toName && <span className="send-preview__name">{toName}</span>}
                  <span className="send-preview__email">{to}</span>
                </>
              )}
            </dd>
          </div>
          {subject && (
            <div className="send-preview__row">
              <dt>Subject</dt>
              <dd>{subject}</dd>
            </div>
          )}
        </dl>

        {rows.length > 0 && (
          <dl className="send-preview__summary" aria-label="Message summary">
            {rows.map((r) => (
              <div className="send-preview__row" key={r.label}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {noEmail && noEmailHint && <p className="send-preview__note">{noEmailHint}</p>}
        {note && <p className="send-preview__note">{note}</p>}

        <div className="send-preview__actions">
          <button type="button" className="tw-btn" onClick={onCancel} disabled={sending}>Cancel</button>
          {/* Blocked: no disabled Send to stare at; the reason is above. */}
          {!confirmBlocked && <button
            type="button"
            className={preferredAction ? 'tw-btn' : 'tw-btn tw-btn--primary'}
            onClick={onConfirm}
            disabled={blocked || sending}
          >
            {label}
          </button>}
          {preferredAction && (
            <button type="button" className="tw-btn tw-btn--primary" onClick={preferredAction.onClick} disabled={sending}>
              {preferredAction.label}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
