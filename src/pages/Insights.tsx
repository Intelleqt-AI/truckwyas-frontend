const SIGNALS = [
  { type: 'CRITICAL', title: 'Margin Leak — JHB-CPT', body: 'Fuel costs 12% above baseline on Truck 42. Reroute via N1 Alternate saves ~R 1,840/trip.', action: 'APPLY FIX', color: 'var(--status-danger)' },
  { type: 'OPPORTUNITY', title: 'Invoice Chasing — INV-2024-09', body: 'Client opened email 3x. Payment probability today: 85%. Recommend follow-up call.', action: 'CALL NOW', color: 'var(--accent-primary)' },
  { type: 'WARNING', title: '3 Trucks Idle — Depot 4', body: 'TRK-774, TRK-811, TRK-829 idle 18+ hours. Estimated revenue loss: R 54,000/day.', action: 'REASSIGN', color: 'var(--status-warning)' },
  { type: 'INFO', title: 'LogiCorp — New Load Available', body: 'CPT → JHB, 24T, R 48,000. Matches your fleet capacity. 3 competitors have quoted.', action: 'QUOTE', color: 'var(--text-secondary)' },
  { type: 'OPPORTUNITY', title: 'Fast Pay — 4 Invoices Ready', body: 'R 182,000 in eligible invoices. Advance at 2–2.5% fee. Cash in 4 hours.', action: 'FAST PAY', color: '#22c55e' },
];

const CASHFLOW = [
  { label: 'Week 1', confirmed: 420000, expected: 680000 },
  { label: 'Week 2', confirmed: 310000, expected: 520000 },
  { label: 'Week 3', confirmed: 180000, expected: 440000 },
  { label: 'Week 4', confirmed: 90000, expected: 380000 },
  { label: 'Week 5', confirmed: 0, expected: 290000 },
  { label: 'Week 6', confirmed: 0, expected: 210000 },
];

export default function Insights() {
  const maxVal = 800000;

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
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 12 }}>AGENT SIGNALS</div>
          {SIGNALS.map((s, i) => (
            <div key={i} className="card" style={{ marginBottom: 12, padding: 16, borderLeft: `2px solid ${s.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: s.color, letterSpacing: '0.08em' }}>{s.type}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>{s.body}</div>
              <button className="btn-action" style={{ fontSize: 10 }}>{s.action}</button>
            </div>
          ))}
        </div>

        {/* Cash flow forecast */}
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 12 }}>90-DAY CASH FLOW</div>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Expected</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent-primary)' }}>R 2,520,000</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Confirmed</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>R 1,000,000</span>
            </div>
            {CASHFLOW.map((row, i) => (
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

          {/* Portfolio health */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header" style={{ marginBottom: 16 }}><span className="card-title">Portfolio Health</span></div>
            {[
              { label: 'Avg Payment Days', value: '28', target: '30', ok: true },
              { label: 'Dispute Rate', value: '1.2%', target: '<5%', ok: true },
              { label: 'Advance Utilization', value: '25%', target: '<60%', ok: true },
              { label: 'Overdue Ratio', value: '8%', target: '<10%', ok: true },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>target {r.target}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: r.ok ? 'var(--accent-primary)' : 'var(--status-danger)' }}>{r.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
