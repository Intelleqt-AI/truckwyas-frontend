import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData, postData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { QuotesList } from './QuotesList';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { LiveBadge } from '@/components/LiveBadge';

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

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'var(--text-secondary)',
  ASSIGNED: 'var(--status-warning)',
  IN_TRANSIT: 'var(--accent-primary)',
  LOADING: 'var(--status-warning)',
  DELIVERED: 'var(--status-success)',
  INVOICED: 'var(--accent-primary)',
  CANCELLED: 'var(--status-error)',
};

type BookingTab = 'quotes' | 'orders' | 'history';

const ACTIVE_STATUSES = ['PENDING', 'ASSIGNED', 'LOADING', 'IN_TRANSIT'];
const HISTORY_STATUSES = ['DELIVERED', 'INVOICED', 'CANCELLED'];

const TAB_SUBTITLES: Record<BookingTab, string> = {
  quotes: 'Sales Pipeline',
  orders: 'Active Orders',
  history: 'Completed & Archived',
};

export default function LoadsList() {
  const { data, isLoading: loading, isError, refetch } = useQuery({
    queryKey: ["loads-list"],
    queryFn: () => fetchData('/api/v1/loads/'),
  });
  const loads = (data?.results || data || []) as Load[];
  const error = isError ? 'Failed to load bookings' : null;
  const [convertingIds, setConvertingIds] = useState<Set<number>>(new Set());
  const [orderFilter, setOrderFilter] = useState('All');
  const [historyFilter, setHistoryFilter] = useState('All');
  const [historySearch, setHistorySearch] = useState('');
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

  const renderTable = (data: Load[], showInvoiceAction: boolean) => (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-deep)', borderBottom: '1px solid var(--border-subtle)' }}>
            {['LOAD #', 'CUSTOMER', 'ROUTE', 'DRIVER', 'VEHICLE', 'STATUS', 'AMOUNT', 'ACTION'].map(h => (
              <th key={h} style={{
                padding: '12px 16px',
                textAlign: h === 'AMOUNT' ? 'right' : h === 'ACTION' ? 'center' : 'left',
                fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
                fontWeight: 600, letterSpacing: '0.1em'
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((load, idx) => (
            <tr
              key={load.id}
              onClick={() => navigate(`/bookings/${load.id}`)}
              style={{
                borderBottom: idx < data.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 600 }}>{load.load_number}</td>
              <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-primary)' }}>{load.customer_name || '—'}</td>
              <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                {load.pickup_location} → {load.delivery_location}
              </td>
              <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>{load.driver_name || '—'}</td>
              <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{load.vehicle_info || '—'}</td>
              <td style={{ padding: '12px 16px' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: STATUS_COLOR[load.status] || 'var(--text-secondary)',
                  padding: '4px 8px',
                  border: `1px solid ${STATUS_COLOR[load.status] || 'var(--border-subtle)'}`,
                  borderRadius: 2,
                }}>
                  {load.status?.replace('_', ' ')}
                </span>
              </td>
              <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600 }}>
                {formatCurrency(parseFloat(load.total_amount || '0'))}
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                {showInvoiceAction && load.status === 'DELIVERED' && (
                  <button
                    onClick={(e) => handleConvertToInvoice(load, e)}
                    disabled={convertingIds.has(load.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--accent-primary)',
                      color: 'var(--accent-primary)',
                      padding: '4px 10px', fontSize: 10, fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.05em', borderRadius: 2,
                      cursor: convertingIds.has(load.id) ? 'not-allowed' : 'pointer',
                      opacity: convertingIds.has(load.id) ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {convertingIds.has(load.id) ? 'CREATING...' : '→ INVOICE'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        loads.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📦</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
              No loads yet
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Get started by creating your first quote or booking
            </div>
            <button onClick={() => navigate('/bookings/quotes/new')} className="btn-action">
              CREATE QUOTE
            </button>
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            No loads match your filters
          </div>
        )
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>Bookings</div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
          <div style={{ height: 32, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ fontSize: 13, color: 'var(--status-error)', marginBottom: 12 }}>{error}</div>
        <button className="btn-action" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Bookings</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>{TAB_SUBTITLES[activeTab]}</div>
            <LiveBadge />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/bookings/quotes/ai-chat')}
            style={{
              background: 'var(--bg-surface)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)',
              padding: '8px 16px', fontSize: 11, fontFamily: 'var(--font-mono)',
              fontWeight: 600, letterSpacing: '0.05em', borderRadius: 2, cursor: 'pointer',
            }}
          >AI QUOTE</button>
          <button
            onClick={() => navigate('/bookings/quotes/new')}
            style={{
              background: 'var(--accent-primary)', border: 'none', color: 'var(--bg-deep)',
              padding: '8px 16px', fontSize: 11, fontFamily: 'var(--font-mono)',
              fontWeight: 600, letterSpacing: '0.05em', borderRadius: 2, cursor: 'pointer',
            }}
          >+ NEW QUOTE</button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border-subtle)', marginBottom: 20 }}>
        {([
          { id: 'quotes' as BookingTab, label: 'Quotes' },
          { id: 'orders' as BookingTab, label: 'Orders' },
          { id: 'history' as BookingTab, label: 'History' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigate(`/bookings/${tab.id}`)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '12px 0',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* QUOTES TAB */}
      {activeTab === 'quotes' && (
        <QuotesList embedded={true} />
      )}

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <div>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Active Orders', value: activeLoads.length, color: 'var(--text-primary)' },
              { label: 'In Transit', value: activeLoads.filter(l => l.status === 'IN_TRANSIT').length, color: 'var(--accent-primary)' },
              { label: 'Loading', value: activeLoads.filter(l => l.status === 'LOADING').length, color: 'var(--status-warning)' },
              { label: 'Revenue (Active)', value: formatCurrency(activeLoads.reduce((sum, l) => sum + parseFloat(l.total_amount || '0'), 0)), color: 'var(--accent-primary)' },
            ].map(m => (
              <div key={m.label} className="card metric-card">
                <div className="card-header"><span className="card-title">{m.label}</span></div>
                <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Order Status Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {['All', 'PENDING', 'ASSIGNED', 'LOADING', 'IN_TRANSIT'].map(status => {
              const isActive = orderFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setOrderFilter(status)}
                  style={{
                    background: isActive ? 'var(--accent-primary)' : 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: isActive ? 'var(--bg-deep)' : 'var(--text-secondary)',
                    padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 11,
                    borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase',
                    letterSpacing: '0.06em', fontWeight: isActive ? 600 : 400,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {status === 'All' ? 'ALL' : status.replace('_', ' ')}
                </button>
              );
            })}
          </div>

          {renderTable(filteredOrders, false)}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Completed', value: historyLoads.filter(l => l.status === 'DELIVERED' || l.status === 'INVOICED').length, color: 'var(--status-success)' },
              { label: 'Invoiced', value: historyLoads.filter(l => l.status === 'INVOICED').length, color: 'var(--accent-primary)' },
              { label: 'Cancelled', value: historyLoads.filter(l => l.status === 'CANCELLED').length, color: 'var(--status-error)' },
              { label: 'Total Revenue', value: formatCurrency(historyLoads.filter(l => l.status !== 'CANCELLED').reduce((sum, l) => sum + parseFloat(l.total_amount || '0'), 0)), color: 'var(--accent-primary)' },
            ].map(m => (
              <div key={m.label} className="card metric-card">
                <div className="card-header"><span className="card-title">{m.label}</span></div>
                <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* History Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
            <input
              type="text" placeholder="Search history..."
              value={historySearch} onChange={e => setHistorySearch(e.target.value)}
              style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                padding: '6px 10px', color: 'var(--text-primary)', borderRadius: 2,
                fontSize: 12, outline: 'none', width: 220, fontFamily: 'var(--font-sans)',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {['All', 'DELIVERED', 'INVOICED', 'CANCELLED'].map(status => {
                const isActive = historyFilter === status;
                return (
                  <button
                    key={status}
                    onClick={() => setHistoryFilter(status)}
                    style={{
                      background: isActive ? 'var(--accent-primary)' : 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: isActive ? 'var(--bg-deep)' : 'var(--text-secondary)',
                      padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 11,
                      borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase',
                      letterSpacing: '0.06em', fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {status === 'All' ? 'ALL' : status}
                  </button>
                );
              })}
            </div>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              {filteredHistory.length} records
            </span>
          </div>

          {renderTable(filteredHistory, true)}
        </div>
      )}
    </div>
  );
}
