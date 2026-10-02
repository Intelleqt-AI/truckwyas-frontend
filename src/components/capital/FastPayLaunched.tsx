import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Info } from 'lucide-react';
import SectionHeader from '@/components/layout/SectionHeader';
import { KpiRow, KpiTile } from '@/components/ui/KpiTile';
import { InfoTip } from '@/components/ui/InfoTip';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import '@/components/data/load-error.css';
import '@/components/finance/finance-ledger.css';
import '@/pages/finance-brand.css';
import '@/pages/table-heading-roles.css';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { rowLink } from '@/lib/rowLink';
import { toast } from '@/lib/toast';
import {
  serverMessage, useAdvances, useApplication, useCancelAdvance, useCapitalStatus, useFastPayInvoices,
} from '@/lib/capital/api';
import type { AdvanceRow, Offer } from '@/lib/capital/types';
import { ApplicationCard } from './ApplicationCard';
import { RequestFastPayDialog } from './RequestFastPayDialog';
import {
  AdvanceChip, DecisionChip, LIVE_STATUSES, ReasonList, SkelCard, TileMoney, day, money, wholeMoney,
} from './capitalUi';

const PROVIDER = 'an independent finance provider';

/**
 * The launched transporter page: the line, the application, invoices with
 * their offers, live requests, history, and what is not eligible and why.
 * Every figure comes from capital/status, capital/fast-pay/invoices and
 * capital/fast-pay/advances.
 */
