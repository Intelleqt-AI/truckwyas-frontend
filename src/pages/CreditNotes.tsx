import './table-heading-roles.css';
import './finance-brand.css';
import '@/components/finance/finance-ledger.css';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SectionHeader, { FINANCE_TABS } from '@/components/layout/SectionHeader';
import { Toolbar, SearchInput } from '@/components/ui/Toolbar';
import { Segmented } from '@/components/ui/Segmented';
import { StatusChip } from '@/components/ui/StatusChip';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import '@/components/data/load-error.css';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { rowLink } from '@/lib/rowLink';
import { useCreditNotes } from '@/lib/finance/api';
import { toNumber } from '@/lib/finance/tax';
import type { CreditNote } from '@/lib/finance/types';

const PAGE_SIZE = 20;
type StatusFilter = 'ALL' | 'ISSUED' | 'VOID';

const safeDate = (d?: string | null) => (d ? formatDate(d) : '—');

/** Every credit note, newest first. Issued from an invoice; opened here to read or void. */
export default function CreditNotes() {
  const navigate = useNavigate();
  const query = useCreditNotes();
  const failed = loadFailed(query);
  const loading = query.isLoading && !failed;
  const notes = query.data?.rows ?? [];
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);

  useEffect(() => { document.title = 'Credit notes - TruckWys'; }, []);

  const q = search.trim().toLowerCase();
  const filtered = notes
    .filter(n => status === 'ALL' || String(n.status).toUpperCase() === status)
    .filter(n => !q || [n.credit_note_number, n.invoice_number, n.customer_name, n.reason].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => String(b.issue_date).localeCompare(String(a.issue_date)) || b.id - a.id);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const issuedTotal = filtered.filter(n => String(n.status).toUpperCase() === 'ISSUED').reduce((s, n) => s + toNumber(n.total_amount), 0);
  const count = (s: StatusFilter) => (loading ? undefined : notes.filter(n => s === 'ALL' || String(n.status).toUpperCase() === s).length);

  const header = <SectionHeader eyebrow="Finance" title="Finance" tabs={FINANCE_TABS} />;

  if (failed) {
    return (
      <div className="fin-page">
        {header}
        <LoadError what="credit notes" error={query.error ?? query.failureReason} busy={query.isFetching} onRetry={() => query.refetch()} />
      </div>
    );
  }

  return (
    <div className="fin-page">
      {header}
      <Toolbar
        className="fin-toolbar"
        aria-label="Filter credit notes"
        meta={loading ? ' ' : `${filtered.length} ${filtered.length === 1 ? 'credit note' : 'credit notes'}${issuedTotal > 0 ? ` · ${formatCurrency(issuedTotal)} issued` : ''}`}
      >
        <SearchInput wrapClassName="inv-search" placeholder="Search credit notes" aria-label="Search by number, invoice, customer or reason"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <Segmented<StatusFilter>
          label="Filter by status"
          className="fin-seg"
          value={status}
          onChange={v => { setStatus(v); setPage(1); }}
          options={[
            { value: 'ALL', label: 'All', count: count('ALL') },
            { value: 'ISSUED', label: 'Issued', count: count('ISSUED') },
            { value: 'VOID', label: 'Void', count: count('VOID') },
          ]}
        />
      </Toolbar>

      {loading ? (
        <div className="fin-skel fin-skel--card" style={{ marginTop: 0 }} aria-busy="true" aria-label="Loading credit notes" />
      ) : (
        <div className="card fin-table-card fin-table-card--fit fin-section">
          <div className="fin-table-scroll">
            <table className="fin-table fin-table--stack table-heading-roles">
              <thead>
                <tr>
                  <th className="fin-cell-fill">Credit note</th>
                  <th className="m-hide">Invoice</th>
                  <th className="m-hide">Date</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className="is-empty">
                    <td colSpan={5} style={{ padding: 0 }}>
                      {notes.length === 0 ? (
                        <div className="fin-empty">
                          <p className="fin-empty__title">No credit notes yet</p>
                          <p className="fin-empty__body">To correct a sent invoice, open it and choose Issue credit note.</p>
                          <button type="button" className="btn-action" onClick={() => navigate('/finance/invoices')}>Go to invoices</button>
                        </div>
                      ) : (
                        <div className="fin-empty fin-empty--compact">No credit notes match your filters</div>
                      )}
                    </td>
                  </tr>
                ) : rows.map((n: CreditNote) => {
                  const st = String(n.status).toUpperCase();
                  return (
                    <tr key={n.id} className="is-clickable" {...rowLink(() => navigate(`/finance/credit-notes/${n.id}`))} onClick={() => navigate(`/finance/credit-notes/${n.id}`)}>
                      <td className="fin-strong m-party m-span2 fin-cell-2 fin-cell-fill">
                        <div className="fin-truncate fin-truncate--fill" title={n.customer_name}>{n.customer_name || '—'}</div>
                        <span className="fin-cell-sub">
                          <span className="fin-id">{n.credit_note_number}</span>
                          <span className="fin-mobile-only"> · {safeDate(n.issue_date)}</span>
                        </span>
                      </td>
                      <td className="m-hide" onClick={e => e.stopPropagation()}>
                        <Link to={`/finance/invoices/${n.invoice}`} className="fin-link fin-id">{n.invoice_number}</Link>
                      </td>
                      <td className="fin-date m-hide">{safeDate(n.issue_date)}</td>
                      <td className="m-status"><StatusChip status={st} size="sm" /></td>
                      <td className="num m-amount" style={st === 'VOID' ? { color: 'var(--text-tertiary)' } : undefined}>{formatCurrency(n.total_amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="fin-table-foot">
              <span>{(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div className="fin-table-foot__nav">
                <button type="button" className="tw-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                <button type="button" className="tw-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
