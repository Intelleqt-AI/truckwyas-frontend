import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCapitalStatus, useFastPayInvoices } from '@/lib/capital/api';
import { RequestFastPayDialog } from './RequestFastPayDialog';
import { AdvanceChip, DecisionChip, ReasonList, day, money } from './capitalUi';

/**
 * Invoice page rail: this invoice's Fast Pay offer or live request. Reads the
 * list preview (nothing is persisted by viewing an invoice); the request
 * dialog loads the persisted offer. Renders nothing when the invoice is not
 * in Fast Pay at all (paid, draft) or the data is unavailable.
 */
export function FastPayInvoicePanel({ invoiceId }: { invoiceId: number | string }) {
  const q = useFastPayInvoices();
  const status = useCapitalStatus();
  const [open, setOpen] = useState(false);
  const id = Number(invoiceId);
  const offer = q.data?.offers.find((o) => o.invoice_id === id) ?? q.data?.ineligible.find((o) => o.invoice_id === id);
  if (!offer) return null;
  const demo = !!(offer.demo || status.data?.demo);
  const ineligible = offer.decision === 'DECLINE' || !offer.eligible;

  return (
    <section className="card" aria-labelledby="fastpay-title">
      {open && <RequestFastPayDialog invoiceId={id} invoiceNumber={offer.invoice_number} onClose={() => setOpen(false)} />}
      <div className="fin-panel-head" style={{ marginBottom: 8 }}>
        <div className="fin-panel-head__text">
          <h2 id="fastpay-title" className="fin-panel-title">Fast Pay</h2>
          {demo && <p className="fin-panel-desc">Demo: no money moves</p>}
        </div>
        {offer.advance
          ? <AdvanceChip status={offer.advance.status} label={offer.advance.status_label} />
          : <DecisionChip decision={offer.decision} />}
      </div>

      {offer.advance ? (
        <Link to={`/capital/advances/${offer.advance.id}`} className="tw-btn" style={{ width: '100%' }}>View request</Link>
      ) : ineligible ? (
        <ReasonList reasons={offer.reasons} compact />
      ) : (
        <>
          <dl className="fin-dl">
            <div className="fin-dl__row"><dt>You receive now</dt><dd className="fin-strong">{money(offer.net_payout)}</dd></div>
            <div className="fin-dl__row"><dt>Fee, excl. VAT</dt><dd>{money(offer.fee_amount)}</dd></div>
            <div className="fin-dl__row"><dt>Holdback</dt><dd>{money(offer.holdback_amount)}</dd></div>
            <div className="fin-dl__row"><dt>Customer expected to pay</dt><dd>{day(offer.expected_payment_date)}</dd></div>
          </dl>
          {offer.reasons?.length > 0 && <div style={{ marginTop: 8 }}><ReasonList reasons={offer.reasons} compact /></div>}
          <button type="button" className="tw-btn" style={{ width: '100%', marginTop: 12 }} onClick={() => setOpen(true)}
            title={demo ? 'No money moves in the demo' : undefined}>
            Request Fast Pay
          </button>
        </>
      )}
    </section>
  );
}

export default FastPayInvoicePanel;
