import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

export default function Capital() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facility, setFacility] = useState<any>(null);
  const [advances, setAdvances] = useState<any[]>([]);
  const [eligibleInvoices, setEligibleInvoices] = useState<any[]>([]);

  const eligibleTotal = eligibleInvoices.reduce((sum, inv) => sum + (inv.total_amount || inv.amount || 0), 0);
  const outstanding = facility?.outstanding_advances || 0;
  const facilityLimit = facility?.facility_limit || 1000000;
  const available = facilityLimit - outstanding;
  const utilization = Math.round((outstanding / facilityLimit) * 100);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load facility data
        const facilityData = await fetchData('/api/v1/facilities/');
        setFacility(Array.isArray(facilityData) ? facilityData[0] : facilityData);

        // Load active advances (FUNDED or ACTIVE status)
        const advancesData = await fetchData('/api/v1/advances/');
        const active = Array.isArray(advancesData) ? advancesData.filter((a: any) => a.status === 'ACTIVE' || a.status === 'FUNDED' || a.status === 'DISBURSED') : [];
        setAdvances(active);

        // Load eligible invoices - try fast_pay_eligible query param first
        try {
          const eligibleData = await fetchData('/api/v1/invoices/?fast_pay_eligible=true');
          const eligible = Array.isArray(eligibleData) ? eligibleData.filter((inv: any) =>
            (inv.risk_tier === 'prime' || inv.risk_tier === 'standard')
          ) : [];
          setEligibleInvoices(eligible);
        } catch {
          // Fallback: filter client-side
          const allInvoices = await fetchData('/api/v1/invoices/?status=SENT');
          const eligible = Array.isArray(allInvoices) ? allInvoices.filter((inv: any) =>
            inv.fast_pay_eligible && (inv.risk_tier === 'prime' || inv.risk_tier === 'standard')
          ) : [];
          setEligibleInvoices(eligible);
        }
      } catch (err) {
        console.error('Failed to load capital data:', err);
        setError('Failed to load capital data');
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
              <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
              <div style={{ height: 32, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ height: 120, background: 'var(--bg-surface)', borderRadius: 4 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Capital</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Fast Pay Facility</div>
        </div>
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ color: 'var(--status-danger)', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>{error}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Unable to load capital data. Please try again later.</div>
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
          { label: 'Available Capital', value: formatCurrency(available), sub: `of ${formatCurrency(facilityLimit)} limit`, color: 'var(--status-success)' },
          { label: 'In Use', value: formatCurrency(outstanding), sub: `${utilization}% utilization`, color: 'var(--status-warning)' },
          { label: 'Eligible Invoices', value: eligibleInvoices.length, sub: 'ready for fast pay', color: 'var(--accent-primary)' },
          { label: 'Eligible Value', value: formatCurrency(eligibleTotal), sub: 'total available', color: 'var(--text-primary)' },
        ].map(m => (
          <div key={m.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{m.label}</span></div>
            <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Facility utilization bar - meter visual */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>FACILITY METER</span>
          <span style={{ color: utilization > 75 ? 'var(--status-warning)' : 'var(--status-success)' }}>{utilization}% USED</span>
        </div>
        <div style={{ background: 'var(--bg-surface)', borderRadius: 2, height: 12, width: '100%', overflow: 'hidden', position: 'relative' }}>
          <div style={{
            width: `${utilization}%`,
            height: '100%',
            background: utilization > 90 ? 'var(--status-danger)' : utilization > 75 ? 'var(--status-warning)' : 'var(--accent-primary)',
            borderRadius: 2,
            transition: 'width 0.3s'
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
          <div>
            <div style={{ color: 'var(--status-danger)', fontWeight: 600 }}>OUTSTANDING</div>
            <div>{formatCurrency(outstanding)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>LIMIT</div>
            <div>{formatCurrency(facilityLimit)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--status-success)', fontWeight: 600 }}>AVAILABLE</div>
            <div>{formatCurrency(available)}</div>
          </div>
        </div>
      </div>

      {/* Active advances — currently in use */}
      {advances.length > 0 && (
        <div className="card table-card" style={{ marginBottom: 20 }}>
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">Active Advances</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{advances.length} IN USE · {formatCurrency(outstanding)} OUTSTANDING</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th><th>Customer</th><th>Invoice Amt</th><th>Advanced</th><th>Fee</th><th>Due</th><th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {advances.map(adv => (
                <tr key={adv.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/capital/advances/${adv.id}`)}>
                  <td className="mono">{adv.invoice_number || adv.invoiceNumber}</td>
                  <td>{adv.customer_name || adv.customerName}</td>
                  <td className="mono">{formatCurrency(adv.gross_amount || adv.invoice_amount || adv.amount)}</td>
                  <td className="mono" style={{ color: 'var(--accent-primary)' }}>{formatCurrency(adv.net_amount || adv.advanced_amount || adv.advancedAmount)}</td>
                  <td className="mono" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(adv.fee_amount || adv.fee)}</td>
                  <td className="mono">{adv.repayment_date || adv.due_date || adv.dueDate}</td>
                  <td className="text-right">
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: adv.status === 'DISBURSED' ? 'var(--status-success)' : 'var(--status-warning)',
                      padding: '2px 6px',
                      background: 'var(--bg-surface-hover)',
                      borderRadius: 2,
                      textTransform: 'uppercase'
                    }}>{adv.status || 'FUNDED'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fast Pay NOW — eligible invoices section */}
      <div className="card table-card">
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">Fast Pay NOW — Eligible Invoices</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{eligibleInvoices.length} INVOICES · {formatCurrency(eligibleTotal)} AVAILABLE</span>
        </div>
        {eligibleInvoices.length === 0 ? (
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
              {eligibleInvoices.map(inv => {
                const tier = inv.risk_tier || inv.tier || 'standard';
                const amount = inv.total_amount || inv.amount || 0;
                const feeNum = tier === 'prime' ? 0.02 : 0.025;
                const netPayout = amount * (1 - feeNum);
                return (
                  <tr key={inv.id}>
                    <td className="mono">{inv.invoice_number || inv.invoiceNumber}</td>
                    <td>{inv.customer_name || inv.customerName}</td>
                    <td className="mono">{formatCurrency(amount)}</td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TIER_COLOR[tier], background: 'var(--bg-surface-hover)', padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase' }}>
                        {tier}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{TIER_FEE[tier]}</td>
                    <td style={{ color: 'var(--status-success)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatCurrency(netPayout)}</td>
                    <td className="text-right">
                      <button
                        className="btn-action"
                        style={{ fontSize: 10, padding: '4px 12px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 2, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                        onClick={() => navigate(`/capital/request?invoice_id=${inv.id}`)}
                      >
                        REQUEST
                      </button>
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
