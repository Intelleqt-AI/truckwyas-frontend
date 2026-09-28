import './bookings-typography.css';
import './table-heading-roles.css';
import './bookings-section.css';
import './ops-tiles.css';
import { InfoTip } from '@/components/ui/InfoTip';
import { StatusChip } from '@/components/ui/StatusChip';
import { Segmented } from '@/components/ui/Segmented';
import { KpiRow, KpiTile } from '@/components/ui/KpiTile';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Package, Plus } from 'lucide-react';
import SectionHeader, { type SectionTab } from '@/components/layout/SectionHeader';
import { useQuery } from '@tanstack/react-query';
import { fetchData, postData } from '@/lib/Api';
import { formatCurrency, formatMoneyWhole } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { QuotesList } from './QuotesList';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import { rowLink } from '@/lib/rowLink';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { SkeletonRows, TilesSkeleton } from '@/components/fleet-detail/ContentSkeleton';

interface Load {
  id: number;
  load_number: string;
  pickup_location: string;
  delivery_location: string;
  status: string;
  total_amount: string;
  driver_name?: string;
  vehicle_info?: string;
  pickup_date?: string;
  customer_name?: string;
  quote_number?: string;
}

// Sentence-case a status token for display: "IN_TRANSIT" → "In transit".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

// "MAN TGL 8.180 - MP 123 FGH" → "MP 123 FGH": the plate identifies the truck;
// the full make and model stays in the cell's title.
const plateOf = (info?: string) => {
  if (!info) return '';
  const parts = info.split(' - ');
  return (parts.length > 1 ? parts[parts.length - 1] : info).trim();
};
// One column for who and what is on the job, so the table keeps Status and
// Amount in view at laptop widths.
const assignedLabel = (l: { driver_name?: string; vehicle_info?: string }) => {
  const bits = [l.driver_name, plateOf(l.vehicle_info)].filter(Boolean);
  return bits.length ? bits.join(' · ') : <span className="bk-muted">Not assigned</span>;
};

type BookingTab = 'quotes' | 'orders' | 'history';

const ACTIVE_STATUSES = ['PENDING', 'ASSIGNED', 'LOADING', 'IN_TRANSIT'];
const HISTORY_STATUSES = ['DELIVERED', 'INVOICED', 'CANCELLED'];

/** Shared sub-navigation for every Bookings list view. */
export const BOOKINGS_TABS: SectionTab[] = [
  { label: 'Quotes', to: '/bookings/quotes' },
  { label: 'Orders', to: '/bookings/orders' },
  { label: 'History', to: '/bookings/history' },
];

const TAB_TITLES: Record<BookingTab, string> = {
  quotes: 'Quotes',
  orders: 'Active orders',
  history: 'Order history',
};

const TAB_DESCRIPTIONS: Record<BookingTab, string> = {
  quotes: 'Draft, send and track quotes.',
  orders: 'Booked loads that are not yet delivered.',
  history: 'Delivered, invoiced and cancelled loads.',
};

