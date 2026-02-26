import { useNavigate } from "react-router-dom";
import { INVOICES, facilityInfo, getEligibleInvoices, getRiskDistribution, getTotalEligibleAmount } from "@/mocks/simple-invoice-data";
import { formatCurrency } from "@/lib/formatters";

const TIER_COLOR: Record<string, string> = {
  prime: 'var(--accent-primary)', standard: '#22c55e',
  elevated: 'var(--status-warning)', high: 'var(--status-danger)', ineligible: 'var(--text-tertiary)',
};
const TIER_FEE: Record<string, string> = {
  prime: '2.0%', standard: '2.5%', elevated: '3.5%', high: '4.5%', ineligible: 'N/A',
};
const tierEligible = (t: string) => t === 'prime' || t === 'standard';

export default function Capital() {
  const navigate = useNavigate();
  const eligible = getEligibleInvoices();
  const distribution = getRiskDistribution();
  const eligibleTotal = getTotalEligibleAmount();
  const outstanding = facilityInfo.outstandingAdvances;
  const available = facilityInfo.facilityLimit - outstanding;
  const utilization = Math.round((outstanding / facilityInfo.facilityLimit) * 100);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Capital</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Fast Pay</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Get paid early on eligible invoices. Binary YES/NO — no partial advances.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Available Capital', value: formatCurrency(available), sub: `of ${formatCurrency(facilityInfo.facilityLimit)} limit` },
          { label: 'Outstanding', value: formatCurrency(outstanding), sub: `${utilization}% utilization` },
          { label: 'Eligible Invoices', value: eligible.length, sub: 'ready for fast pay' },
          { label: 'Eligible Value', value: formatCurrency(eligibleTotal), sub: 'total available' },
        ].map(m => (
          <div key={m.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{m.label}</span></div>
            <div className="metric-value" style={{ fontSize: 20 }}>{m.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 24, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className="card-title">Risk Tiers</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>7-PILLAR ENGINE</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {(['prime', 'standard', 'elevated', 'high', 'ineligible'] as const).map(tier => (
            <div key={tier} style={{ padding: '10px 12px', background: 'var(--bg-surface-hover)', border: `1px solid ${tierEligible(tier) ? TIER_COLOR[tier] : 'var(--border-subtle)'}`, borderRadius: 2 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TIER_COLOR[tier], fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{tier}</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>{distribution[tier] || 0}</div>
              <div style={{ fontSize: 10, color: tierEligible(tier) ? TIER_COLOR[tier] : 'var(--status-danger)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {tierEligible(tier) ? '✓ FAST PAY' : '✗ NO'} · {TIER_FEE[tier]}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card table-card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">Fast Pay Eligible</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{eligible.length} INVOICES</span>
        </div>
        {eligible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>No eligible invoices. Complete deliveries with POD to unlock Fast Pay.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Invoice #</th><th>Customer</th><th>Amount</th><th>Tier</th><th>Fee</th><th>Net Advance</th><th className="text-right">Action</th></tr></thead>
            <tbody>
              {eligible.map(inv => {
                const feeNum = inv.tier === 'prime' ? 0.02 : 0.025;
                return (
                  <tr key={inv.id}>
                    <td className="mono">{inv.invoiceNumber}</td>
                    <td>{inv.customerName}</td>
                    <td>{formatCurrency(inv.amount)}</td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TIER_COLOR[inv.tier], background: 'var(--bg-surface-hover)', padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase' }}>{inv.tier}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{TIER_FEE[inv.tier]}</td>
                    <td style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(inv.amount * (1 - feeNum))}</td>
                    <td className="text-right"><button className="btn-action" style={{ fontSize: 10 }} onClick={() => navigate('/capital/request')}>REQUEST</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card table-card">
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">All Invoices — Risk Assessment</span>
        </div>
        <table className="data-table">
          <thead><tr><th>Invoice #</th><th>Customer</th><th>Amount</th><th>Status</th><th>Tier</th><th>Fast Pay</th><th className="text-right">Fee</th></tr></thead>
          <tbody>
            {INVOICES.map(inv => (
              <tr key={inv.id}>
                <td className="mono">{inv.invoiceNumber}</td>
                <td>{inv.customerName}</td>
                <td>{formatCurrency(inv.amount)}</td>
                <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>{inv.status}</span></td>
                <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TIER_COLOR[inv.tier], padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2, textTransform: 'uppercase' }}>{inv.tier}</span></td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: inv.fastPay ? 'var(--accent-primary)' : 'var(--status-danger)' }}>{inv.fastPay ? '✓ YES' : '✗ NO'}</td>
                <td className="text-right" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{TIER_FEE[inv.tier]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