export default function FastPayLaunched() {
  const navigate = useNavigate();
  const status = useCapitalStatus();
  const app = useApplication();
  const invoices = useFastPayInvoices();
  const advances = useAdvances();
  const cancel = useCancelAdvance();
  const [params, setParams] = useSearchParams();
  const [requestFor, setRequestFor] = useState<{ id: number; number: string } | null>(() => {
    const id = Number(params.get('request'));
    return Number.isInteger(id) && id > 0 ? { id, number: '' } : null;
  });
  const closeRequest = () => {
    setRequestFor(null);
    if (params.has('request')) { const p = new URLSearchParams(params); p.delete('request'); setParams(p, { replace: true }); }
  };

  useEffect(() => { document.title = 'Fast Pay - TruckWys'; }, []);
  useAutoRefresh(() => { status.refetch(); invoices.refetch(); advances.refetch(); });

  const provider = status.data?.provider_label || PROVIDER;
  const demo = !!status.data?.demo;
  const line = status.data?.line ?? null;
  const application = app.data ?? status.data?.application;
  const offers = invoices.data?.offers ?? [];
  const ineligible = invoices.data?.ineligible ?? [];
  const totals = invoices.data?.totals;
  const rows = advances.data ?? [];
  const live = rows.filter((a) => LIVE_STATUSES.includes(a.status));
  const history = rows.filter((a) => !LIVE_STATUSES.includes(a.status));

  const header = (
    <SectionHeader
      title="Fast Pay"
      description="Get paid early on eligible invoices"
      titleAdornment={demo ? <span className="cap-head-chip"><span className="tw-chip">Demo</span></span> : undefined}
    />
  );

  const statusCode = (status.error as { status?: number } | null)?.status;
  if (loadFailed(status) && loadFailed(invoices) && (statusCode === 404 || statusCode === 403)) {
    // The Fast Pay service is not on for this account (or not deployed yet).
    return (
      <div className="fin-page">
        {header}
        <div className="fl-notice" role="status">
          <Info size={16} aria-hidden="true" />
          <div>
            <strong>Fast Pay isn’t available on this account yet</strong>
            Your invoices are unaffected. This page shows offers once Fast Pay is switched on for you.
          </div>
        </div>
      </div>
    );
  }
  if (loadFailed(status) && loadFailed(invoices)) {
    return (
      <div className="fin-page">
        {header}
        <LoadError what="Fast Pay" error={status.error ?? status.failureReason} busy={status.isFetching} onRetry={() => { status.refetch(); invoices.refetch(); advances.refetch(); }} />
      </div>
    );
  }

  const onCancel = async (a: AdvanceRow) => {
    try {
      await cancel.mutateAsync(a.id);
      toast.success(`${a.reference} cancelled`);
    } catch (e) {
      toast.error(serverMessage(e, 'The request could not be cancelled. Try again.'));
    }
  };

  const showApplicationFirst = application && application.status !== 'APPROVED';

  return (
    <div className="fin-page">
      {header}
      {requestFor && (
        <RequestFastPayDialog invoiceId={requestFor.id} invoiceNumber={requestFor.number || undefined} onClose={closeRequest} />
      )}

      <div className="fin-stack fin-stack--16">
        {demo && (
          <div className="fl-notice fl-notice--warning" role="status">
            <Info size={16} aria-hidden="true" />
            <div>
              <strong>Demo company</strong>
              Offers are shown as an example. No money moves in the demo, so requests are turned off.
            </div>
          </div>
        )}

        {/* The line: what is available now. Tiles only when a line exists. */}
        {status.isLoading ? (
          <SkelCard height={106} label="Loading your Fast Pay line" />
        ) : line ? (
          <KpiRow>
            <KpiTile label="Available now" figure={<TileMoney v={line.available} />} note={`of ${wholeMoney(line.limit)}`} emphasis />
            <KpiTile label="In use" figure={<TileMoney v={line.used} />} note={`${live.length} open`} />
            {totals && (
              <KpiTile
                label="Ready for Fast Pay"
                figure={<TileMoney v={totals.net_total} />}
                note={`${totals.eligible_count} ${totals.eligible_count === 1 ? 'invoice' : 'invoices'}, after fees`}
              />
            )}
          </KpiRow>
        ) : null}

        {showApplicationFirst && <ApplicationCard app={application!} provider={provider} demo={demo} />}

        <OffersCard
          loading={invoices.isLoading}
          failed={loadFailed(invoices)}
          query={invoices}
          offers={offers}
          demo={demo}
          canRequest={!!status.data?.can_request}
          onRequest={(o) => setRequestFor({ id: o.invoice_id, number: o.invoice_number })}
          onOpenAdvance={(id) => navigate(`/capital/advances/${id}`)}
        />

        {(advances.isLoading || live.length > 0 || loadFailed(advances)) && (
          <section className="card fin-table-card" aria-labelledby="fp-live-title">
            <div className="fin-panel-head">
              <div className="fin-panel-head__text">
                <h2 id="fp-live-title" className="fin-panel-title">Open requests</h2>
                <p className="fin-panel-desc">Newest first</p>
              </div>
            </div>
            {advances.isLoading ? (
              <div style={{ padding: '0 var(--card-pad, 20px) var(--card-pad, 20px)' }}><SkelCard height={132} /></div>
            ) : loadFailed(advances) ? (
              <div style={{ padding: '0 var(--card-pad, 20px) var(--card-pad, 20px)' }}>
                <LoadError compact what="your requests" error={advances.error ?? advances.failureReason} busy={advances.isFetching} onRetry={() => advances.refetch()} />
              </div>
            ) : (
              <AdvanceTable rows={live} onOpen={(id) => navigate(`/capital/advances/${id}`)} onCancel={onCancel} cancelling={cancel.isPending ? cancel.variables : undefined} />
            )}
          </section>
        )}

        {ineligible.length > 0 && (
          <section className="card fin-table-card" aria-labelledby="fp-inel-title">
            <div className="fin-panel-head">
              <div className="fin-panel-head__text">
                <h2 id="fp-inel-title" className="fin-panel-title">Not eligible yet</h2>
                <p className="fin-panel-desc">What holds each invoice back</p>
              </div>
            </div>
            <div className="fin-table-scroll">
              <table className="fin-table fin-table--stack table-heading-roles">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th className="num m-hide">Balance</th>
                    <th style={{ width: '60%' }}>Why, and how to fix it</th>
                  </tr>
                </thead>
                <tbody>
                  {ineligible.map((o) => (
                    <tr key={o.invoice_id}>
                      <td className="fin-strong m-party fin-cell-2">
                        <div className="fin-truncate" title={o.customer_name}>{o.customer_name || '—'}</div>
                        <span className="fin-cell-sub"><Link to={`/finance/invoices/${o.invoice_id}`} className="fin-link fin-id">{o.invoice_number}</Link></span>
                      </td>
                      <td className="num m-hide">{money(o.invoice_balance)}</td>
                      <td className="m-due" style={{ paddingTop: 10, paddingBottom: 10 }}>
                        {o.reasons?.length ? <ReasonList reasons={o.reasons} compact /> : <span className="fin-note">{o.explanation || '—'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {history.length > 0 && (
          <section className="card fin-table-card" aria-labelledby="fp-hist-title">
            <div className="fin-panel-head">
              <div className="fin-panel-head__text">
                <h2 id="fp-hist-title" className="fin-panel-title">History</h2>
                <p className="fin-panel-desc">Repaid, cancelled and declined requests</p>
              </div>
            </div>
            <AdvanceTable rows={history} onOpen={(id) => navigate(`/capital/advances/${id}`)} />
          </section>
        )}

        {application && !showApplicationFirst && <ApplicationCard app={application} provider={provider} demo={demo} />}

        <p className="fin-help" style={{ margin: 0 }}>
          Fast Pay is provided by {provider}, who approves each advance. TruckWys is not a lender.
        </p>
      </div>
    </div>
  );
}

function OffersCard({ loading, failed, query, offers, demo, canRequest, onRequest, onOpenAdvance }: {
  loading: boolean;
  failed: boolean;
  query: ReturnType<typeof useFastPayInvoices>;
  offers: Offer[];
  demo: boolean;
  canRequest: boolean;
  onRequest: (o: Offer) => void;
  onOpenAdvance: (id: number) => void;
}) {
  return (
    <section className="card fin-table-card" aria-labelledby="fp-offers-title">
      <div className="fin-panel-head">
        <div className="fin-panel-head__text">
          <h2 id="fp-offers-title" className="fin-panel-title fin-panel-title--tip">
            Invoices you can get paid on
            <InfoTip align="end">
              Each offer shows what is paid to you now, the fee, and the holdback paid when your customer pays.
              The finance provider approves every request. Figures are confirmed when you request.
            </InfoTip>
          </h2>
          <p className="fin-panel-desc">Unpaid invoices with proof of delivery</p>
        </div>
      </div>
      {loading ? (
        <div style={{ padding: '0 var(--card-pad, 20px) var(--card-pad, 20px)' }}><SkelCard height={220} label="Loading offers" /></div>
      ) : failed ? (
        <div style={{ padding: '0 var(--card-pad, 20px) var(--card-pad, 20px)' }}>
          <LoadError compact what="offers" error={query.error ?? query.failureReason} busy={query.isFetching} onRetry={() => query.refetch()} />
        </div>
      ) : offers.length === 0 ? (
        <div className="fin-empty fin-empty--compact">No invoices are ready for Fast Pay. Delivered loads with proof of delivery show here once invoiced.</div>
      ) : (
        <div className="fin-table-scroll">
          <table className="fin-table fin-table--stack cap-stack-table table-heading-roles">
            <thead>
              <tr>
                <th className="fin-cell-fill">Invoice</th>
                <th className="num m-hide">Advance now</th>
                <th className="num m-hide">Fee</th>
                <th className="num">You receive</th>
                <th className="num m-hide">Holdback</th>
                <th className="m-hide">Customer pays</th>
                <th>Decision</th>
                <th className="cap-actions"><span className="fin-sr">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => {
                return (
                  <tr key={o.invoice_id}>
                    <td className="fin-strong m-party m-span2 fin-cell-2 fin-cell-fill">
                      <div className="fin-truncate fin-truncate--fill" title={o.customer_name}>{o.customer_name || '—'}</div>
                      <span className="fin-cell-sub">
                        <Link to={`/finance/invoices/${o.invoice_id}`} className="fin-link fin-id">{o.invoice_number}</Link>
                        <span className="fin-mobile-only"> · pays {day(o.expected_payment_date)}</span>
                      </span>
                    </td>
                    <td className="num m-hide">{money(o.fundable_amount)}</td>
                    <td className="num m-hide">
                      {money(o.fee_amount)}
                      {o.fee_vat_amount > 0 && <span className="fin-cell-sub">+ {money(o.fee_vat_amount)} VAT</span>}
                    </td>
                    <td className="num m-amount fin-strong">{money(o.net_payout)}</td>
                    <td className="num m-hide">{money(o.holdback_amount)}</td>
                    <td className="fin-date m-hide">{day(o.expected_payment_date)}</td>
                    <td className="m-status">
                      {o.advance ? <AdvanceChip status={o.advance.status} label={o.advance.status_label} /> : <DecisionChip decision={o.decision} />}
                    </td>
                    <td className="cap-actions actions">
                      {o.advance ? (
                        <button type="button" className="tw-btn cap-row-btn" onClick={() => onOpenAdvance(o.advance!.id)}>View</button>
                      ) : (
                        <button
                          type="button"
                          className="tw-btn cap-row-btn"
                          onClick={() => onRequest(o)}
                          disabled={o.decision === 'DECLINE'}
                          aria-label={`Request Fast Pay on ${o.invoice_number}`}
                          title={demo ? 'No money moves in the demo' : !canRequest ? 'Finish your application first' : undefined}
                        >
                          {o.decision === 'DECLINE' ? 'Not eligible' : 'Request'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AdvanceTable({ rows, onOpen, onCancel, cancelling }: {
  rows: AdvanceRow[];
  onOpen: (id: number) => void;
  onCancel?: (a: AdvanceRow) => void;
  cancelling?: number;
}) {
  return (
    <div className="fin-table-scroll">
      <table className="fin-table fin-table--stack table-heading-roles">
        <thead>
          <tr>
            <th className="fin-cell-fill">Invoice</th>
            <th className="m-hide">Reference</th>
            <th className="m-hide">Requested</th>
            <th className="num">To you</th>
            <th>Status</th>
            {onCancel && <th className="cap-actions"><span className="fin-sr">Action</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="is-clickable" {...rowLink(() => onOpen(a.id))} onClick={() => onOpen(a.id)}>
              <td className="fin-strong m-party m-span2 fin-cell-2 fin-cell-fill">
                <div className="fin-truncate fin-truncate--fill" title={a.customer_name}>{a.customer_name || '—'}</div>
                <span className="fin-cell-sub">
                  <span className="fin-id">{a.invoice_number}</span>
                  <span className="fin-mobile-only"> · {a.reference}</span>
                </span>
              </td>
              <td className="m-hide"><span className="fin-id">{a.reference}</span></td>
              <td className="fin-date m-hide">{day(a.requested_at ?? a.queued_at)}</td>
              <td className="num m-amount">{money(a.net_amount)}</td>
              <td className="m-status">
                <AdvanceChip status={a.status} label={a.status_label} />
                {a.queue_position != null && a.status === 'QUEUED' && <span className="cap-sub">Position {a.queue_position}</span>}
              </td>
              {onCancel && (
                <td className="cap-actions actions" onClick={(e) => e.stopPropagation()}>
                  {a.can_cancel && (
                    <button type="button" className="tw-btn cap-row-btn" onClick={() => onCancel(a)} disabled={cancelling === a.id}>
                      {cancelling === a.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
