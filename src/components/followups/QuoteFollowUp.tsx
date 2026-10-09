import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchData, postData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import SendPreviewDialog from '@/components/SendPreviewDialog';
import {
  NOTE_MAX, adjustmentRow, apiMessage, cleanNote, draftClauseLine, expiresLine, lastReminderLine, promptExample, sentLine, showFollowUp,
  type FollowUpState, type ReminderPreview,
} from '@/lib/followups';
import { useFollowUp, useFuelAdjustment, useQuoteAutomation } from './useFollowUps';
import './followups.css';

/** §2 Draft quote: the clause the PDF will carry, one muted line. */
export function DraftClauseLine({ quoteId, className = 'fu-clause' }: { quoteId: string | number | null | undefined; className?: string }) {
  const q = useFuelAdjustment('quotes', quoteId);
  const line = q.data?.clause ? draftClauseLine(q.data.reference, q.data.clause) : null;
  return line ? <p className={className}>{line}</p> : null;
}

/** §2 "Fuel price adjustment" row on a sent quote or a load. */
export function FuelAdjustmentRow({ kind, id, onOpenInvoice }: {
  kind: 'quotes' | 'loads'; id: string | number | null | undefined; onOpenInvoice?: (invoiceId: number) => void;
}) {
  const q = useFuelAdjustment(kind, id);
  const row = adjustmentRow(q.data);
  if (!row) return null;
  return (
    <div className="fu-adj" aria-label="Fuel price adjustment">
      <div className="fu-adj__head">
        <span className="fu-adj__title">{row.title}</span>
        {row.amount && <span className="fu-adj__amount">{row.amount}</span>}
      </div>
      {row.sub && (
        <p className="fu-adj__sub">
          {row.invoiceId != null && onOpenInvoice
            ? <button type="button" className="fu-link" onClick={() => onOpenInvoice(row.invoiceId!)}>{row.sub}</button>
            : row.sub}
        </p>
      )}
    </div>
  );
}

/** §4 Follow-up card on a SENT quote, with the two-step reminder. */
export function FollowUpCard({ quoteId, status, customerName, focus = false }: {
  quoteId: string | number; status: string; customerName?: string | null; focus?: boolean;
}) {
  const enabled = showFollowUp(status);
  const q = useFollowUp(quoteId, enabled);
  const ref = useRef<HTMLElement>(null);
  const done = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!focus || !q.data || done.current) return;
    // After the page's own layout settles (rail, map), once.
    const t = setTimeout(() => {
      if (!ref.current) return;
      done.current = true;
      ref.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
      ref.current.focus({ preventScroll: true });
    }, 400);
    return () => clearTimeout(t);
  }, [focus, q.data]);

  if (!enabled || !q.data) return null;
  const s = q.data;
  const lines = [sentLine(s), expiresLine(s), lastReminderLine(s)].filter(Boolean) as string[];
  const can = s.reminder?.can_send;
  return (
    <section ref={ref} tabIndex={-1} className="bk-card" aria-labelledby="fu-card-title" style={{ outline: 'none' }}>
      <h2 className="bk-card__title" id="fu-card-title" style={{ marginBottom: 8 }}>Follow up</h2>
      <ul className="fu-lines">{lines.map(l => <li key={l}>{l}</li>)}</ul>
      <div style={{ marginTop: 12 }}>
        <button type="button" className="bk-btn bk-btn--secondary bk-btn--block" disabled={!can} onClick={() => setOpen(true)}
          aria-describedby={!can && s.reminder?.reason_text ? 'fu-reminder-why' : undefined}>
          Send reminder
        </button>
        {!can && s.reminder?.reason_text && <p className="bk-help" id="fu-reminder-why" style={{ margin: '6px 0 0' }}>{s.reminder.reason_text}</p>}
      </div>
      {open && <ReminderDialog quoteId={quoteId} customerName={customerName} onClose={() => setOpen(false)} />}
    </section>
  );
}

function ReminderDialog({ quoteId, customerName, onClose }: { quoteId: string | number; customerName?: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const debounced = useDebouncedValue(note, 400);
  const [preview, setPreview] = useState<ReminderPreview | null>(null);
  // The note the shown preview was built from: Send always sends what was previewed.
  const [previewNote, setPreviewNote] = useState('');
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let live = true;
    const n = cleanNote(debounced);
    fetchData(`/api/v1/quotes/${quoteId}/follow-up/reminder/${n ? `?note=${encodeURIComponent(n)}` : ''}`)
      .then((d: ReminderPreview) => { if (live) { setPreview(d); setPreviewNote(n); setFailed(false); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [quoteId, debounced]);

  const to = preview ? (preview.preview?.to || null) : (failed ? null : undefined);
  const stale = cleanNote(note) !== previewNote;
  const send = async () => {
    if (sending || stale) return;
    setSending(true);
    try {
      const res = await postData({ url: `/api/v1/quotes/${quoteId}/follow-up/reminder/`, data: { confirm: true, note: previewNote } });
      const { success: _ok, sent_to, ...state } = res as FollowUpState & { success: boolean; sent_to: string };
      qc.setQueryData(['quote-follow-up', String(quoteId)], state);
      // The GET adds reason_text (why it can't be sent again yet).
      qc.invalidateQueries({ queryKey: ['quote-follow-up', String(quoteId)] });
      toast.success(`Reminder sent to ${sent_to}`);
      onClose();
    } catch (e) {
      toast.error(apiMessage(e, 'The reminder could not be sent. Please try again.'));
      qc.invalidateQueries({ queryKey: ['quote-follow-up', String(quoteId)] });
    }
    setSending(false);
  };

  const blocked = !!preview && !preview.can_send;
  return (
    <SendPreviewDialog
      title="Send reminder"
      to={to}
      toName={customerName || undefined}
      toError={failed && !preview}
      subject={preview?.preview?.subject}
      rows={[
        {
          label: 'Note',
          value: (
            <>
              <textarea className="fu-note" aria-label="Add a note (optional)" placeholder="Add a note (optional)" maxLength={NOTE_MAX}
                value={note} onChange={e => setNote(e.target.value)} disabled={sending} />
              <span className="fu-note__count">{note.length}/{NOTE_MAX}</span>
            </>
          ),
        },
        { label: 'Message', value: preview?.preview?.text ? <div className="fu-preview-text">{preview.preview.text}</div> : <span className="send-preview__muted">Loading…</span> },
      ]}
      note={blocked ? preview?.reason_text : preview?.preview?.reply_to ? `Replies go to ${preview.preview.reply_to}.` : undefined}
      confirmLabel={stale ? 'Updating preview…' : to ? `Send to ${to}` : 'Send'}
      confirmBlocked={blocked}
      sending={sending}
      confirmDisabled={stale}
      onConfirm={send}
      onCancel={onClose}
    />
  );
}

/** Quote builder: the clause the PDF will carry. A saved draft asks the
 *  server (its own basis); a new quote shows the company's clause. */
export function QuoteClauseNote({ quoteId }: { quoteId: number | null }) {
  const auto = useQuoteAutomation(quoteId == null);
  if (quoteId != null) return <DraftClauseLine quoteId={quoteId} className="fu-clause fu-clause--builder" />;
  if (!auto.data?.fuel_surcharge_enabled) return null;
  return <p className="fu-clause fu-clause--builder">{promptExample(auto.data.fuel_surcharge_threshold_pct)}</p>;
}
