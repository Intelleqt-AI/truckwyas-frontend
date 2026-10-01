import './finance-brand.css';
import '@/components/finance/finance-ledger.css';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Ban, FileSearch } from 'lucide-react';
import SectionHeader from '@/components/layout/SectionHeader';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import '@/components/data/load-error.css';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { toast } from '@/lib/toast';
import { serverMessage, useAdvance, useCancelAdvance, useCapitalStatus } from '@/lib/capital/api';
import { AdvanceChip, ReasonList, SkelCard, Timeline, day, money } from '@/components/capital/capitalUi';

const BACK = { to: '/capital', label: 'Fast Pay' };
const PROVIDER = 'an independent finance provider';

/** One Fast Pay request, exactly as the server reports it (capital/fast-pay/advances/{id}/). */
export default function AdvanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const query = useAdvance(id);
  const status = useCapitalStatus();
  const cancel = useCancelAdvance();
  const a = query.data;
  const provider = status.data?.provider_label || PROVIDER;

  useEffect(() => { document.title = `${a?.reference ?? 'Fast Pay request'} - TruckWys`; }, [a?.reference]);
  useAutoRefresh(() => query.refetch());

  const err = (query.error ?? query.failureReason) as { status?: number } | null;
  if (loadFailed(query) && err?.status !== 404) {
    return (
      <div className="fin-page">
        <SectionHeader title="Fast Pay request" back={BACK} />
        <LoadError what="this request" error={err} busy={query.isFetching} onRetry={() => query.refetch()} />
      </div>
    );
  }
  if (query.isLoading) {
    return (
      <div className="fin-page" aria-busy="true" aria-label="Loading request">
        <SectionHeader title="Fast Pay request" back={BACK} />
        <div className="fin-detail-grid">
          <SkelCard height={320} />
          <SkelCard height={200} />
        </div>
      </div>
    );
  }
  if (!a) {
    return (
      <div className="fin-page">
        <SectionHeader title="Request not found" back={BACK} />
        <div className="load-error fin-missing" role="status">
          <FileSearch className="load-error__icon" size={20} aria-hidden="true" />
          <div className="load-error__text">
            <p className="load-error__title">There is no Fast Pay request at this link</p>
            <p className="load-error__hint">The link may be wrong.</p>
          </div>
          <button type="button" className="tw-btn load-error__retry" onClick={() => navigate('/capital')}>Fast Pay</button>
        </div>
      </div>
    );
  }

  const onCancel = async () => {
    try {
      await cancel.mutateAsync(a.id);
      toast.success(`${a.reference} cancelled`);
    } catch (e) {
      toast.error(serverMessage(e, 'The request could not be cancelled. Try again.'));
    }
  };

  const closed = ['DENIED', 'CANCELLED', 'WRITTEN_OFF'].includes(a.status);

  return (
    <div className="fin-page fin-page--invoice">
      <SectionHeader
        title={a.reference}
        titleAdornment={<span className="fin-head-chip"><AdvanceChip status={a.status} label={a.status_label} size="md" /></span>}
        back={BACK}
        description={<>
          <span className="fin-head-chip--sub"><AdvanceChip status={a.status} label={a.status_label} /><span aria-hidden="true" className="section-header__sep" style={{ marginLeft: 6 }}>·</span></span>
          {a.customer_name}
          {' · '}<Link to={`/finance/invoices/${a.invoice_id}`} className="fin-link fin-id">{a.invoice_number}</Link>
        </>}
        menuItems={a.can_cancel ? [{ label: 'Cancel request', onSelect: onCancel, danger: true }] : undefined}
      />

      <div className="fin-detail-grid">
        <div className="fin-main-col fin-stack fin-stack--16">
          {a.status === 'DENIED' && (
            <div className="fl-notice fl-notice--danger" role="status">
              <Ban size={16} aria-hidden="true" />
              <div>
                <strong>Not approved</strong>
                {a.denial_reason || `${provider.charAt(0).toUpperCase() + provider.slice(1)} did not approve this request.`}
              </div>
            </div>
          )}

          <section className="card" aria-labelledby="adv-money-title">
            <div className="fin-panel-head">
              <div className="fin-panel-head__text">
                <h2 id="adv-money-title" className="fin-panel-title">{a.disbursed_at ? 'Paid to you' : closed ? 'Requested' : 'To be paid to you'}</h2>
                <p className="fin-panel-desc">{a.disbursed_at ? `On ${day(a.disbursed_at)}` : closed ? 'Nothing was paid' : 'Once approved'}</p>
              </div>
            </div>
            <p className="fin-hero-amount">{money(a.net_amount)}</p>
            <dl className="fin-dl cap-breakdown" style={{ marginTop: 12 }}>
              <div className="fin-dl__row"><dt>Advance</dt><dd>{money(a.amount)}</dd></div>
              <div className="fin-dl__row"><dt>Fee, excl. VAT</dt><dd>−{money(a.fee_amount)}</dd></div>
              {a.fee_vat_amount > 0 && <div className="fin-dl__row"><dt>VAT on the platform fee</dt><dd>−{money(a.fee_vat_amount)}</dd></div>}
              <div className="fin-dl__row is-total"><dt>To you</dt><dd>{money(a.net_amount)}</dd></div>
              <div className="fin-dl__row"><dt>Holdback<small>Paid to you when your customer pays, less any deductions</small></dt><dd>{money(a.holdback_amount)}</dd></div>
              {a.topup_pending > 0 && <div className="fin-dl__row"><dt>Queued top-up<small>Advanced when the line has room</small></dt><dd>{money(a.topup_pending)}</dd></div>}
            </dl>
          </section>

          {a.reasons?.length > 0 && (
            <section className="card" aria-labelledby="adv-reasons-title">
              <div className="fin-panel-head">
                <div className="fin-panel-head__text"><h2 id="adv-reasons-title" className="fin-panel-title">What the decision rests on</h2></div>
              </div>
              <ReasonList reasons={a.reasons} />
            </section>
          )}

          <section className="card" aria-labelledby="adv-timeline-title">
            <div className="fin-panel-head">
              <div className="fin-panel-head__text"><h2 id="adv-timeline-title" className="fin-panel-title">Progress</h2></div>
            </div>
            <Timeline entries={a.timeline} />
          </section>
        </div>

        <aside className="fin-rail" aria-label="Request details">
          <section className="card" aria-labelledby="adv-facts-title">
            <div className="fin-panel-head" style={{ marginBottom: 4 }}>
              <div className="fin-panel-head__text"><h2 id="adv-facts-title" className="fin-panel-title">Details</h2></div>
            </div>
            <dl className="fin-dl">
              <div className="fin-dl__row"><dt>Status</dt><dd>{a.status_label}</dd></div>
              {a.status === 'QUEUED' && a.queue_position != null && <div className="fin-dl__row"><dt>Queue position</dt><dd>{a.queue_position}</dd></div>}
              {a.queued_at && <div className="fin-dl__row"><dt>Queued</dt><dd>{day(a.queued_at)}</dd></div>}
              <div className="fin-dl__row"><dt>Requested</dt><dd>{day(a.requested_at)}</dd></div>
              {a.approved_at && <div className="fin-dl__row"><dt>Approved</dt><dd>{day(a.approved_at)}</dd></div>}
              {a.disbursed_at && <div className="fin-dl__row"><dt>Paid out</dt><dd>{day(a.disbursed_at)}</dd></div>}
              {a.settled_at && <div className="fin-dl__row"><dt>Repaid</dt><dd>{day(a.settled_at)}</dd></div>}
              <div className="fin-dl__row"><dt>Invoice</dt><dd><Link to={`/finance/invoices/${a.invoice_id}`} className="fin-link">{a.invoice_number}</Link></dd></div>
            </dl>
            {a.can_cancel && (
              <button type="button" className="tw-btn" style={{ width: '100%', marginTop: 12 }} onClick={onCancel} disabled={cancel.isPending}>
                {cancel.isPending ? 'Cancelling…' : 'Cancel request'}
              </button>
            )}
          </section>
          <p className="fin-help" style={{ margin: 0 }}>
            Fast Pay is provided by {provider}, who approves each advance. TruckWys is not a lender.
          </p>
        </aside>
      </div>
    </div>
  );
}