export default function LoadsList() {
  const loadsQuery = useQuery({
    queryKey: ["loads-list"],
    queryFn: () => fetchData('/api/v1/loads/'),
    // Give the backend enough time to wake from a cold start (Render free tier ~20-30s).
    // Retry up to 4 times with increasing delays: 3s, 6s, 9s, 12s.
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 4;
    },
    retryDelay: (attempt) => Math.min(3000 * (attempt + 1), 12000),
  });
  const { data, isFetching, refetch } = loadsQuery;
  // Failed (or failing and retrying) with nothing to show: say so straight away.
  const failed = loadFailed(loadsQuery);
  const loading = loadsQuery.isLoading && !failed;
  const loads = (data?.results || data || []) as Load[];
  const error = failed ? 'Failed to load bookings' : null;
  const [convertingIds, setConvertingIds] = useState<Set<number>>(new Set());
  const [orderFilter, setOrderFilter] = useState('All');
  const [historyFilter, setHistoryFilter] = useState('All');
  const [historySearch, setHistorySearch] = useState('');
  // Owned here (not inside QuotesList) so the search box + Board/List toggle
  // can render inline with the Quotes/Orders/History tabs.
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteView, setQuoteView] = useState<'board' | 'list'>('board');
  const navigate = useNavigate();
  const location = useLocation();
  const urlSegment = location.pathname.split('/').pop();
  const activeTab: BookingTab = (['quotes', 'orders', 'history'] as BookingTab[]).includes(urlSegment as BookingTab)
    ? (urlSegment as BookingTab)
    : 'orders';

  const handleConvertToInvoice = async (load: Load, e: React.MouseEvent) => {
    e.stopPropagation();
    setConvertingIds(prev => new Set(prev).add(load.id));

    try {
      const response = await postData({
        url: `/api/v1/loads/${load.id}/convert_to_invoice/`,
        data: {}
      });

      if (response?.invoice_id) {
        toast.success(`Invoice created for ${load.load_number}`);
        navigate(`/finance/invoices/${response.invoice_id}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create invoice');
    } finally {
      setConvertingIds(prev => {
        const next = new Set(prev);
        next.delete(load.id);
        return next;
      });
    }
  };

  useAutoRefresh(refetch);

  const activeLoads = loads.filter(l => ACTIVE_STATUSES.includes(l.status));
  const historyLoads = loads.filter(l => HISTORY_STATUSES.includes(l.status));

  const filteredOrders = activeLoads.filter(l => orderFilter === 'All' || l.status === orderFilter);
  const filteredHistory = historyLoads.filter(l => {
    const matchStatus = historyFilter === 'All' || l.status === historyFilter;
    const matchSearch = !historySearch || 
      (l.customer_name || '').toLowerCase().includes(historySearch.toLowerCase()) ||
      (l.load_number || '').toLowerCase().includes(historySearch.toLowerCase()) ||
      (l.pickup_location || '').toLowerCase().includes(historySearch.toLowerCase()) ||
      (l.delivery_location || '').toLowerCase().includes(historySearch.toLowerCase());
    return matchStatus && matchSearch;
  });

  const renderTable = (data: Load[], showInvoiceAction: boolean, emptyText: string) => loading ? (
    // Loading: the real table head with placeholder rows at the final row
    // height, so nothing moves when the orders arrive.
    <div className="bk-table-wrap" aria-busy="true" aria-label="Loading orders">
      <table className={`table-heading-roles bk-table${showInvoiceAction ? ' bk-table--history' : ''}`}>
        <thead>
          <tr>
            <th scope="col" className="bk-col-load">Load</th>
            <th scope="col">Customer</th>
            <th scope="col" className="bk-col-route">Route</th>
            <th scope="col" className="bk-col-opt">Driver and vehicle</th>
            <th scope="col">Status</th>
            <th scope="col" className="is-num">Amount</th>
            {showInvoiceAction && <th scope="col" className="is-num"><span className="sr-only">Action</span></th>}
          </tr>
        </thead>
        <tbody><SkeletonRows rows={8} cols={showInvoiceAction ? 7 : 6} /></tbody>
      </table>
    </div>
  ) : (
    <div className="bk-table-wrap">
      <table className={`table-heading-roles bk-table${showInvoiceAction ? ' bk-table--history' : ''}`}>
        <thead>
          <tr>
            <th scope="col" className="bk-col-load">Load</th>
            <th scope="col">Customer</th>
            <th scope="col" className="bk-col-route">Route</th>
            <th scope="col" className="bk-col-opt">Driver and vehicle</th>
            <th scope="col">Status</th>
            <th scope="col" className="is-num">Amount</th>
            {showInvoiceAction && <th scope="col" className="is-num"><span className="sr-only">Action</span></th>}
          </tr>
        </thead>
        <tbody>
          {data.map((load) => (
            <tr
              key={load.id}
              className="is-clickable"
              {...rowLink(() => navigate(`/bookings/${load.id}`))}
              onClick={() => navigate(`/bookings/${load.id}`)}
            >
              <td className="is-id bk-col-load">{load.load_number}</td>
              <td className="is-primary is-truncate bk-col-customer" title={load.customer_name || ''}>{load.customer_name || '—'}</td>
              <td className="is-truncate bk-col-route" title={`${load.pickup_location} to ${load.delivery_location}`}>
                {load.pickup_location} → {load.delivery_location}
              </td>
              <td className="is-truncate bk-col-opt" title={[load.driver_name, load.vehicle_info].filter(Boolean).join(', ')}>
                {assignedLabel(load)}
              </td>
              <td>
                <StatusChip status={load.status} size="sm" />
              </td>
              <td className="is-money">
                {formatCurrency(parseFloat(load.total_amount || '0'))}
              </td>
              {showInvoiceAction && <td className="is-num" onClick={(e) => e.stopPropagation()}>
                {load.status === 'DELIVERED' && (
                  <button
                    type="button"
                    className="bk-btn bk-btn--secondary bk-btn--sm"
                    onClick={(e) => handleConvertToInvoice(load, e)}
                    disabled={convertingIds.has(load.id)}
                  >
                    {convertingIds.has(load.id) ? 'Creating…' : 'Create invoice'}
                  </button>
                )}
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        loads.length === 0 ? (
          <div className="bk-empty">
            <div className="bk-empty__icon"><Package size={32} aria-hidden="true" /></div>
            <h2 className="bk-empty__title">No loads yet</h2>
            <p className="bk-empty__text">Create a quote, then convert it to a booking once the customer accepts.</p>
            <button type="button" onClick={() => navigate('/bookings/quotes/new')} className="bk-btn bk-btn--primary">
              New quote
            </button>
          </div>
        ) : (
          <div className="bk-empty">
            <p className="bk-empty__text">{emptyText}</p>
          </div>
        )
      )}
    </div>
  );

  // Summary tiles: only the numbers that tell you what to do next. Each is
  // its own card (label, figure, one short line); method sits in an InfoTip.
  const summary = (items: { label: string; value: React.ReactNode; title?: string; note: string; tip?: string; attention?: boolean }[]) => (
    <KpiRow className="bk-kpis">
      {items.map(m => (
        <KpiTile
          key={m.label}
          aria-label={m.label}
          label={m.label}
          aside={m.tip ? <InfoTip>{m.tip}</InfoTip> : undefined}
          figure={<span title={m.title}>{m.value}</span>}
          note={m.note}
          // Counts carry the attention; the note stays neutral text (no amber links).
          tone="neutral"
        />
      ))}
    </KpiRow>
  );
  const wholeRand = (n: number) => formatMoneyWhole(n);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const pendingCount = activeLoads.filter(l => l.status === 'PENDING').length;
  const deliveredNotInvoiced = historyLoads.filter(l => l.status === 'DELIVERED').length;
  const completedLoads = historyLoads.filter(l => l.status !== 'CANCELLED');

  // Body below the shared header. Loading and error states render here so
  // the title and sub-navigation stay put while data arrives.
  let body: React.ReactNode;
  if (activeTab === 'quotes') {
    body = null; // Quotes manage their own loading per column.
  } else if (error) {
    body = (
      <LoadError
        what={activeTab === 'history' ? 'past loads' : 'orders'}
        error={loadsQuery.error ?? loadsQuery.failureReason}
        busy={isFetching}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="bookings-typography" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flexShrink: 0 }}>
        <SectionHeader
          eyebrow="Bookings"
          title={TAB_TITLES[activeTab]}
          description={TAB_DESCRIPTIONS[activeTab]}
          actions={
            <button type="button" className="bk-btn bk-btn--primary" onClick={() => navigate('/bookings/quotes/new')}>
              <Plus size={16} aria-hidden="true" />
              New quote
            </button>
          }
          tabs={BOOKINGS_TABS}
        />
      </div>

      {/* QUOTES TAB — fills remaining viewport height; QuotesList scrolls its own areas internally */}
      {activeTab === 'quotes' && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <QuotesList embedded={true} search={quoteSearch} onSearchChange={setQuoteSearch} view={quoteView} onViewChange={setQuoteView} />
        </div>
      )}

      {activeTab !== 'quotes' && body}

      {/* ORDERS TAB */}
      {activeTab === 'orders' && !body && (
        <div>
          {loading ? <TilesSkeleton count={3} /> : activeLoads.length > 0 ? summary([
            {
              label: 'Waiting for a vehicle',
              value: pendingCount,
              note: pendingCount > 0 ? 'Assign a vehicle' : 'All have a vehicle',
              tip: 'Pending orders with no vehicle assigned yet.',
              attention: pendingCount > 0,
            },
            {
              label: 'On the road',
              value: activeLoads.filter(l => l.status === 'IN_TRANSIT').length,
              note: `${activeLoads.filter(l => l.status === 'LOADING').length} loading, ${activeLoads.filter(l => l.status === 'ASSIGNED').length} assigned`,
              tip: 'Orders with status In transit.',
            },
            (() => {
              const total = activeLoads.reduce((sum, l) => sum + parseFloat(l.total_amount || '0'), 0);
              return {
                label: 'Active order value',
                value: wholeRand(total),
                title: formatCurrency(total),
                note: plural(activeLoads.length, 'active order', 'active orders'),
                tip: 'Sum of order totals across active orders.',
              };
            })(),
          ]) : (
            <div className="bk-notice">
              <div>
                <p className="bk-notice__text">No orders are in progress.</p>
              </div>
              <button type="button" className="bk-btn bk-btn--secondary" onClick={() => navigate('/bookings/quotes')}>View quotes</button>
            </div>
          )}

          <div className="bk-toolbar">
            <Segmented
              label="Filter orders by status"
              value={orderFilter}
              onChange={setOrderFilter}
              options={['All', 'PENDING', 'ASSIGNED', 'LOADING', 'IN_TRANSIT'].map(status => ({ value: status, label: status === 'All' ? 'All' : formatStatus(status) }))}
            />
            <span className="bk-toolbar__end">{filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}</span>
          </div>

          {renderTable(filteredOrders, false, activeLoads.length === 0 ? 'Nothing in progress right now.' : 'No orders match this filter.')}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && !body && (
        <div>
          {loading ? <TilesSkeleton count={3} /> : historyLoads.length > 0 && summary([
            {
              label: 'Delivered, not invoiced',
              value: deliveredNotInvoiced,
              note: deliveredNotInvoiced > 0 ? 'Invoice to get paid' : 'All invoiced',
              attention: deliveredNotInvoiced > 0,
            },
            {
              label: 'Invoiced',
              value: historyLoads.filter(l => l.status === 'INVOICED').length,
              note: `${plural(historyLoads.filter(l => l.status === 'CANCELLED').length, 'load', 'loads')} cancelled`,
            },
            (() => {
              const total = completedLoads.reduce((sum, l) => sum + parseFloat(l.total_amount || '0'), 0);
              return {
                label: 'Completed revenue',
                value: wholeRand(total),
                title: formatCurrency(total),
                note: plural(completedLoads.length, 'load', 'loads'),
                tip: 'Sum of order totals across delivered and invoiced loads.',
              };
            })(),
          ])}

          <div className="bk-toolbar">
            <input
              type="search"
              className="bk-search"
              aria-label="Search history"
              placeholder="Search customer, load or route"
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
            />
            <Segmented
              label="Filter history by status"
              value={historyFilter}
              onChange={setHistoryFilter}
              options={['All', 'DELIVERED', 'INVOICED', 'CANCELLED'].map(status => ({ value: status, label: status === 'All' ? 'All' : formatStatus(status) }))}
            />
            <span className="bk-toolbar__end">{filteredHistory.length} {filteredHistory.length === 1 ? 'record' : 'records'}</span>
          </div>

          {renderTable(filteredHistory, true, historyLoads.length === 0 ? 'No delivered, invoiced or cancelled loads yet.' : 'No loads match your search or filter.')}
        </div>
      )}
    </div>
  );
}
