import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { INVOICES, facilityInfo } from "@/mocks/simple-invoice-data";
import { formatCurrency } from "@/lib/formatters";
import { fetchData } from "@/lib/api";

const TIER_COLOR: Record<string, string> = {
  prime: 'var(--accent-primary)', standard: 'var(--status-success)',
  elevated: 'var(--status-warning)', high: 'var(--status-danger)', ineligible: 'var(--text-tertiary)',
};
const TIER_FEE: Record<string, string> = {
  prime: '2.0%', standard: '2.5%', elevated: '3.5%', high: '4.5%', ineligible: 'N/A',
};
const tierEligible = (t: string) => t === 'prime' || t === 'standard';

// Mock active advances (invoices currently funded) - used as fallback
const MOCK_ACTIVE_ADVANCES = INVOICES
  .filter(i => i.status === 'SENT' && i.fastPay && i.tier === 'prime')
  .slice(0, 3)
  .map(i => ({
    ...i,
    advancedDate: '2026-02-10',
    advancedAmount: i.amount * 0.98,
    dueDate: '2026-03-10',
    fee: i.amount * 0.02,
  }));

export default function Capital() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [facility, setFacility] = useState<any>(null);
  const [advances, setAdvances] = useState<any[]>([]);
  const [eligibleInvoices, setEligibleInvoices] = useState<any[]>([]);

  // Fallback to mock data
  const mockEligible = INVOICES.filter(i => i.status === 'SENT' && i.fastPay && (i.tier === 'prime' || i.tier === 'standard'));
  const eligible = eligibleInvoices.length > 0 ? eligibleInvoices : mockEligible;

  // Calculate risk distribution from all invoices (mock or real)
  const allInvoices = eligibleInvoices.length > 0 ? eligibleInvoices : INVOICES;
  const distribution: Record<string, number> = allInvoices.reduce((acc: any, inv: any) => {
    const tier = inv.risk_tier || inv.tier || 'standard';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {});

  const eligibleTotal = eligible.reduce((sum, inv) => sum + (inv.amount || inv.total_amount || 0), 0);
  const outstanding = facility?.outstanding_advances || facilityInfo.outstandingAdvances;
  const available = (facility?.facility_limit || facilityInfo.facilityLimit) - outstanding;
  const utilization = Math.round((outstanding / (facility?.facility_limit || facilityInfo.facilityLimit)) * 100);
  const activeAdvances = advances.length > 0 ? advances : MOCK_ACTIVE_ADVANCES;

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load facility data
        const facilityData = await fetchData('/api/v1/facilities/');
        setFacility(Array.isArray(facilityData) ? facilityData[0] : facilityData);

        // Load advances
        const advancesData = await fetchData('/api/v1/advances/');
        setAdvances(Array.isArray(advancesData) ? advancesData.filter((a: any) => a.status === 'ACTIVE' || a.status === 'FUNDED') : []);

        // Load eligible invoices (SENT status + fastPay eligible)
        const invoicesData = await fetchData('/api/v1/invoices/?status=SENT');
        const eligible = Array.isArray(invoicesData) ? invoicesData.filter((inv: any) =>
          inv.fast_pay_eligible && (inv.risk_tier === 'prime' || inv.risk_tier === 'standard')
        ) : [];
        setEligibleInvoices(eligible);
      } catch (error) {
        console.error('Failed to load capital data, using mock fallback:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Capital</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Fast Pay Facility</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card" style={{ padding: 24 }}>
              <div style={{ height: 16, background: 'var(--bg-surface-hover)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
              <div style={{ height: 32, background: 'var(--bg-surface-hover)', borderRadius: 4, width: '40%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Capital</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Fast Pay Facility</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Early payment on eligible invoices — binary YES/NO, no partial advances.</div>
      </div>

      {/* Facility overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Available Capital', value: formatCurrency(available), sub: `of ${formatCurrency(facility?.facility_limit || facilityInfo.facilityLimit)} limit`, color: 'var(--status-success)' },
          { label: 'In Use', value: formatCurrency(outstanding), sub: `${utilization}% utilization`, color: 'var(--status-warning)' },
          { label: 'Eligible Invoices', value: eligible.length, sub: 'ready for fast pay', color: 'var(--accent-primary)' },
          { label: 'Eligible Value', value: formatCurrency(eligibleTotal), sub: 'total available', color: 'var(--text-primary)' },
        ].map(m => (
          <div key={m.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{m.label}</span></div>
            <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Facility utilization bar */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>FACILITY UTILIZATION</span>
          <span style={{ color: utilization > 75 ? 'var(--status-warning)' : 'var(--status-success)' }}>{utilization}% used</span>
        </div>
        <div style={{ background: 'var(--bg-surface)', borderRadius: 2, height: 8, width: '100%', overflow: 'hidden' }}>
          <div style={{ width: `${utilization}%`, height: '100%', background: utilization > 75 ? 'var(--status-warning)' : 'var(--accent-primary)', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
          <span>R 0</span>
          <span>{formatCurrency(facility?.facility_limit || facilityInfo.facilityLimit)} limit</span>
        </div>
      </div>

      {/* Risk tier summary */}
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

      {/* Active advances — currently in use */}
      {activeAdvances.length > 0 && (
        <div className="card table-card" style={{ marginBottom: 20 }}>
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">Active Advances</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{activeAdvances.length} IN USE · {formatCurrency(outstanding)} outstanding</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th><th>Customer</th><th>Invoice Amt</th><th>Advanced</th><th>Fee</th><th>Due</th><th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {activeAdvances.map(adv => (
                <tr key={adv.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/invoices/${adv.invoice_id || adv.id}`)}>
                  <td className="mono">{adv.invoice_number || adv.invoiceNumber}</td>
                  <td>{adv.customer_name || adv.customerName}</td>
                  <td className="mono">{formatCurrency(adv.invoice_amount || adv.amount)}</td>
                  <td className="mono" style={{ color: 'var(--accent-primary)' }}>{formatCurrency(adv.advanced_amount || adv.advancedAmount)}</td>
                  <td className="mono" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(adv.fee_amount || adv.fee)}</td>
                  <td className="mono">{adv.due_date || adv.dueDate}</td>
                  <td className="text-right"><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--status-warning)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>FUNDED</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Eligible invoices — can be used */}
      <div className="card table-card">
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">Eligible — Available to Draw</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{eligible.length} INVOICES · {formatCurrency(eligibleTotal)}</span>
        </div>
        {eligible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
            No eligible invoices. Complete deliveries with POD to unlock Fast Pay.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th><th>Customer</th><th>Amount</th><th>Tier</th><th>Fee</th><th>You Receive</th><th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {eligible.map(inv => {
                const tier = inv.risk_tier || inv.tier || 'standard';
                const amount = inv.total_amount || inv.amount || 0;
                const feeNum = tier === 'prime' ? 0.02 : 0.025;
                return (
                  <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/invoices/${inv.id}`)}>
                    <td className="mono">{inv.invoice_number || inv.invoiceNumber}</td>
                    <td>{inv.customer_name || inv.customerName}</td>
                    <td className="mono">{formatCurrency(amount)}</td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TIER_COLOR[tier], background: 'var(--bg-surface-hover)', padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase' }}>
                        {tier}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{TIER_FEE[tier]}</td>
                    <td style={{ color: 'var(--status-success)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatCurrency(amount * (1 - feeNum))}</td>
                    <td className="text-right" onClick={e => e.stopPropagation()}>
                      <button className="btn-action" style={{ fontSize: 10 }} onClick={() => navigate('/capital/request')}>REQUEST</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
