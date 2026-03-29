import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/formatters";
import { fetchData, postData } from "@/lib/Api";

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
  const [requestingIds, setRequestingIds] = useState<Set<number>>(new Set());
  const [settlingIds, setSettlingIds] = useState<Set<number>>(new Set());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [invoiceErrors, setInvoiceErrors] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<'active' | 'eligible'>('eligible');

  const handleRequestAdvance = async (invoice: any) => {
    setRequestingIds(prev => new Set(prev).add(invoice.id));
    setSuccessMessage(null);
    setInvoiceErrors(prev => {
      const next = { ...prev };
      delete next[invoice.id];
      return next;
    });

    try {
      await postData({
        url: 'api/v1/advances/',
        data: {
          invoice_id: invoice.id,
        }
      });

      setSuccessMessage(`Advance request submitted for ${invoice.invoice_number}`);
      // Reload data
      const advancesData = await fetchData('api/v1/advances/');
      const advancesList = Array.isArray(advancesData) ? advancesData : (advancesData?.results || []);
      const active = advancesList.filter((a: any) => a.status === 'ACTIVE' || a.status === 'FUNDED' || a.status === 'DISBURSED');
      setAdvances(active);

      const eligibleData = await fetchData('api/v1/capital/eligible/');
      const eligible = eligibleData?.invoices || [];
      setEligibleInvoices(eligible);

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      const msg = err?.data?.error || err?.data?.reason || err?.data?.reasons?.[0] || err?.response?.data?.error || err?.response?.data?.reason || err?.message || 'Request failed';
      setInvoiceErrors(prev => ({ ...prev, [invoice.id]: msg }));
    } finally {
      setRequestingIds(prev => {
        const next = new Set(prev);
        next.delete(invoice.id);
        return next;
      });
    }
  };

  const handleSettleAdvance = async (advance: any) => {
    setSettlingIds(prev => new Set(prev).add(advance.id));
    setSuccessMessage(null);

    try {
      await postData({
        url: `/api/v1/advances/${advance.id}/settle/`,
        data: {}
      });

      setSuccessMessage(`Advance ${advance.invoice_number} settled successfully`);
      // Reload data
      const advancesData = await fetchData('api/v1/advances/');
      const advancesList = Array.isArray(advancesData) ? advancesData : (advancesData?.results || []);
      const active = advancesList.filter((a: any) => a.status === 'ACTIVE' || a.status === 'FUNDED' || a.status === 'DISBURSED');
      setAdvances(active);

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to settle advance:', err);
      const msg = err?.data?.error || err?.message || 'Failed to settle advance';
      setError(msg);
      setTimeout(() => setError(null), 4000);
    } finally {
      setSettlingIds(prev => {
        const next = new Set(prev);
        next.delete(advance.id);
        return next;
      });
    }
  };

  const eligibleTotal = eligibleInvoices.reduce((sum, inv) => sum + (inv.total_amount || inv.amount || 0), 0);
  const outstanding = facility?.outstanding_advances || 0;
  const facilityLimit = facility?.facility_limit || 1000000;
  const available = facilityLimit - outstanding;
  const utilization = Math.round((outstanding / facilityLimit) * 100);

  useEffect(() => {
    document.title = 'Capital - TruckWys';
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load facility data — paginated {count, results}
        const facilityData = await fetchData('api/v1/facilities/');
        const facilityList = Array.isArray(facilityData) ? facilityData : (facilityData?.results || []);
        setFacility(facilityList[0] || null);

        // Load active advances — paginated {count, results}
        const advancesData = await fetchData('api/v1/advances/');
        const advancesList = Array.isArray(advancesData) ? advancesData : (advancesData?.results || []);
        const active = advancesList.filter((a: any) => a.status === 'ACTIVE' || a.status === 'FUNDED' || a.status === 'DISBURSED');
        setAdvances(active);

        // Load eligible invoices from dedicated endpoint
        const eligibleData = await fetchData('api/v1/capital/eligible/');
        const eligible = eligibleData?.invoices || [];
        setEligibleInvoices(eligible);
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

      </div>

      {successMessage && (
        <div style={{
          background: 'var(--status-success)',
          color: 'var(--bg-deep)',
          padding: '12px 16px',
          borderRadius: 4,
          marginBottom: 16,
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}><polyline points="20 6 9 17 4 12"/></svg> {successMessage}
        </div>
      )}

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

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        {(['eligible', 'active'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: 'transparent', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase',
            fontWeight: activeTab === tab ? 600 : 400,
            padding: '12px 0', marginRight: 24, cursor: 'pointer', marginBottom: -1,
            transition: 'all 0.2s ease',
          }}>
            {tab === 'eligible' ? `ELIGIBLE (${eligibleInvoices.length})` : `ACTIVE (${advances.length})`}
          </button>
        ))}
      </div>

      {/* Active advances — currently in use */}
      {activeTab === 'active' && advances.length > 0 && (
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
                  <td className="text-right" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: adv.status === 'DISBURSED' ? 'var(--status-success)' : 'var(--status-warning)',
                      padding: '2px 6px',
                      background: 'var(--bg-surface-hover)',
                      borderRadius: 2,
                      textTransform: 'uppercase'
                    }}>{adv.status || 'FUNDED'}</span>
                    {adv.status === 'DISBURSED' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSettleAdvance(adv); }}
                        disabled={settlingIds.has(adv.id)}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--status-success)',
                          color: 'var(--status-success)',
                          padding: '4px 10px',
                          fontSize: 10,
                          fontFamily: 'var(--font-mono)',
                          letterSpacing: '0.05em',
                          borderRadius: 2,
                          cursor: settlingIds.has(adv.id) ? 'not-allowed' : 'pointer',
                          opacity: settlingIds.has(adv.id) ? 0.5 : 1,
                        }}
                      >
                        {settlingIds.has(adv.id) ? 'SETTLING...' : 'SETTLE'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fast Pay NOW — eligible invoices section */}
      {activeTab === 'eligible' && <div className="card table-card">
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">Fast Pay NOW — Eligible Invoices</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{eligibleInvoices.length} INVOICES · {formatCurrency(eligibleTotal)} AVAILABLE</span>
            <button onClick={() => navigate('/capital/risk-scores')} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '3px 10px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.06em' }}>RISK SCORES →</button>
          </div>
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
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <button
                          className="btn-action"
                          disabled={requestingIds.has(inv.id)}
                          style={{
                            fontSize: 10,
                            padding: '4px 12px',
                            background: requestingIds.has(inv.id) ? 'var(--border-subtle)' : 'var(--accent-primary)',
                            color: 'var(--btn-action-color)',
                            border: 'none',
                            borderRadius: 2,
                            cursor: requestingIds.has(inv.id) ? 'not-allowed' : 'pointer',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            opacity: requestingIds.has(inv.id) ? 0.6 : 1,
                          }}
                          onClick={() => handleRequestAdvance(inv)}
                        >
                          {requestingIds.has(inv.id) ? 'REQUESTING...' : 'REQUEST'}
                        </button>
                        {invoiceErrors[inv.id] && (
                          <div style={{
                            fontSize: 9,
                            color: 'var(--status-danger)',
                            fontFamily: 'var(--font-mono)',
                            textAlign: 'right',
                            maxWidth: 200,
                            lineHeight: 1.3,
                          }}>
                            {invoiceErrors[inv.id]}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>}
    </div>
  );
}
