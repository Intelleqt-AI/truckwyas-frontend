import './finance-brand.css';
import './table-heading-roles.css';
import '@/components/finance/finance-ledger.css';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, FileSearch } from 'lucide-react';
import SectionHeader from '@/components/layout/SectionHeader';
import { StatusChip } from '@/components/ui/StatusChip';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import '@/components/data/load-error.css';
import { ReasonDialog } from '@/components/finance/FinDialog';
import { postData } from '@/lib/Api';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
import { FIN_URL, invalidateInvoiceData, useCreditNote } from '@/lib/finance/api';
import { formatQuantity, sumLines, taxCodeShort, toNumber } from '@/lib/finance/tax';
import { toast } from '@/lib/toast';
import { AccountingSyncCard } from '@/components/accounting/AccountingSyncCard';

const BACK = { to: '/finance/credit-notes', label: 'Credit notes' };
const safeDate = (d?: string | null) => (d ? formatDate(d) : '—');

export default function CreditNoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const query = useCreditNote(id);
  const note = query.data;
  const [voidOpen, setVoidOpen] = useState(false);

  useEffect(() => { if (note) document.title = `${note.credit_note_number} - TruckWys`; }, [note]);

  const err = (query.error ?? query.failureReason) as { status?: number } | null;
  if (loadFailed(query) && err?.status !== 404) {
    return (
      <div className="fin-page">
        <SectionHeader title="Credit note" back={BACK} />
        <LoadError what="this credit note" error={err} busy={query.isFetching} onRetry={() => query.refetch()} />
      </div>
    );
  }
  if (query.isLoading) {
    return (
      <div className="fin-page" aria-busy="true" aria-label="Loading credit note">
        <SectionHeader title="Credit note" back={BACK} />
        <div className="fin-skel fin-skel--card" aria-hidden="true" />
      </div>
    );
  }
  if (!note) {
    return (
      <div className="fin-page">
        <SectionHeader title="Credit note not found" back={BACK} />
        <div className="load-error fin-missing" role="status">
          <FileSearch className="load-error__icon" size={20} aria-hidden="true" />
          <div className="load-error__text">
            <p className="load-error__title">There is no credit note at this link</p>
            <p className="load-error__hint">The link may be wrong.</p>
          </div>
          <button type="button" className="tw-btn load-error__retry" onClick={() => navigate('/finance/credit-notes')}>All credit notes</button>
        </div>
      </div>
    );
  }

  const status = String(note.status).toUpperCase();
  const isVoid = status === 'VOID';
  const lines = note.lines ?? [];
  const byCode = sumLines(lines.map(l => ({ net: l.net_amount, vat: l.vat_amount, tax_code: l.tax_code }))).byCode;

  const handleVoid = async (reason: string) => {
    await postData({ url: FIN_URL.creditNoteVoid(note.id), data: { reason } });
    setVoidOpen(false);
    toast.success('Credit note voided');
    qc.invalidateQueries({ queryKey: ['credit-note', String(note.id)] });
    invalidateInvoiceData(qc, note.invoice);
  };

  return (
    <div className="fin-page fin-page--invoice">
      {voidOpen && (
        <ReasonDialog
          title={`Void ${note.credit_note_number}`}
          description={`The credit comes off invoice ${note.invoice_number}, so its balance goes back up by ${formatCurrency(note.total_amount)}. The credit note stays on record, marked void.`}
          placeholder="e.g. Issued against the wrong invoice"
          confirmLabel="Void credit note"
          danger
          onSubmit={handleVoid}
          onClose={() => setVoidOpen(false)}
        />
      )}

      <SectionHeader
        title={note.credit_note_number}
        titleAdornment={<span className="fin-head-chip"><StatusChip status={status} /></span>}
        back={BACK}
        description={<>
          <span className="fin-head-chip--sub"><StatusChip status={status} size="sm" /><span aria-hidden="true" className="section-header__sep" style={{ marginLeft: 6 }}>·</span></span>
          {note.customer_name}
          {' · '}<Link to={`/finance/invoices/${note.invoice}`} className="fin-link fin-id">{note.invoice_number}</Link>
        </>}
        menuItems={!isVoid ? [{ label: 'Void credit note', onSelect: () => setVoidOpen(true), danger: true }] : undefined}
      />

      <div className="fin-detail-grid">
        <div className="fin-main-col">
          {isVoid && (
            <div className="fl-notice fl-notice--danger" role="status">
              <Ban size={16} aria-hidden="true" />
              <div>
                <strong>Void{note.voided_at ? ` since ${safeDate(note.voided_at)}` : ''}</strong>
                This credit note no longer reduces what {note.customer_name || 'the customer'} owes.
              </div>
            </div>
          )}
          <section className="card fin-table-card fin-doc" aria-labelledby="cn-doc-title">
            <h2 id="cn-doc-title" className="fin-sr">Credit note {note.credit_note_number}</h2>
            <dl className="fin-doc__facts">
              <div><dt>Customer</dt><dd title={note.customer_name}>{note.customer_name || '—'}</dd></div>
              <div><dt>Against invoice</dt><dd><Link to={`/finance/invoices/${note.invoice}`} className="fin-link">{note.invoice_number}</Link></dd></div>
              <div><dt>Date</dt><dd>{safeDate(note.issue_date)}</dd></div>
              <div><dt>Credit, incl. VAT</dt><dd>{formatCurrency(note.total_amount)}</dd></div>
            </dl>
            {note.reason && <p className="fin-note" style={{ padding: 'var(--card-pad, 20px) var(--card-pad, 20px) 0' }}><strong>Reason</strong>{note.reason}</p>}
            <div className="fin-doc__lines">
              <div className="fin-doc__head">
                <h3 className="fin-panel-title">Credited</h3>
                <p className="fin-panel-desc">{lines.length} {lines.length === 1 ? 'line' : 'lines'}, amounts excl. VAT</p>
              </div>
              <div className="fin-table-scroll">
                <table className="fin-table fin-doc__table table-heading-roles">
                  <thead>
                    <tr>
                      <th className="fin-cell-fill">Description</th>
                      <th className="num m-hide">Qty</th>
                      <th className="num m-hide">Unit price</th>
                      <th className="m-hide">Tax</th>
                      <th className="num m-hide">VAT</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 ? (
                      <tr className="is-empty"><td colSpan={6}><div className="fin-empty fin-empty--compact">No lines on this credit note</div></td></tr>
                    ) : lines.map(l => (
                      <tr key={l.id}>
                        <td className="fin-strong fin-cell-fill">
                          <div className="fin-doc__desc" title={l.description}>{l.description}</div>
                          <span className="fin-cell-sub fin-mobile-only">{formatQuantity(l.quantity)} × {formatCurrency(l.unit_price)} · {taxCodeShort(l.tax_code)}, VAT {formatCurrency(l.vat_amount)}</span>
                        </td>
                        <td className="num m-hide">{formatQuantity(l.quantity)}</td>
                        <td className="num m-hide">{formatCurrency(l.unit_price)}</td>
                        <td className="m-hide"><span className="fl-tax">{taxCodeShort(l.tax_code)}</span></td>
                        <td className="num m-hide">{formatCurrency(l.vat_amount)}</td>
                        <td className="num">{formatCurrency(l.net_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="fin-doc__totals">
                <div><dt>Subtotal excl. VAT</dt><dd>{formatCurrency(note.subtotal)}</dd></div>
                {byCode.length > 1
                  ? byCode.map(b => <div key={b.code}><dt>{taxCodeShort(b.code)} on {formatCurrency(b.net)}</dt><dd>{formatCurrency(b.vat)}</dd></div>)
                  : <div><dt>{byCode[0] && byCode[0].code !== 'STANDARD' ? `VAT (${taxCodeShort(byCode[0].code).toLowerCase()})` : 'VAT (15%)'}</dt><dd>{formatCurrency(note.vat_amount)}</dd></div>}
                <div className="is-rule is-total"><dt>Credit, incl. VAT</dt><dd>{formatCurrency(note.total_amount)}</dd></div>
              </dl>
            </div>
          </section>
        </div>

        <aside className="fin-rail" aria-label="Credit note activity">
          <AccountingSyncCard sync={note.accounting_sync} what="credit note" />
          <section className="card" aria-labelledby="cn-activity-title">
            <div className="fin-panel-head" style={{ marginBottom: 4 }}>
              <div className="fin-panel-head__text"><h2 id="cn-activity-title" className="fin-panel-title">Activity</h2></div>
            </div>
            <dl className="fin-dl">
              <div className="fin-dl__row"><dt>Issued</dt><dd>{note.created_at ? formatDateTime(note.created_at) : safeDate(note.issue_date)}</dd></div>
              <div className="fin-dl__row"><dt>Voided</dt><dd>{note.voided_at ? formatDateTime(note.voided_at) : 'No'}</dd></div>
              <div className="fin-dl__row"><dt>Invoice</dt><dd><Link to={`/finance/invoices/${note.invoice}`} className="fin-link">{note.invoice_number}</Link></dd></div>
            </dl>
            {!isVoid && toNumber(note.total_amount) > 0 && (
              <button type="button" className="tw-btn" style={{ width: '100%', marginTop: 12 }} onClick={() => setVoidOpen(true)}>Void credit note</button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
