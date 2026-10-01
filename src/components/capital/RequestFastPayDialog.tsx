import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { FinDialog } from '@/components/finance/FinDialog';
import '@/components/finance/finance-ledger.css';
import {
  capitalErrorCode, errorOffer, serverMessage, useCapitalStatus, useOffer, useRequestFastPay,
} from '@/lib/capital/api';
import type { AdvanceRow, Offer } from '@/lib/capital/types';
import { AdvanceChip, DecisionChip, OfferBreakdown, ReasonList, SkelCard, dayTime, money } from './capitalUi';

const PROVIDER = 'an independent finance provider';

const confirmLabel = (o: Offer) => {
  switch (o.decision) {
    case 'FUND': return `Request ${money(o.net_payout)}`;
    case 'PART_FUND': return `Request ${money(o.net_payout)} now`;
    case 'QUEUE': return 'Join the queue';
    case 'REFER': return 'Send for review';
    default: return 'Not eligible';
  }
};

/** What happens next, in the words the decision and the server status allow. */
function nextSteps(adv: AdvanceRow, offer: Offer | undefined, mode: 'A' | 'B' | undefined, provider: string): string {
  if (adv.status === 'QUEUED') {
    return `Your request is waiting for room on the line${adv.queue_position ? ` (position ${adv.queue_position})` : ''}. When there is room it is sent to ${provider} for approval. If it is not funded within 5 business days it is cancelled.`;
  }
  if (adv.status === 'REQUESTED' || adv.status === 'SCORING') {
    const part = offer?.decision === 'PART_FUND' && adv.topup_pending > 0
      ? ` The remaining ${money(adv.topup_pending)} is queued and advanced when the line has room.` : '';
    const review = offer?.decision === 'REFER' ? ' It needs a manual review first, so it can take longer.' : '';
    return mode === 'B'
      ? `Your request is being checked against ${provider}'s policy.${review} Once approved, ${money(adv.net_amount)} is paid to your bank account.${part}`
      : `Sent to ${provider} for approval.${review} Once approved, ${money(adv.net_amount)} is paid to your bank account.${part}`;
  }
  if (adv.status === 'APPROVED') return `Approved by ${provider}. ${money(adv.net_amount)} is being paid to your bank account.`;
  return adv.status_label;
}

/**
 * Request Fast Pay for one invoice. Opens on the persisted offer
 * (GET …/offer/, valid 48 h), confirms exactly those figures, then shows what
 * happens next. Used on the Fast Pay page and on the invoice page.
 */
