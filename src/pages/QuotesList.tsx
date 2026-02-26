import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchData, patchData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";

const STATUS_COLOR: Record<string, string> = {
  IN_TRANSIT: 'var(--accent-primary)',
  DELIVERED: '#22c55e',
  SCHEDULED: 'var(--text-secondary)',
  LOADING: 'var(--status-warning)',
  DELAYED: 'var(--status-danger)',
  DRAFT: 'var(--text-tertiary)',
  SENT: 'var(--status-warning)',
  ACCEPTED: '#22c55e',
  EXPIRED: 'var(--status-danger)',
};

const COLUMNS = ['SCHEDULED', 'LOADING', 'IN_TRANSIT', 'DELIVERED'];
const COLUMN_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  LOADING: 'Loading',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
};

export function QuotesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'board' | 'list'>('board');

  const { data: loadsData } = useQuery({
    queryKey: ['loads'],
    queryFn: () => fetchData('api/loads/'),
    retry: 1,
  });

  const { data: quotesData } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => fetchData('api/quotes/'),
    retry: 1,
  });

  const loads: any[] = loadsData?.results || loadsData || [];
  const quotes: any[] = quotesData?.results || quotesData || [];

  const filteredLoads = loads.filter(l =>
    !search ||
    l.load_number?.toLowerCase().includes(search.toLowerCase()) ||
    l.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.pickup_location?.toLowerCase().includes(search.toLowerCase()) ||
    l.delivery_location?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredQuotes = quotes.filter(q =>
    !search ||
    q.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
    q.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  const loadsByStatus = COLUMNS.reduce((acc, col) => {
    acc[col] = filteredLoads.filter(l => l.status === col || (col === 'DELIVERED' && l.status === 'DELIVERED'));
    return acc;
  }, {} as Record<string, any[]>);

  // Fill unrecognised statuses into IN_TRANSIT
  filteredLoads.forEach(l => {
    if (!COLUMNS.includes(l.status)) {
      loadsByStatus['IN_TRANSIT'].push(l);
    }
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Operations</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Loads & Quotes</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-action" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} onClick={() => navigate('/quotes/new')}>
              + NEW QUOTE
            </button>
            <button className="btn-action" onClick={() => navigate('/quotes/new')}>+ NEW LOAD</button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search loads, customers, routes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '8px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 12, outline: 'none', width: 280, fontFamily: 'var(--font-sans)' }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {(['board', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? 'var(--accent-primary)' : 'var(--bg-surface)',
              border: `1px solid ${view === v ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              color: view === v ? '#000' : 'var(--text-secondary)',
              padding: '6px 12px', borderRadius: 2, fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', textTransform: 'uppercase',
            }}>{v}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
          <span>{loads.length} loads</span>
          <span>{quotes.length} quotes</span>
        </div>
      </div>

      {/* Tabs */}
      {view === 'board' ? (
        <>
          {/* Loads Kanban */}
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 12 }}>ACTIVE LOADS PIPELINE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
            {COLUMNS.map(col => (
              <div key={col}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 2px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[col] || 'var(--text-secondary)', letterSpacing: '0.08em' }}>{COLUMN_LABELS[col]}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-surface-hover)', padding: '2px 6px', borderRadius: 2 }}>{loadsByStatus[col]?.length || 0}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(loadsByStatus[col] || []).map((load: any) => (
                    <div key={load.id} className="card" style={{ padding: 14, cursor: 'pointer', borderLeft: `2px solid ${STATUS_COLOR[load.status] || 'var(--border-subtle)'}` }} onClick={() => navigate(`/bookings/${load.id}`)}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>{load.load_number}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{load.customer_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {load.pickup_location?.split(' ').slice(0,2).join(' ')} → {load.delivery_location?.split(' ').slice(0,2).join(' ')}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-primary)' }}>{formatCurrency(parseFloat(load.total_amount || '0'))}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{load.driver_name}</span>
                      </div>
                    </div>
                  ))}
                  {(loadsByStatus[col] || []).length === 0 && (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, border: '1px dashed var(--border-subtle)', borderRadius: 2 }}>—</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quotes section */}
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 12 }}>QUOTES</div>
          {quotes.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 12 }}>No quotes yet. Create one to start the pipeline.</div>
              <button className="btn-action" onClick={() => navigate('/quotes/new')}>+ NEW QUOTE</button>
            </div>
          ) : (
            <div className="card table-card">
              <table className="data-table">
                <thead>
                  <tr><th>Quote #</th><th>Customer</th><th>Route</th><th>Amount</th><th>Status</th><th>Confidence</th><th className="text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((q: any) => (
                    <tr key={q.id}>
                      <td className="mono">{q.quote_number}</td>
                      <td>{q.customer_name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{q.origin} → {q.destination}</td>
                      <td>{formatCurrency(parseFloat(q.total_amount || '0'))}</td>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[q.status] || 'var(--text-secondary)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>{q.status}</span></td>
                      <td style={{ color: q.confidence === 'HIGH' ? '#22c55e' : q.confidence === 'MEDIUM' ? 'var(--status-warning)' : 'var(--status-danger)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{q.confidence}</td>
                      <td className="text-right"><button className="btn-action" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => navigate(`/bookings/pipeline/${q.id}`)}>VIEW</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* List view — all loads */
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr><th>Load #</th><th>Customer</th><th>Route</th><th>Driver</th><th>Status</th><th>Amount</th><th className="text-right">Pickup</th></tr>
            </thead>
            <tbody>
              {filteredLoads.map((load: any) => (
                <tr key={load.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/bookings/${load.id}`)}>
                  <td className="mono">{load.load_number}</td>
                  <td>{load.customer_name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{load.pickup_location?.split(' ').slice(0,2).join(' ')} → {load.delivery_location?.split(' ').slice(0,2).join(' ')}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{load.driver_name}</td>
                  <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[load.status] || 'var(--text-secondary)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>{load.status?.replace('_', ' ')}</span></td>
                  <td style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(parseFloat(load.total_amount || '0'))}</td>
                  <td className="text-right" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{load.pickup_date?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLoads.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>No loads found</div>}
        </div>
      )}
    </div>
  );
}
