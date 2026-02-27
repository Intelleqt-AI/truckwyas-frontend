import { useState, useEffect } from 'react';
import { fetchData } from '@/lib/Api';

interface InsightSignal {
  type: string;
  title: string;
  body: string;
  impact_amount?: number;
  action?: string;
  category?: string;
}

interface InsightsResponse {
  signals: InsightSignal[];
  cashflow?: Array<{ label: string; confirmed: number; expected: number }>;
  portfolio_health?: Array<{ label: string; value: string; target: string; ok: boolean }>;
}

const MOCK_FALLBACK: InsightsResponse = {
  signals: [
    { type: 'CRITICAL', title: 'Margin Leak — JHB-CPT', body: 'Fuel costs 12% above baseline on Truck 42. Reroute via N1 Alternate saves ~R 1,840/trip.', action: 'APPLY FIX', category: 'Route Intelligence' },
    { type: 'OPPORTUNITY', title: 'Invoice Chasing — INV-2024-09', body: 'Client opened email 3x. Payment probability today: 85%. Recommend follow-up call.', action: 'CALL NOW', category: 'Cash Alerts' },
    { type: 'WARNING', title: '3 Trucks Idle — Depot 4', body: 'TRK-774, TRK-811, TRK-829 idle 18+ hours. Estimated revenue loss: R 54,000/day.', action: 'REASSIGN', category: 'Fleet Performance' },
    { type: 'INFO', title: 'LogiCorp — New Load Available', body: 'CPT → JHB, 24T, R 48,000. Matches your fleet capacity. 3 competitors have quoted.', action: 'QUOTE', category: 'Customer Intel' },
    { type: 'OPPORTUNITY', title: 'Fast Pay — 4 Invoices Ready', body: 'R 182,000 in eligible invoices. Advance at 2–2.5% fee. Cash in 4 hours.', action: 'FAST PAY', category: 'Cash Alerts' },
  ],
  cashflow: [
    { label: 'Week 1', confirmed: 420000, expected: 680000 },
    { label: 'Week 2', confirmed: 310000, expected: 520000 },
    { label: 'Week 3', confirmed: 180000, expected: 440000 },
    { label: 'Week 4', confirmed: 90000, expected: 380000 },
    { label: 'Week 5', confirmed: 0, expected: 290000 },
    { label: 'Week 6', confirmed: 0, expected: 210000 },
  ],
  portfolio_health: [
    { label: 'Avg Payment Days', value: '28', target: '30', ok: true },
    { label: 'Dispute Rate', value: '1.2%', target: '<5%', ok: true },
    { label: 'Advance Utilization', value: '25%', target: '<60%', ok: true },
    { label: 'Overdue Ratio', value: '8%', target: '<10%', ok: true },
  ],
};

const CATEGORIES = ['All', 'Route Intelligence', 'Customer Intel', 'Cash Alerts', 'Fleet Performance'];

function getSignalColor(type: string): string {
  switch (type.toUpperCase()) {
    case 'CRITICAL': return 'var(--status-danger)';
    case 'OPPORTUNITY': return 'var(--accent-primary)';
    case 'WARNING': return 'var(--status-warning)';
    case 'SUCCESS': return 'var(--status-success)';
    default: return 'var(--text-secondary)';
  }
}

export default function Insights() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    fetchData('api/v1/dashboard/insights/')
      .then((res: any) => {
        // API may return {signals:[]} or an array or null/404
        if (!res || typeof res !== 'object') {
          setData(MOCK_FALLBACK);
        } else if (Array.isArray(res)) {
          setData({ ...MOCK_FALLBACK, signals: res });
        } else if (res.signals) {
          setData(res);
        } else {
          // endpoint returned something unexpected — use mock
          setData(MOCK_FALLBACK);
        }
      })
      .catch(() => {
        setData(MOCK_FALLBACK);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredSignals = (data?.signals || []).filter((s: InsightSignal) =>
    selectedCategory === 'All' || s.category === selectedCategory
  );

  const cashflow = data?.cashflow || MOCK_FALLBACK.cashflow;
  const portfolioHealth = data?.portfolio_health || MOCK_FALLBACK.portfolio_health;
  const maxVal = Math.max(...(cashflow?.map(c => c.expected) || [800000]));
  const totalExpected = cashflow?.reduce((sum, c) => sum + c.expected, 0) || 0;
  const totalConfirmed = cashflow?.reduce((sum, c) => sum + c.confirmed, 0) || 0;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>AI Intelligence</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Insights & Forecasts</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>AI-powered recommendations and 90-day cash flow forecast.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* AI Signals */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>AGENT SIGNALS</div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 4,
                padding: '4px 8px'
              }}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {loading && (
            <>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="card" style={{ marginBottom: 12, padding: 16 }}>
                  <div style={{ height: 12, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 8, width: '30%' }} />
                  <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 8, width: '70%' }} />
                  <div style={{ height: 40, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ height: 24, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
                </div>
              ))}
            </>
          )}

          {!loading && filteredSignals.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Intelligence engine is analyzing your data — check back soon.
              </div>
            </div>
          )}

          {!loading && filteredSignals.map((s, i) => (
            <div key={i} className="card" style={{ marginBottom: 12, padding: 16, borderLeft: `2px solid ${getSignalColor(s.type)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: getSignalColor(s.type), letterSpacing: '0.08em' }}>{s.type}</span>
                {s.category && (
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{s.category}</span>
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>{s.body}</div>
              {s.action && (
                <button className="btn-action" style={{ fontSize: 10 }}>{s.action}</button>
              )}
            </div>
          ))}
        </div>

        {/* Cash flow forecast */}
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 12 }}>90-DAY CASH FLOW</div>

          {loading && (
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12 }} />
              <div style={{ height: 120, background: 'var(--bg-surface)', borderRadius: 4 }} />
            </div>
          )}

          {!loading && (
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Expected</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent-primary)' }}>
                  R {totalExpected.toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Confirmed</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
                  R {totalConfirmed.toLocaleString()}
                </span>
              </div>
              {cashflow?.map((row, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{row.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>R {(row.expected / 1000).toFixed(0)}K</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-surface-hover)', borderRadius: 1, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(row.expected / maxVal) * 100}%`, background: 'var(--border-active)', borderRadius: 1, position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${row.confirmed ? (row.confirmed / row.expected) * 100 : 0}%`, background: 'var(--accent-primary)', borderRadius: 1 }} />
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 10, color: 'var(--text-tertiary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 3, background: 'var(--accent-primary)', display: 'inline-block', borderRadius: 1 }}/>Confirmed</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 3, background: 'var(--border-active)', display: 'inline-block', borderRadius: 1 }}/>Expected</span>
              </div>
            </div>
          )}

          {/* Portfolio health */}
          {loading && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '50%' }} />
              <div style={{ height: 100, background: 'var(--bg-surface)', borderRadius: 4 }} />
            </div>
          )}

          {!loading && (
            <div className="card" style={{ padding: 20 }}>
              <div className="card-header" style={{ marginBottom: 16 }}><span className="card-title">Portfolio Health</span></div>
              {portfolioHealth?.map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>target {r.target}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: r.ok ? 'var(--accent-primary)' : 'var(--status-danger)' }}>{r.value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
