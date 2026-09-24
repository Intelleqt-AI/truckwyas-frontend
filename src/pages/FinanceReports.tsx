import './table-heading-roles.css';
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Loader } from '@/components/Loader';

// Brand text roles (styling only): support 13/20, labels 13/20/500,
// section headings 16/24/600, controls 14/20, metrics 28/36/600 tabular.
const reportSupportText = { fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', letterSpacing: 'normal', textTransform: 'none' as const };
const reportLabelText = { ...reportSupportText, fontWeight: 500 };
const reportHeadingText = { fontFamily: 'var(--font-sans)', fontSize: 16, lineHeight: '24px', fontWeight: 600, margin: 0, letterSpacing: 'normal', textTransform: 'none' as const };
const reportMetricText = { fontFamily: 'var(--font-sans)', fontSize: 28, lineHeight: '36px', fontWeight: 600, letterSpacing: 'normal', fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'normal' as const, overflowWrap: 'anywhere' as const };
const reportControlText = { fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', letterSpacing: 'normal', textTransform: 'none' as const };

// Sentence-case a status/token for display: "FUNDED" → "Funded".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

const TABS = [
  { id: 'pl', label: 'P&L' },
  { id: 'cashflow', label: 'Cash flow' },
  { id: 'customer', label: 'Customer' },
  { id: 'aging', label: 'Aging' },
  { id: 'lanes', label: 'Lanes' },
  { id: 'capital', label: 'Capital' },
  { id: 'fastpay', label: 'Fast-pay' },
];

export default function FinanceReports() {
  const [tab, setTab] = useState('pl');

  // All report data is fetched + derived inside the queryFn so the result is
  // cached by TanStack Query and survives navigation — revisiting the page no
  // longer refires these 8 requests until the cache goes stale.
  const { data, isLoading: loading, isError } = useQuery({
    queryKey: ["finance-reports"],
    queryFn: async () => {
      const [finance, cashflow, cust, aging, fac, adv, lanes, fastpay] = await Promise.all([
        fetchData('api/v1/dashboard/finance/').catch(() => null),
        fetchData('api/v1/dashboard/cashflow/').catch(() => null),
        fetchData('api/v1/customers/').catch(() => []),
        fetchData('api/v1/invoices/aging/').catch(() => null),
        fetchData('api/v1/facilities/').catch(() => null),
        fetchData('api/v1/advances/').catch(() => []),
        fetchData('api/v1/reports/margin-by-lane/').catch(() => null),
        fetchData('api/v1/reports/fastpay-savings/').catch(() => null),
      ]);
      const facList = Array.isArray(fac) ? fac : (fac?.results || []);
      return {
        financeData: finance,
        cashflowData: cashflow,
        customers: Array.isArray(cust) ? cust : (cust?.results || []),
        agingData: aging,
        facilities: facList[0] || null,
        advances: Array.isArray(adv) ? adv : (adv?.results || []),
        laneData: lanes,
        fastpayData: fastpay,
      };
    },
  });

  // Cached data drives the view; defaults keep the first render safe.
  const error = isError ? 'Failed to load data' : null;
  const financeData = data?.financeData ?? null;
  const cashflowData = data?.cashflowData ?? null;
  const customers = data?.customers ?? [];
  const agingData = data?.agingData ?? null;
  const facilities = data?.facilities ?? null;
  const advances = data?.advances ?? [];
  const laneData = data?.laneData ?? null;
  const fastpayData = data?.fastpayData ?? null;

  const exportToCSV = () => {
    let csvContent = '';
    let filename = '';

    switch(tab) {
      case 'pl':
        filename = 'PL_Report.csv';
        csvContent = 'Metric,Value\n';
        csvContent += `Total Revenue,${financeData?.total_revenue || 0}\n`;
        csvContent += `Total Expenses,${financeData?.total_expenses || 0}\n`;
        csvContent += `Net Margin %,${financeData?.net_margin_percent || 0}\n`;
        csvContent += `Net Profit,${(financeData?.total_revenue || 0) - (financeData?.total_expenses || 0)}\n\n`;
        csvContent += 'Category,Amount\n';
        if (financeData?.expense_breakdown) {
          Object.entries(financeData.expense_breakdown).forEach(([category, amount]: [string, any]) => {
            csvContent += `${category},${amount}\n`;
          });
        }
        break;

      case 'cashflow':
        filename = 'Cashflow_Forecast.csv';
        csvContent = 'Period,Week Starting,Expected In,Expected Out,Net\n';
        (cashflowData?.forecast || []).forEach((f: any) => {
          const net = (f.expected_in || 0) - (f.expected_out || 0);
          csvContent += `${f.period},${f.start_date},${f.expected_in || 0},${f.expected_out || 0},${net}\n`;
        });
        break;

      case 'customer':
        filename = 'Customer_Report.csv';
        csvContent = 'Rank,Customer Name,Revenue,Invoice Count,Avg Payment Days\n';
        const topCustomers = financeData?.top_customers || customers
          .map((c: any) => ({ customer_name: c.name || c.customer_name, revenue: c.total_revenue || 0, invoice_count: c.invoice_count || 0 }))
          .sort((a: any, b: any) => b.revenue - a.revenue)
          .slice(0, 10);
        topCustomers.forEach((c: any, idx: number) => {
          const matchingCustomer = customers.find((cust: any) => cust.name === c.customer_name);
          csvContent += `${idx + 1},${c.customer_name},${c.revenue},${c.invoice_count},${matchingCustomer?.avg_payment_days || 0}\n`;
        });
        break;

      case 'aging':
        filename = 'Aging_Report.csv';
        csvContent = 'Category,Amount,Count,Percentage\n';
        const totalAmount = (agingData?.buckets || []).reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
        (agingData?.buckets || []).forEach((b: any) => {
          const pct = totalAmount > 0 ? ((b.amount / totalAmount) * 100).toFixed(1) : '0.0';
          csvContent += `${b.label},${b.amount || 0},${b.count || 0},${pct}\n`;
        });
        break;

      case 'capital':
        filename = 'Capital_Report.csv';
        csvContent = 'Invoice #,Customer,Advanced,Fee,Date,Status\n';
        advances.slice(0, 10).forEach((adv: any) => {
          csvContent += `${adv.invoice_number},${adv.customer_name},${adv.advanced_amount || 0},${adv.fee_amount || 0},${adv.advanced_date || adv.created_at?.slice(0, 10)},${adv.status || 'ACTIVE'}\n`;
        });
        break;

      case 'lanes':
        filename = 'Margin_By_Lane.csv';
        csvContent = 'Lane,Loads,Revenue,Est Cost,Est Margin,Margin %,Avg Distance (km),Revenue/km\n';
        (laneData?.lanes || []).forEach((l: any) => {
          csvContent += `"${l.lane}",${l.loads},${l.revenue || 0},${l.est_cost ?? ''},${l.est_margin ?? ''},${l.margin_pct ?? ''},${l.avg_distance_km ?? ''},${l.revenue_per_km ?? ''}\n`;
        });
        break;

      case 'fastpay':
        filename = 'FastPay_Value.csv';
        csvContent = 'Metric,Value\n';
        csvContent += `Advances Settled/Disbursed,${fastpayData?.count || 0}\n`;
        csvContent += `Cash Accelerated,${fastpayData?.cash_accelerated || 0}\n`;
        csvContent += `Avg Days Early,${fastpayData?.avg_days_early || 0}\n`;
        csvContent += `Total Fees,${fastpayData?.total_fees || 0}\n`;
        csvContent += `Avg Fee %,${fastpayData?.avg_fee_pct || 0}\n`;
        csvContent += `Effective APR %,${fastpayData?.effective_apr ?? ''}\n`;
        break;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const LoadingSkeleton = () => (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
      <Loader size={32} />
    </div>
  );

  const ErrorState = () => (
    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ color: 'var(--status-danger)', marginBottom: 16, fontSize: 14 }}>Failed to load data</div>
      <button className="btn-action" onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="card" style={{ ...reportSupportText, padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
      {message}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ ...reportSupportText, color: 'var(--text-tertiary)', marginBottom: 4 }}>Finance</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, lineHeight: '28px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Reports</h1>
            <div style={{ ...reportSupportText, color: 'var(--text-secondary)', marginTop: 4 }}>
              Comprehensive financial analytics • Last updated: {new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button className="btn-action" onClick={exportToCSV}>↓ Export CSV</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', marginBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              ...reportControlText,
              color: tab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: tab === t.id ? 500 : 400,
              padding: '12px 0',
              marginRight: 24,
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { label: 'Total revenue', value: formatCurrency(financeData?.total_revenue || 0), color: 'var(--accent-primary)' },
                  { label: 'Total expenses', value: formatCurrency(financeData?.total_expenses || 0), color: 'var(--status-danger)' },
                  { label: 'Net margin %', value: formatPercent(financeData?.net_margin_percent || 0), color: 'var(--status-success)' },
                  { label: 'Net profit', value: formatCurrency((financeData?.total_revenue || 0) - (financeData?.total_expenses || 0)), color: 'var(--text-primary)' },
                ].map(m => (
                  <div key={m.label} className="card metric-card">
                    <div className="card-header"><span className="card-title" style={reportLabelText}>{m.label}</span></div>
                    <div className="metric-value" style={{ ...reportMetricText, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Monthly Trend Chart - recharts ComposedChart */}
              {financeData?.monthly_trend && financeData.monthly_trend.length > 0 ? (
                <div className="card" style={{ padding: 20 }}>
                  <div className="card-header">
                    <h2 className="card-title" style={reportHeadingText}>Revenue vs expenses trend (last 12 months)</h2>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 20, height: 2, background: 'var(--accent-primary)', display: 'inline-block', borderRadius: 1 }}/>Revenue
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 20, height: 2, background: 'var(--status-danger)', display: 'inline-block', borderRadius: 1, opacity: 0.7 }}/>Expenses
                      </span>
                    </div>
                  </div>
                  {(() => {
                    const trend = financeData.monthly_trend.map((m: any) => ({
                      ...m,
                      monthLabel: m.month?.slice(5) || ''
                    }));

                    return (
                      <>
                        <ResponsiveContainer width="100%" height={220} style={{ marginTop: 16 }}>
                          <ComposedChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="revenueGradientPL" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis
                              dataKey="monthLabel"
                              stroke="var(--text-tertiary)"
                              style={{ ...reportSupportText }}
                            />
                            <YAxis
                              stroke="var(--text-tertiary)"
                              style={{ ...reportSupportText }}
                              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                            />
                            <Tooltip
                              contentStyle={{ ...reportSupportText, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
                              formatter={(value: any, name: string) => {
                                if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                                if (name === 'expenses') return [formatCurrency(value), 'Expenses'];
                                return [value, name];
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="revenue"
                              fill="url(#revenueGradientPL)"
                              stroke="var(--accent-primary)"
                              strokeWidth={2}
                              isAnimationActive={true}
                            />
                            <Line
                              type="monotone"
                              dataKey="expenses"
                              stroke="var(--status-danger)"
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={false}
                              isAnimationActive={true}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </>
                    );
                  })()}
                </div>
              ) : null}

              {/* Expense breakdown */}
              {financeData?.expense_breakdown && Object.keys(financeData.expense_breakdown).length > 0 ? (
                <div className="card" style={{ padding: 20 }}>
                  <div className="card-header"><h2 className="card-title" style={reportHeadingText}>Expense breakdown by category</h2></div>
                  <table className="data-table table-heading-roles" style={{ marginTop: 16 }}>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th className="text-right">Amount</th>
                        <th className="text-right">% of total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(financeData.expense_breakdown).map(([category, amount]: [string, any]) => (
                        <tr key={category}>
                          <td style={reportSupportText}>{formatStatus(category)}</td>
                          <td className="mono text-right" style={{ ...reportSupportText, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(amount)}</td>
                          <td className="mono text-right" style={{ ...reportSupportText, fontVariantNumeric: 'tabular-nums' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                        { label: 'Expected in (30d)', value: formatCurrency(totalIn), color: 'var(--status-success)' },
                        { label: 'Expected out (30d)', value: formatCurrency(totalOut), color: 'var(--status-danger)' },
                        { label: 'Net cash position', value: formatCurrency(netPosition), color: netPosition >= 0 ? 'var(--accent-primary)' : 'var(--status-danger)' },
                      ].map(m => (
                        <div key={m.label} className="card metric-card">
                          <div className="card-header"><span className="card-title" style={reportLabelText}>{m.label}</span></div>
                          <div className="metric-value" style={{ ...reportMetricText, color: m.color }}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    {forecast.length > 0 ? (
                      <div className="card table-card">
                        <div className="card-header" style={{ marginBottom: 16 }}>
                          <h2 className="card-title" style={reportHeadingText}>Weekly cash flow forecast</h2>
                          <span style={{ ...reportSupportText, color: 'var(--text-tertiary)' }}>
                            Next {forecast.length} weeks
                          </span>
                        </div>
                        <table className="data-table table-heading-roles">
                          <thead>
                            <tr>
                              <th>Period</th>
                              <th>Week starting</th>
                              <th className="text-right">Expected in</th>
                              <th className="text-right">Expected out</th>
                              <th className="text-right">Net</th>
                              <th className="text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {forecast.map((f: any, idx: number) => {
                              const net = (f.expected_in || 0) - (f.expected_out || 0);
                              return (
                                <tr key={idx}>
                                  <td className="mono" style={reportSupportText}>{f.period}</td>
                                  <td className="mono" style={reportSupportText}>{f.start_date}</td>
                                  <td className="mono text-right" style={{ ...reportSupportText, fontVariantNumeric: 'tabular-nums', color: 'var(--status-success)' }}>
                                    {formatCurrency(f.expected_in || 0)}
                                  </td>
                                  <td className="mono text-right" style={{ ...reportSupportText, fontVariantNumeric: 'tabular-nums', color: 'var(--status-danger)' }}>
                                    {formatCurrency(f.expected_out || 0)}
                                  </td>
                                  <td className="mono text-right" style={{
                                    ...reportSupportText,
                                    fontVariantNumeric: 'tabular-nums',
                                    color: net >= 0 ? 'var(--accent-primary)' : 'var(--status-danger)',
                                    fontWeight: 600
                                  }}>
                                    {formatCurrency(net)}
                                  </td>
                                  <td className="text-right">
                                    <span style={{
                                      ...reportSupportText,
                                      color: net >= 0 ? 'var(--status-success)' : 'var(--status-danger)',
                                      padding: '2px 6px',
                                      background: 'var(--bg-surface-hover)',
                                      borderRadius: 4,
                                      display: 'inline-block',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {net >= 0 ? 'Positive' : 'Negative'}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                        { label: 'Total customers', value: customers.length, color: 'var(--text-primary)' },
                        { label: 'Top 10 revenue', value: formatCurrency(totalRevenue), color: 'var(--accent-primary)' },
                        { label: 'Invoices (top 10)', value: totalInvoices, color: 'var(--status-success)' },
                      ].map(m => (
                        <div key={m.label} className="card metric-card">
                          <div className="card-header"><span className="card-title" style={reportLabelText}>{m.label}</span></div>
                          <div className="metric-value" style={{ ...reportMetricText, color: m.color }}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Top 10 Customers BarChart */}
                    {topCustomers.length > 0 && (
                      <div className="card" style={{ padding: 20 }}>
                        <div className="card-header" style={{ marginBottom: 16 }}>
                          <h2 className="card-title" style={reportHeadingText}>Top 10 customers by revenue</h2>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart
                            data={topCustomers.slice(0, 10)}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                          >
                            <XAxis
                              type="number"
                              stroke="var(--text-tertiary)"
                              style={{ ...reportSupportText }}
                              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                            />
                            <YAxis
                              type="category"
                              dataKey="customer_name"
                              stroke="var(--text-tertiary)"
                              style={{ ...reportSupportText }}
                              width={110}
                            />
                            <Tooltip
                              contentStyle={{ ...reportSupportText, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
                              formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                            />
                            <Bar dataKey="revenue" fill="var(--accent-primary)" isAnimationActive={true} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Top customers ranked by revenue */}
                    <div className="card table-card">
                      <div className="card-header" style={{ marginBottom: 16 }}>
                        <h2 className="card-title" style={reportHeadingText}>Top customers by revenue</h2>
                        <span style={{ ...reportSupportText, color: 'var(--text-tertiary)' }}>
                          Ranked by total revenue
                        </span>
                      </div>
                      {topCustomers.length > 0 ? (
                        <table className="data-table table-heading-roles">
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}>Rank</th>
                              <th>Customer name</th>
                              <th className="text-right">Revenue</th>
                              <th className="text-right">Invoice count</th>
                              <th className="text-right">Avg payment days</th>
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
                                    ...reportSupportText,
                                    color: idx < 3 ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                                    fontWeight: idx < 3 ? 600 : 400
                                  }}>
                                    #{idx + 1}
                                  </td>
                                  <td style={{ fontWeight: idx < 3 ? 500 : 400, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cust.customer_name}>{cust.customer_name}</td>
                                  <td className="mono text-right" style={{
                                    ...reportSupportText,
                                    fontVariantNumeric: 'tabular-nums',
                                    color: 'var(--accent-primary)',
                                    fontWeight: 600
                                  }}>
                                    {formatCurrency(cust.revenue || 0)}
                                  </td>
                                  <td className="mono text-right" style={{ ...reportSupportText, fontVariantNumeric: 'tabular-nums' }}>{cust.invoice_count || 0}</td>
                                  <td className="mono text-right" style={{
                                    ...reportSupportText,
                                    fontVariantNumeric: 'tabular-nums',
                                    color: dso > 60 ? 'var(--status-danger)' : dso > 30 ? 'var(--status-warning)' : 'var(--status-success)'
                                  }}>
                                    {dso}d
                                  </td>
                                  <td className="text-right">
                                    <span style={{
                                      ...reportSupportText,
                                      color: dso <= 30 ? 'var(--status-success)' : dso <= 60 ? 'var(--status-warning)' : 'var(--status-danger)',
                                      padding: '2px 6px',
                                      background: 'var(--bg-surface-hover)',
                                      borderRadius: 4,
                                      display: 'inline-block',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {dso <= 30 ? 'Excellent' : dso <= 60 ? 'Good' : 'Watch'}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Header metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { label: 'Total outstanding', value: formatCurrency(agingData?.summary?.total_outstanding || 0), color: 'var(--accent-primary)' },
                  { label: 'Overdue amount', value: formatCurrency(agingData?.summary?.total_overdue || 0), color: 'var(--status-danger)' },
                  { label: 'DSO (days)', value: Math.round(agingData?.summary?.dso || 0), color: 'var(--text-primary)' },
                ].map(m => (
                  <div key={m.label} className="card metric-card">
                    <div className="card-header"><span className="card-title" style={reportLabelText}>{m.label}</span></div>
                    <div className="metric-value" style={{ ...reportMetricText, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Aging Analysis - Bars + PieChart */}
              {(() => {
                const buckets = agingData?.buckets || [
                  { label: 'Current', amount: 0, count: 0, color: 'var(--status-success)' },
                  { label: '1-30 Days', amount: 0, count: 0, color: 'var(--status-warning)' },
                  { label: '31-60 Days', amount: 0, count: 0, color: 'var(--status-warning)' },
                  { label: '61-90 Days', amount: 0, count: 0, color: 'var(--status-danger)' },
                  { label: '90+ Days', amount: 0, count: 0, color: 'var(--status-danger)' },
                ];
                const totalAmount = buckets.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
                const colorMap: Record<string, string> = {
                  'Current': 'var(--status-success)',
                  '1-30 Days': 'var(--status-warning)',
                  '31-60 Days': 'var(--status-warning)',
                  '61-90 Days': 'var(--status-danger)',
                  '90+ Days': 'var(--status-danger)'
                };

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 20 }}>
                    {/* Bar Chart */}
                    <div className="card" style={{ padding: 20 }}>
                      <div className="card-header" style={{ marginBottom: 16 }}>
                        <h2 className="card-title" style={reportHeadingText}>Aging analysis</h2>
                      </div>
                      {buckets.map((bucket: any, idx: number) => {
                        const pct = totalAmount > 0 ? (bucket.amount / totalAmount) * 100 : 0;
                        const barColor = colorMap[bucket.label] || 'var(--text-secondary)';

                        return (
                          <div key={idx} style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              <div>
                                <span style={{ ...reportSupportText, color: 'var(--text-primary)', fontWeight: 500 }}>{bucket.label}</span>
                                <span style={{ ...reportSupportText, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                                  ({bucket.count || 0} {(bucket.count || 0) === 1 ? 'invoice' : 'invoices'})
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                                <span style={{ ...reportSupportText, color: 'var(--text-tertiary)' }}>
                                  {pct.toFixed(1)}%
                                </span>
                                <span style={{ ...reportSupportText, fontSize: 15, fontWeight: 600, color: barColor, fontVariantNumeric: 'tabular-nums' }}>
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

                    {/* PieChart (Donut) */}
                    <div className="card" style={{ padding: 20 }}>
                      <div className="card-header" style={{ marginBottom: 16 }}>
                        <h2 className="card-title" style={reportHeadingText}>Distribution</h2>
                      </div>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={buckets.filter(b => b.amount > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            dataKey="amount"
                            isAnimationActive={true}
                          >
                            {buckets.filter(b => b.amount > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={colorMap[entry.label] || '#888'} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ ...reportSupportText, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
                            formatter={(value: any, name: string, props: any) => [
                              formatCurrency(value),
                              props.payload.label
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}

              {/* Overdue invoice list */}
              {agingData?.overdue_invoices && agingData.overdue_invoices.length > 0 ? (
                <div className="card table-card">
                  <div className="card-header" style={{ marginBottom: 16 }}>
                    <h2 className="card-title" style={reportHeadingText}>Overdue invoices</h2>
                    <span style={{ ...reportSupportText, color: 'var(--text-tertiary)' }}>
                      {agingData.overdue_invoices.length} overdue
                    </span>
                  </div>
                  <table className="data-table table-heading-roles">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th className="text-right">Amount</th>
                        <th className="text-right">Due date</th>
                        <th className="text-right">Days overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agingData.overdue_invoices.map((inv: any) => (
                        <tr key={inv.id}>
                          <td className="mono" style={{ whiteSpace: 'nowrap' }}>{inv.invoice_number}</td>
                          <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inv.customer_name}>{inv.customer_name}</td>
                          <td className="mono text-right" style={{ ...reportSupportText, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatCurrency(inv.total_amount || 0)}</td>
                          <td className="mono text-right" style={{ ...reportSupportText, whiteSpace: 'nowrap' }}>{inv.due_date}</td>
                          <td className="mono text-right" style={{ ...reportSupportText, fontVariantNumeric: 'tabular-nums', color: 'var(--status-danger)' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { label: 'Facility limit', value: formatCurrency(facilities?.facility_limit || 0), color: 'var(--accent-primary)' },
                  { label: 'Available', value: formatCurrency((facilities?.facility_limit || 0) - (facilities?.outstanding_advances || 0)), color: 'var(--status-success)' },
                  { label: 'In use', value: formatCurrency(facilities?.outstanding_advances || 0), color: 'var(--status-warning)' },
                  { label: 'Advances this month', value: advances.filter((a: any) => {
                    const date = new Date(a.created_at || a.advanced_date);
                    const now = new Date();
                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                  }).length, color: 'var(--text-primary)' },
                ].map(m => (
                  <div key={m.label} className="card metric-card">
                    <div className="card-header"><span className="card-title" style={reportLabelText}>{m.label}</span></div>
                    <div className="metric-value" style={{ ...reportMetricText, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Fee summary */}
              <div className="card" style={{ padding: 20 }}>
                <div className="card-header"><h2 className="card-title" style={reportHeadingText}>Fee summary</h2></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
                  <div>
                    <div style={{ ...reportSupportText, color: 'var(--text-tertiary)', marginBottom: 4 }}>Total fees paid</div>
                    <div style={{ fontSize: 18, lineHeight: '28px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(advances.reduce((sum: number, a: any) => sum + (a.fee_amount || 0), 0))}
                    </div>
                  </div>
                  <div>
                    <div style={{ ...reportSupportText, color: 'var(--text-tertiary)', marginBottom: 4 }}>Avg fee rate</div>
                    <div style={{ fontSize: 18, lineHeight: '28px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>
                      {advances.length > 0
                        ? ((advances.reduce((sum: number, a: any) => sum + (a.fee_amount || 0), 0) /
                            advances.reduce((sum: number, a: any) => sum + (a.advanced_amount || 0), 0)) * 100).toFixed(2)
                        : 0}%
                    </div>
                  </div>
                  <div>
                    <div style={{ ...reportSupportText, color: 'var(--text-tertiary)', marginBottom: 4 }}>Total advanced</div>
                    <div style={{ fontSize: 18, lineHeight: '28px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(advances.reduce((sum: number, a: any) => sum + (a.advanced_amount || 0), 0))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Advances Over Time AreaChart */}
              {advances.length > 0 && (() => {
                // Group advances by month
                const advancesByMonth = advances.reduce((acc: any, adv: any) => {
                  const date = new Date(adv.advanced_date || adv.created_at);
                  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  if (!acc[monthKey]) {
                    acc[monthKey] = { month: monthKey, amount: 0, count: 0 };
                  }
                  acc[monthKey].amount += adv.advanced_amount || 0;
                  acc[monthKey].count += 1;
                  return acc;
                }, {});
                const chartData = Object.values(advancesByMonth).sort((a: any, b: any) => a.month.localeCompare(b.month)).slice(-6);

                return chartData.length > 0 ? (
                  <div className="card" style={{ padding: 20 }}>
                    <div className="card-header" style={{ marginBottom: 16 }}>
                      <h2 className="card-title" style={reportHeadingText}>Advances over time (last 6 months)</h2>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="advancesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="month"
                          stroke="var(--text-tertiary)"
                          style={{ ...reportSupportText }}
                          tickFormatter={(value) => value.slice(5)}
                        />
                        <YAxis
                          stroke="var(--text-tertiary)"
                          style={{ ...reportSupportText }}
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{ ...reportSupportText, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
                          formatter={(value: any, name: string) => [formatCurrency(value), 'Advances']}
                        />
                        <Area
                          type="monotone"
                          dataKey="amount"
                          fill="url(#advancesGradient)"
                          stroke="var(--accent-primary)"
                          strokeWidth={2}
                          isAnimationActive={true}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : null;
              })()}

              {/* Advances list */}
              {advances.length > 0 ? (
                <div className="card table-card">
                  <div className="card-header" style={{ marginBottom: 16 }}>
                    <h2 className="card-title" style={reportHeadingText}>Recent advances</h2>
                    <span style={{ ...reportSupportText, color: 'var(--text-tertiary)' }}>
                      {advances.length} total
                    </span>
                  </div>
                  <table className="data-table table-heading-roles">
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
                          <td className="mono" style={{ whiteSpace: 'nowrap' }}>{adv.invoice_number}</td>
                          <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={adv.customer_name}>{adv.customer_name}</td>
                          <td className="mono text-right" style={{ ...reportSupportText, fontVariantNumeric: 'tabular-nums', color: 'var(--accent-primary)' }}>
                            {formatCurrency(adv.advanced_amount || 0)}
                          </td>
                          <td className="mono text-right" style={{ ...reportSupportText, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(adv.fee_amount || 0)}</td>
                          <td className="mono text-right" style={reportSupportText}>{adv.advanced_date || adv.created_at?.slice(0, 10)}</td>
                          <td className="text-right">
                            <span style={{
                              ...reportSupportText,
                              color: adv.status === 'FUNDED' || adv.status === 'ACTIVE' ? 'var(--status-warning)' : 'var(--status-success)',
                              padding: '2px 6px',
                              background: 'var(--bg-surface-hover)',
                              borderRadius: 4,
                              display: 'inline-block',
                              whiteSpace: 'nowrap'
                            }}>
                              {formatStatus(adv.status || 'ACTIVE')}
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

          {tab === 'lanes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { label: 'Lanes', value: laneData?.summary?.lane_count || 0, color: 'var(--accent-primary)' },
                  { label: 'Lane revenue', value: formatCurrency(laneData?.summary?.total_revenue || 0), color: 'var(--text-primary)' },
                  { label: 'Best margin', value: laneData?.summary?.best_lane ? formatPercent(laneData.summary.best_lane.margin_pct) : '—', color: 'var(--status-success)' },
                  { label: 'Worst margin', value: laneData?.summary?.worst_lane ? formatPercent(laneData.summary.worst_lane.margin_pct) : '—', color: 'var(--status-danger)' },
                ].map(m => (
                  <div key={m.label} className="card metric-card">
                    <div className="card-header"><span className="card-title" style={reportLabelText}>{m.label}</span></div>
                    <div className="metric-value" style={{ ...reportMetricText, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {(laneData?.lanes || []).length > 0 ? (
                <div className="card" style={{ padding: 20 }}>
                  <div className="card-header" style={{ marginBottom: 8 }}>
                    <h2 className="card-title" style={reportHeadingText}>Margin by lane</h2>
                  </div>
                  <div style={{ ...reportSupportText, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                    True cost (fuel · driver · tolls · wear, deadheaded) — same engine as the quoting tool. Margin shown where distance is known.
                  </div>
                  <table className="data-table table-heading-roles">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Lane</th>
                        <th style={{ textAlign: 'right' }}>Loads</th>
                        <th style={{ textAlign: 'right' }}>Revenue</th>
                        <th style={{ textAlign: 'right' }}>Est. margin</th>
                        <th style={{ textAlign: 'right' }}>Margin %</th>
                        <th style={{ textAlign: 'right' }}>R / km</th>
                      </tr>
                    </thead>
                    <tbody>
                      {laneData.lanes.map((l: any, idx: number) => {
                        const mpct = l.margin_pct;
                        const mColor = mpct == null ? 'var(--text-tertiary)'
                          : mpct < 0 ? 'var(--status-danger)'
                          : mpct < 15 ? 'var(--status-warning)'
                          : 'var(--status-success)';
                        return (
                          <tr key={idx}>
                            <td style={{ color: 'var(--text-primary)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.lane}>{l.lane}</td>
                            <td style={{ ...reportSupportText, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{l.loads}</td>
                            <td style={{ ...reportSupportText, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{formatCurrency(l.revenue || 0)}</td>
                            <td style={{ ...reportSupportText, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{l.est_margin == null ? '—' : formatCurrency(l.est_margin)}</td>
                            <td style={{ ...reportSupportText, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: mColor }}>{mpct == null ? '—' : formatPercent(mpct)}</td>
                            <td style={{ ...reportSupportText, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-tertiary)' }}>{l.revenue_per_km == null ? '—' : formatCurrency(l.revenue_per_km)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No delivered loads to analyse yet" />
              )}
            </div>
          )}

          {tab === 'fastpay' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { label: 'Cash accelerated', value: formatCurrency(fastpayData?.cash_accelerated || 0), color: 'var(--accent-primary)' },
                  { label: 'Avg days early', value: `${fastpayData?.avg_days_early || 0}`, color: 'var(--status-success)' },
                  { label: 'Total fees', value: formatCurrency(fastpayData?.total_fees || 0), color: 'var(--status-warning)' },
                  { label: 'Effective APR', value: fastpayData?.effective_apr == null ? '—' : formatPercent(fastpayData.effective_apr), color: 'var(--text-primary)' },
                ].map(m => (
                  <div key={m.label} className="card metric-card">
                    <div className="card-header"><span className="card-title" style={reportLabelText}>{m.label}</span></div>
                    <div className="metric-value" style={{ ...reportMetricText, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {(fastpayData?.count || 0) > 0 ? (
                <div className="card" style={{ padding: 24 }}>
                  <div className="card-header" style={{ marginBottom: 16 }}>
                    <h2 className="card-title" style={reportHeadingText}>What fast-pay delivered</h2>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                    Across <strong style={{ color: 'var(--text-primary)' }}>{fastpayData.count}</strong> advance{fastpayData.count === 1 ? '' : 's'}, you put{' '}
                    <strong style={{ color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(fastpayData.cash_accelerated || 0)}</strong>{' '}
                    of invoice value to work an average of{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{fastpayData.avg_days_early}</strong> days early — instead of waiting on customer terms.
                    The cost was <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatPercent(fastpayData.avg_fee_pct || 0)}</strong> in fees
                    {fastpayData.effective_apr != null && (
                      <> (≈ <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatPercent(fastpayData.effective_apr)}</strong> annualised).</>
                    )}
                    {fastpayData.effective_apr == null && '.'}
                  </p>
                  <div style={{ ...reportSupportText, marginTop: 16, color: 'var(--text-tertiary)' }}>
                    {formatCurrency(fastpayData.rand_days_freed || 0).replace('R', '')} rand-days of working capital freed
                  </div>
                </div>
              ) : (
                <EmptyState message="No advances settled yet — fast-pay value appears once you draw and settle an advance" />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
