import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { LiveBadge } from '@/components/LiveBadge';

const EVENT_DOT: Record<string, string> = {
  success: 'var(--status-success)', warning: 'var(--status-warning)',
  alert: 'var(--status-danger)', info: 'var(--accent-primary)',
};
const ACTIVE_ADV = ['REQUESTED', 'SCORING', 'APPROVED', 'DISBURSED'];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const eyebrow: React.CSSProperties = { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 };
const cardTitle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 600 };
const num = (v: any) => Number(v || 0);

export default function CashCommand() {
  const navigate = useNavigate();
  const [finance, setFinance] = useState<any>(null);
  const [eligible, setEligible] = useState<any>(null);
  const [advances, setAdvances] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([
      fetchData('api/v1/dashboard/finance/').catch(() => null),
      fetchData('api/v1/capital/eligible/').catch(() => null),
      fetchData('api/v1/advances/').catch(() => []),
      fetchData('api/v1/notifications/?limit=25').catch(() => []),
    ]).then(([f, e, a, n]: any[]) => {
      setFinance(f);
      setEligible(e);
      setAdvances(Array.isArray(a) ? a : (a?.results || []));
      setEvents(Array.isArray(n) ? n : (n?.results || []));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { document.title = 'Cash Command - TruckWys'; load(); }, [load]);
  useAutoRefresh(load, 20000); // 20s + instant on every tw:live-event (WebSocket)

  const inFlight = advances.filter(a => ACTIVE_ADV.includes(a.status));
  const inFlightValue = inFlight.reduce((s, a) => s + num(a.net_amount), 0);
  const eligInvoices = eligible?.invoices || [];

  const stats = [
    { label: 'Cash to collect', value: num(finance?.outstanding_invoices_total), color: 'var(--text-primary)', route: '/finance/invoices' },
    { label: 'Overdue', value: num(finance?.overdue_invoices_total), color: 'var(--status-danger)', route: '/finance/invoices' },
    { label: 'Fast-pay available', value: num(eligible?.total_net_payout_zar), color: 'var(--accent-primary)', route: '/capital' },
    { label: 'Advances in flight', value: inFlightValue, color: 'var(--status-success)', route: '/capital' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={eyebrow}>Finance</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Cash Command</div>
          <LiveBadge />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Your live money position — collect, unlock and track cash. (Operations stay in your fleet software.)</div>
      </div>

      {/* Cash stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        {stats.map(s => (
          <div key={s.label} className="card metric-card" style={{ cursor: 'pointer' }} onClick={() => navigate(s.route)}>
            <div className="card-header"><span className="card-title">{s.label}</span></div>
            <div className="metric-value" style={{ fontSize: 24, color: s.color }}>{loading ? '…' : formatCurrency(s.value)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Fast-pay opportunities */}
        <div className="card table-card">
          <div className="card-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={cardTitle}>Unlock cash now ({eligInvoices.length})</span>
            <button onClick={() => navigate('/capital')} style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '4px 8px', fontSize: 10, borderRadius: 2, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>FAST PAY</button>
          </div>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>Loading…</div>
          ) : eligInvoices.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No invoices eligible for fast pay right now.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Tier</th><th className="text-right">Net payout</th></tr></thead>
              <tbody>
                {eligInvoices.slice(0, 8).map((inv: any) => (
                  <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/capital')}>
                    <td className="mono">{inv.invoice_number}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{inv.customer}</td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>{inv.tier}</span></td>
                    <td className="text-right mono" style={{ color: 'var(--status-success)' }}>{formatCurrency(num(inv.net_payout_zar))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Live feed */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={cardTitle}>Live feed</span>
          </div>
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>Loading…</div>
            ) : events.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No activity yet. Cash & risk events appear here in real time.</div>
            ) : events.map((e, i) => (
              <div key={e.id ?? i} onClick={() => e.link && navigate(e.link)}
                style={{ display: 'flex', gap: 10, padding: '11px 16px', borderBottom: '1px solid var(--border-row)', cursor: e.link ? 'pointer' : 'default' }}>
                <span style={{ marginTop: 5, flexShrink: 0, width: 7, height: 7, borderRadius: '50%', background: EVENT_DOT[e.type || 'info'] || 'var(--accent-primary)' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{e.title}</div>
                  {e.description && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{e.description}</div>}
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{timeAgo(e.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