export function RequestFastPayDialog({ invoiceId, invoiceNumber, onClose }: {
  invoiceId: number;
  invoiceNumber?: string;
  onClose: () => void;
}) {
  const status = useCapitalStatus();
  const offerQ = useOffer(invoiceId);
  const request = useRequestFastPay();
  const [result, setResult] = useState<{ advance: AdvanceRow; offer?: Offer; existing: boolean } | null>(null);
  const [error, setError] = useState<{ text: string; offer?: Offer } | null>(null);

  const offer = offerQ.data;
  const provider = status.data?.provider_label || PROVIDER;
  const demo = !!(offer?.demo || status.data?.demo);
  const blocked = status.data ? !status.data.can_request : false;
  const busy = request.isPending;
  const number = offer?.invoice_number || invoiceNumber;

  const submit = async () => {
    if (!offer) return;
    setError(null);
    try {
      const res = await request.mutateAsync({ invoice_id: offer.invoice_id, offer_id: offer.offer_id });
      setResult({ advance: res.advance, offer: res.offer, existing: !!offer.advance });
    } catch (e) {
      const code = capitalErrorCode(e);
      setError({ text: serverMessage(e, 'The request could not be sent. Try again.'), offer: code === 'not_fundable' ? errorOffer(e) : undefined });
    }
  };

  if (result) {
    const adv = result.advance;
    return (
      <FinDialog title={result.existing ? 'Already requested' : 'Request sent'} onClose={onClose}>
        <div className="cap-success">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="fin-id">{adv.reference}</span>
            <AdvanceChip status={adv.status} label={adv.status_label} />
          </div>
          {adv.status !== 'QUEUED' && <p className="cap-success__figure">{money(adv.net_amount)}</p>}
          <p className="fin-note">{nextSteps(adv, result.offer, status.data?.mode, provider)}</p>
        </div>
        <div className="fin-dialog__foot">
          <Link to={`/capital/advances/${adv.id}`} className="tw-btn" onClick={onClose}>View request</Link>
          <button type="button" className="tw-btn tw-btn--primary" onClick={onClose} data-autofocus>Done</button>
        </div>
      </FinDialog>
    );
  }

  const declined = offer && (offer.decision === 'DECLINE' || !offer.eligible);
  const canConfirm = !!offer && !declined && !demo && !blocked && !offer.advance && !busy;

  return (
    <FinDialog
      title="Request Fast Pay"
      description={number ? <>Invoice <span className="fin-id">{number}</span>{offer?.customer_name ? `, ${offer.customer_name}` : ''}</> : undefined}
      onClose={onClose}
      busy={busy}
    >
      {offerQ.isLoading ? (
        <SkelCard height={320} label="Loading the offer" />
      ) : !offer ? (
        <div className="fl-notice fl-notice--danger cap-notice" role="alert">
          <Info size={16} aria-hidden="true" />
          <div>
            <strong>Couldn’t load the offer</strong>
            {serverMessage(offerQ.error, 'Check your connection, then try again.')}
          </div>
          <button type="button" className="tw-btn fl-notice__action" onClick={() => offerQ.refetch()} disabled={offerQ.isFetching}>Retry</button>
        </div>
      ) : (
        <div className="fin-form">
          {offer.advance && (
            <div className="fl-notice cap-notice" role="status">
              <Info size={16} aria-hidden="true" />
              <div>
                <strong>Already requested</strong>
                This invoice has a Fast Pay request: {offer.advance.status_label}.
              </div>
              <Link to={`/capital/advances/${offer.advance.id}`} className="tw-btn fl-notice__action" onClick={onClose}>View</Link>
            </div>
          )}
          {demo && (
            <div className="fl-notice fl-notice--warning cap-notice" role="status">
              <Info size={16} aria-hidden="true" />
              <div>
                <strong>Demo company</strong>
                These figures are an example. No money moves in the demo, so requests are turned off.
              </div>
            </div>
          )}
          {!demo && blocked && !offer.advance && (
            <div className="fl-notice cap-notice" role="status">
              <Info size={16} aria-hidden="true" />
              <div>
                <strong>Finish your application first</strong>
                {provider.charAt(0).toUpperCase() + provider.slice(1)} needs your approved Fast Pay application before you can request.
              </div>
              <Link to="/capital" className="tw-btn fl-notice__action" onClick={onClose}>Open Fast Pay</Link>
            </div>
          )}

          <div style={{ display: 'grid', gap: 8 }}>
            <div><DecisionChip decision={offer.decision} size="md" /></div>
            {offer.explanation && <p className="fin-note">{offer.explanation}</p>}
          </div>

          {!declined && <OfferBreakdown offer={offer} />}
          {offer.reasons?.length > 0 && <ReasonList reasons={offer.reasons} />}

          {error && (
            <div role="alert" style={{ display: 'grid', gap: 8 }}>
              <p className="fin-help fin-text-danger" style={{ margin: 0 }}>{error.text}</p>
              {error.offer?.reasons?.length ? <ReasonList reasons={error.offer.reasons} /> : null}
            </div>
          )}

          <p className="fin-help" style={{ margin: 0 }}>
            Fast Pay is provided by {provider}, who approves each advance. TruckWys is not a lender.
            {offer.valid_until ? ` These figures hold until ${dayTime(offer.valid_until)}.` : ''}
          </p>

          <div className="fin-dialog__foot">
            <button type="button" className="tw-btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button
              type="button"
              className="tw-btn tw-btn--primary"
              onClick={submit}
              disabled={!canConfirm}
              title={demo ? 'No money moves in the demo' : undefined}
            >
              {busy ? 'Sending…' : confirmLabel(offer)}
            </button>
          </div>
        </div>
      )}
    </FinDialog>
  );
}

export default RequestFastPayDialog;
