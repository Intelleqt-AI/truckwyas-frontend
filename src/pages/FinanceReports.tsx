import { useState, useEffect } from "react";
import { fetchData } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/formatters";

const TABS = [
  { id: 'pl', label: 'P&L' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'customer', label: 'Customer' },
  { id: 'aging', label: 'Aging' },
  { id: 'capital', label: 'Capital' },
];

export default function FinanceReports() {
  const [tab, setTab] = useState('pl');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [financeData, setFinanceData] = useState<any>(null);
  const [cashflowData, setCashflowData] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [agingData, setAgingData] = useState<any>(null);
  const [facilities, setFacilities] = useState<any>(null);
  const [advances, setAdvances] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [finance, cashflow, cust, aging, fac, adv] = await Promise.all([
          fetchData('api/v1/dashboard/finance/').catch(() => null),
          fetchData('api/v1/dashboard/cashflow/').catch(() => null),
          fetchData('api/v1/customers/').catch(() => []),
          fetchData('api/v1/invoices/aging/').catch(() => null),
          fetchData('api/v1/facilities/').catch(() => null),
          fetchData('api/v1/advances/').catch(() => []),
        ]);
        setFinanceData(finance);
        setCashflowData(cashflow);
        setCustomers(Array.isArray(cust) ? cust : (cust?.results || []));
        setAgingData(aging);
        const facList = Array.isArray(fac) ? fac : (fac?.results || []);
        setFacilities(facList[0] || null);
        setAdvances(Array.isArray(adv) ? adv : (adv?.results || []));
      } catch (err) {
        console.error('Failed to load finance reports:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const LoadingSkeleton = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="card" style={{ padding: 20 }}>
          <div style={{ height: 16, background: 'var(--bg-surface-hover)', borderRadius: 4, marginBottom: 12, width: '50%' }} />
          <div style={{ height: 24, background: 'var(--bg-surface-hover)', borderRadius: 4, width: '70%' }} />
        </div>
      ))}
    </div>
  );

  const ErrorState = () => (
    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ color: 'var(--status-danger)', marginBottom: 16, fontSize: 14 }}>Failed to load data</div>
      <button className="btn-action" onClick={() => window.location.reload()}>RETRY</button>
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
      {message}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Finance</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Reports</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Comprehensive financial analytics • Last updated: {new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button className="btn-action">↓ EXPORT</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: tab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '10px 16px',
              cursor: 'pointer',
              marginBottom: -1,
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? <LoadingSkeleton /> : error ? <ErrorState /> : (
        <>
          {/* TAB 1: P&L */}
          {tab === 'pl' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { label: 'Total Revenue', value: formatCurrency(financeData?.total_revenue || 0), color: 'var(--accent-primary)' },
                  { label: 'Total Expenses', value: formatCurrency(financeData?.total_expenses || 0), color: 'var(--status-danger)' },
                  { label: 'Net Margin %', value: formatPercent(financeData?.net_margin_percent || 0), color: 'var(--status-success)' },
                  { label: 'Net Profit', value: formatCurrency((financeData?.total_revenue || 0) - (financeData?.total_expenses || 0)), color: 'var(--text-primary)' },
                ].map(m => (
                  <div key={m.label} className="card metric-card">
                    <div className="card-header"><span className="card-title">{m.label}</span></div>
                    <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Expense breakdown */}
              {financeData?.expense_breakdown && Object.keys(financeData.expense_breakdown).length > 0 ? (
                <div className="card" style={{ padding: 20 }}>
                  <div className="card-header"><span className="card-title">Expense Breakdown by Category</span></div>
                  <table className="data-table" style={{ marginTop: 16 }}>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th className="text-right">Amount</th>
                        <th className="text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(financeData.expense_breakdown).map(([category, amount]: [string, any]) => (
                        <tr key={category}>
                          <td style={{ textTransform: 'capitalize' }}>{category.replace('_', ' ')}</td>
                          <td className="mono text-right">{formatCurrency(amount)}</td>
                          <td className="mono text-right">
                            {((amount / financeData.total_expenses) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No expense breakdown available" />
              )}
            </div>
          )}

          {/* TAB 2: Cash Flow */}
          {tab === 'cashflow' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {(() => {
                const forecast = cashflowData?.forecast || [];
                // Calculate next 30 days summary
                const next30Days = forecast.slice(0, 4); // ~4 weeks
                const totalIn = next30Days.reduce((sum: number, f: any) => sum + (f.expected_in || 0), 0);
                const totalOut = next30Days.reduce((sum: number, f: any) => sum + (f.expected_out || 0), 0);
                const netPosition = totalIn - totalOut;

                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                      {[
                        { label: 'Expected In (30d)', value: formatCurrency(totalIn), color: 'var(--status-success)' },
                        { label: 'Expected Out (30d)', value: formatCurrency(totalOut), color: 'var(--status-danger)' },
                        { label: 'Net Cash Position', value: formatCurrency(netPosition), color: netPosition >= 0 ? 'var(--accent-primary)' : 'var(--status-danger)' },
                      ].map(m => (
                        <div key={m.label} className="card metric-card">
                          <div className="card-header"><span className="card-title">{m.label}</span></div>
                          <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    {forecast.length > 0 ? (
                      <div className="card table-card">
                        <div className="card-header" style={{ marginBottom: 16 }}>
                          <span className="card-title">Weekly Cash Flow Forecast</span>
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                            Next {forecast.length} weeks
                          </span>
                        </div>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Period</th>
                              <th>Week Starting</th>
                              <th className="text-right">Expected In</th>
                              <th className="text-right">Expected Out</th>
                              <th className="text-right">Net</th>
                              <th className="text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {forecast.map((f: any, idx: number) => {
                              const net = (f.expected_in || 0) - (f.expected_out || 0);
                              return (
                                <tr key={idx}>
                                  <td className="mono">{f.period}</td>
                                  <td className="mono">{f.start_date}</td>
                                  <td className="mono text-right" style={{ color: 'var(--status-success)' }}>
                                    {formatCurrency(f.expected_in || 0)}
                                  </td>
                                  <td className="mono text-right" style={{ color: 'var(--status-danger)' }}>
                                    {formatCurrency(f.expected_out || 0)}
                                  </td>
                                  <td className="mono text-right" style={{
                                    color: net >= 0 ? 'var(--accent-primary)' : 'var(--status-danger)',
                                    fontWeight: 600
                                  }}>
                                    {formatCurrency(net)}
                                  </td>
                                  <td className="text-right">
                                    <span style={{
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: 10,
                                      color: net >= 0 ? 'var(--status-success)' : 'var(--status-danger)',
                                      padding: '2px 6px',
                                      background: 'var(--bg-surface-hover)',
                                      borderRadius: 2
                                    }}>
                                      {net >= 0 ? 'POSITIVE' : 'NEGATIVE'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState message="No cash flow forecast data available" />
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* TAB 3: Customer */}
          {tab === 'customer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Top customer metrics */}
              {(() => {
                const topCustomers = financeData?.top_customers || customers
                  .map((c: any) => ({
                    customer_id: c.id,
                    customer_name: c.name || c.customer_name,
                    revenue: c.total_revenue || 0,
                    invoice_count: c.invoice_count || 0
                  }))
                  .sort((a: any, b: any) => b.revenue - a.revenue)
                  .slice(0, 10);

                const totalRevenue = topCustomers.reduce((sum: number, c: any) => sum + (c.revenue || 0), 0);
                const totalInvoices = topCustomers.reduce((sum: number, c: any) => sum + (c.invoice_count || 0), 0);

                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                      {[
                        { label: 'Total Customers', value: customers.length, color: 'var(--text-primary)' },
                        { label: 'Top 10 Revenue', value: formatCurrency(totalRevenue), color: 'var(--accent-primary)' },
                        { label: 'Invoices (Top 10)', value: totalInvoices, color: 'var(--status-success)' },
                      ].map(m => (
                        <div key={m.label} className="card metric-card">
                          <div className="card-header"><span className="card-title">{m.label}</span></div>
                          <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Top customers ranked by revenue */}
                    <div className="card table-card">
                      <div className="card-header" style={{ marginBottom: 16 }}>
                        <span className="card-title">Top Customers by Revenue</span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                          Ranked by total revenue
                        </span>
                      </div>
                      {topCustomers.length > 0 ? (
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}>Rank</th>
                              <th>Customer Name</th>
                              <th className="text-right">Revenue</th>
                              <th className="text-right">Invoice Count</th>
                              <th className="text-right">Avg Payment Days</th>
                              <th className="text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topCustomers.map((cust: any, idx: number) => {
                              const matchingCustomer = customers.find((c: any) =>
                                c.id === cust.customer_id || c.name === cust.customer_name
                              );
                              const avgPaymentDays = matchingCustomer?.avg_payment_days || 0;
                              const dso = avgPaymentDays;

                              return (
                                <tr key={idx} style={{ cursor: 'pointer' }}>
                                  <td className="mono text-right" style={{
                                    color: idx < 3 ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                                    fontWeight: idx < 3 ? 600 : 400
                                  }}>
                                    #{idx + 1}
                                  </td>
                                  <td style={{ fontWeight: idx < 3 ? 500 : 400 }}>{cust.customer_name}</td>
                                  <td className="mono text-right" style={{
                                    color: 'var(--accent-primary)',
                                    fontWeight: 600
                                  }}>
                                    {formatCurrency(cust.revenue || 0)}
                                  </td>
                                  <td className="mono text-right">{cust.invoice_count || 0}</td>
                                  <td className="mono text-right" style={{
                                    color: dso > 60 ? 'var(--status-danger)' : dso > 30 ? 'var(--status-warning)' : 'var(--status-success)'
                                  }}>
                                    {dso}d
                                  </td>
                                  <td className="text-right">
                                    <span style={{
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: 10,
                                      color: dso <= 30 ? 'var(--status-success)' : dso <= 60 ? 'var(--status-warning)' : 'var(--status-danger)',
                                      padding: '2px 6px',
                                      background: 'var(--bg-surface-hover)',
                                      borderRadius: 2
                                    }}>
                                      {dso <= 30 ? 'EXCELLENT' : dso <= 60 ? 'GOOD' : 'WATCH'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <EmptyState message="No customer data available" />
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* TAB 4: Aging */}
          {tab === 'aging' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Header metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { label: 'Total Outstanding', value: formatCurrency(agingData?.summary?.total_outstanding || 0), color: 'var(--accent-primary)' },
                  { label: 'Overdue Amount', value: formatCurrency(agingData?.summary?.total_overdue || 0), color: 'var(--status-danger)' },
                  { label: 'DSO (Days)', value: Math.round(agingData?.summary?.dso || 0), color: 'var(--text-primary)' },
                ].map(m => (
                  <div key={m.label} className="card metric-card">
                    <div className="card-header"><span className="card-title">{m.label}</span></div>
                    <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Aging waterfall bars */}
              {(() => {
                const buckets = agingData?.buckets || [
                  { label: 'Current', amount: 0, count: 0, color: 'var(--status-success)' },
                  { label: '1-30 Days', amount: 0, count: 0, color: 'var(--status-warning)' },
                  { label: '31-60 Days', amount: 0, count: 0, color: 'var(--status-warning)' },
                  { label: '61-90 Days', amount: 0, count: 0, color: 'var(--status-danger)' },
                  { label: '90+ Days', amount: 0, count: 0, color: 'var(--status-danger)' },
                ];
                const totalAmount = buckets.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

                return (
                  <div className="card" style={{ padding: 24 }}>
                    <div className="card-header" style={{ marginBottom: 20 }}>
                      <span className="card-title">Aging Analysis</span>
                    </div>
                    {buckets.map((bucket: any, idx: number) => {
                      const pct = totalAmount > 0 ? (bucket.amount / totalAmount) * 100 : 0;
                      const colorMap: Record<string, string> = {
                        'Current': 'var(--status-success)',
                        '1-30 Days': 'var(--status-warning)',
                        '31-60 Days': '#ff8c00',
                        '61-90 Days': 'var(--status-danger)',
                        '90+ Days': '#8b0000'
                      };
                      const barColor = colorMap[bucket.label] || 'var(--text-secondary)';

                      return (
                        <div key={idx} style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div>
                              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{bucket.label}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>
                                ({bucket.count || 0} {(bucket.count || 0) === 1 ? 'invoice' : 'invoices'})
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                                {pct.toFixed(1)}%
                              </span>
                              <span style={{ fontSize: 15, fontWeight: 600, color: barColor, fontFamily: 'var(--font-mono)' }}>
                                {formatCurrency(bucket.amount || 0)}
                              </span>
                            </div>
                          </div>
                          <div style={{ height: 24, background: 'var(--bg-surface-hover)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: barColor,
                              borderRadius: 4,
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Overdue invoice list */}
              {agingData?.overdue_invoices && agingData.overdue_invoices.length > 0 ? (
                <div className="card table-card">
                  <div className="card-header" style={{ marginBottom: 16 }}>
                    <span className="card-title">Overdue Invoices</span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      {agingData.overdue_invoices.length} overdue
                    </span>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th className="text-right">Amount</th>
                        <th className="text-right">Due Date</th>
                        <th className="text-right">Days Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agingData.overdue_invoices.map((inv: any) => (
                        <tr key={inv.id}>
                          <td className="mono">{inv.invoice_number}</td>
                          <td>{inv.customer_name}</td>
                          <td className="mono text-right">{formatCurrency(inv.total_amount || 0)}</td>
                          <td className="mono text-right">{inv.due_date}</td>
                          <td className="mono text-right" style={{ color: 'var(--status-danger)' }}>
                            {inv.days_overdue || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No overdue invoices" />
              )}
            </div>
          )}

          {/* TAB 5: Capital */}
          {tab === 'capital' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { label: 'Facility Limit', value: formatCurrency(facilities?.facility_limit || 0), color: 'var(--accent-primary)' },
                  { label: 'Available', value: formatCurrency((facilities?.facility_limit || 0) - (facilities?.outstanding_advances || 0)), color: 'var(--status-success)' },
                  { label: 'In Use', value: formatCurrency(facilities?.outstanding_advances || 0), color: 'var(--status-warning)' },
                  { label: 'Advances This Month', value: advances.filter((a: any) => {
                    const date = new Date(a.created_at || a.advanced_date);
                    const now = new Date();
                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                  }).length, color: 'var(--text-primary)' },
                ].map(m => (
                  <div key={m.label} className="card metric-card">
                    <div className="card-header"><span className="card-title">{m.label}</span></div>
                    <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Fee summary */}
              <div className="card" style={{ padding: 20 }}>
                <div className="card-header"><span className="card-title">Fee Summary</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Total Fees Paid</div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(advances.reduce((sum: number, a: any) => sum + (a.fee_amount || 0), 0))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Avg Fee Rate</div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {advances.length > 0
                        ? ((advances.reduce((sum: number, a: any) => sum + (a.fee_amount || 0), 0) /
                            advances.reduce((sum: number, a: any) => sum + (a.advanced_amount || 0), 0)) * 100).toFixed(2)
                        : 0}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Total Advanced</div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(advances.reduce((sum: number, a: any) => sum + (a.advanced_amount || 0), 0))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Advances list */}
              {advances.length > 0 ? (
                <div className="card table-card">
                  <div className="card-header" style={{ marginBottom: 16 }}>
                    <span className="card-title">Recent Advances</span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      {advances.length} total
                    </span>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th className="text-right">Advanced</th>
                        <th className="text-right">Fee</th>
                        <th className="text-right">Date</th>
                        <th className="text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {advances.slice(0, 10).map((adv: any) => (
                        <tr key={adv.id}>
                          <td className="mono">{adv.invoice_number}</td>
                          <td>{adv.customer_name}</td>
                          <td className="mono text-right" style={{ color: 'var(--accent-primary)' }}>
                            {formatCurrency(adv.advanced_amount || 0)}
                          </td>
                          <td className="mono text-right">{formatCurrency(adv.fee_amount || 0)}</td>
                          <td className="mono text-right">{adv.advanced_date || adv.created_at?.slice(0, 10)}</td>
                          <td className="text-right">
                            <span style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 10,
                              color: adv.status === 'FUNDED' || adv.status === 'ACTIVE' ? 'var(--status-warning)' : 'var(--status-success)',
                              padding: '2px 6px',
                              background: 'var(--bg-surface-hover)',
                              borderRadius: 2
                            }}>
                              {adv.status || 'ACTIVE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No advances found" />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
