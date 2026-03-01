import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchData } from '@/lib/Api';
import { formatCurrency, formatPercent } from '@/lib/formatters';

export default function Overview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [financeData, setFinanceData] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
  const [activeLoadsCount, setActiveLoadsCount] = useState(0);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [activeVehicles, setActiveVehicles] = useState(0);
  const [activity, setActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [finance, insightsData, advancesData, quotesData, loadsData, activityData, vehiclesData, fleetData] = await Promise.all([
          fetchData('api/v1/dashboard/finance/').catch(() => null),
          fetchData('api/v1/dashboard/signals/').catch(() => fetchData('api/v1/dashboard/insights/').catch(() => [])),
          fetchData('api/v1/advances/').catch(() => []),
          fetchData('api/v1/quotes/?limit=5').catch(() => []),
          fetchData('api/v1/loads/').catch(() => []),
          fetchData('api/v1/activity/').catch(() => []),
          fetchData('api/v1/vehicles/').catch(() => []),
          fetchData('api/v1/fleet/overview/').catch(() => null),
        ]);
        setFinanceData(finance);
        // dashboard/insights/ may not exist — handle gracefully, signals come as array or {signals:[]}
        // dashboard/signals returns {signals:[]} — extract
        const insightsArr = Array.isArray(insightsData) ? insightsData : (insightsData?.signals || []);
        setInsights(insightsArr.map((s: any) => ({
          category: s.category || s.type || 'Update',
          title: s.title || '',
          body: s.body || s.message || '',
          action: s.action || 'VIEW',
          severity: s.severity || 'low',
          type: s.type || 'INFO',
        })));

        setAdvances(Array.isArray(advancesData) ? advancesData : (advancesData?.results || []));

        const quotes = quotesData?.results || quotesData || [];
        setRecentQuotes(quotes.slice(0, 5));

        const loads = loadsData?.results || loadsData || [];
        const activeLoads = loads.filter((l: any) => l.status === 'IN_TRANSIT' || l.status === 'LOADING');
        setActiveLoadsCount(activeLoads.length);
        const vehicles = vehiclesData?.results || vehiclesData || [];
        setTotalVehicles(vehicles.length);

        // Get active vehicles count from fleet overview or calculate from vehicle data
        const activeVehicleCount = fleetData?.active_vehicles || vehicles.filter((v: any) => v.status === 'AVAILABLE' || v.status === 'IN_USE').length || 0;
        setActiveVehicles(activeVehicleCount);

        setActivity(Array.isArray(activityData) ? activityData : (activityData?.results || []));
        setActivityLoading(false);

        // Auto-refresh signals every 60s
        const timer = setInterval(() => {
          fetchData('api/v1/dashboard/signals/').then((fresh: any) => {
            const arr = Array.isArray(fresh) ? fresh : (fresh?.signals || []);
            setInsights(arr.map((s: any) => ({
              category: s.category || s.type || 'Update',
              title: s.title || '',
              body: s.body || s.message || '',
              action: s.action || 'VIEW',
              severity: s.severity || 'low',
              type: s.type || 'INFO',
            })));
          }).catch(() => {});
        }, 60000);

        return () => clearInterval(timer);
      } catch (error) {
        console.error('Failed to load overview data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'start' }}>
      {/* MAIN WORKSPACE */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 20,
        alignContent: 'start',
      }}>
        {/* Metric cards */}
        <div className="card metric-card">
          <div className="card-header">
            <span className="card-title">{loading ? 'Loading...' : 'Total Revenue'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="card-action"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </div>
          <div className="metric-value">{loading ? '...' : formatCurrency(financeData?.total_revenue || 0)}</div>
          <div className="metric-delta delta-up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg>
            <span>+12.5% vs avg</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="card-header">
            <span className="card-title">{loading ? 'Loading...' : 'Net Margin'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="card-action"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-primary)' }}>
            {loading ? '...' : formatPercent(financeData?.net_margin_percent || 0)}
          </div>
          <div className="metric-delta delta-up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg>
            <span>+2.1% uplift</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="card-header">
            <span className="card-title">{loading ? 'Loading...' : 'Outstanding'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="card-action"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </div>
          <div className="metric-value" style={{ color: 'var(--status-warning)' }}>
            {loading ? '...' : formatCurrency(financeData?.outstanding_invoices_total || 0)}
          </div>
          <div className="metric-delta delta-neutral">
            <span>DSO: {loading ? '—' : Math.round(financeData?.dso || 0)} days</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="card-header">
            <span className="card-title">{loading ? 'Loading...' : 'Fleet Active'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="card-action"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </div>
          <div className="metric-value" style={{ color: 'var(--status-success)' }}>
            {loading ? '...' : activeVehicles}
          </div>
          <div className="metric-delta delta-neutral">
            <span>{totalVehicles} total</span>
          </div>
        </div>

        {/* Chart card */}
        <div className="card chart-card">
          <div className="card-header">
            <span className="card-title">Revenue vs Fuel Cost (Last 30 Days)</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 20, height: 2, background: 'var(--accent-primary)', display: 'inline-block', borderRadius: 1 }}/>Revenue</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 20, height: 2, background: 'var(--status-danger)', display: 'inline-block', borderRadius: 1 }}/>Fuel Cost</span>
            </div>
          </div>
          {(() => {
            const trend = financeData?.monthly_trend || [];
            const rev = trend.length > 0 ? trend.map((m: any) => m.revenue / 1000) : [0];
            const fuel = trend.length > 0 ? trend.map((m: any) => m.expenses / 1000) : [0];
            const maxV = Math.max(...rev, ...fuel, 1) * 1.1;
            const pts = (arr: number[]) => arr.map((v, i) => `${(i / Math.max(arr.length - 1, 1)) * 100},${100 - (v / maxV) * 100}`).join(' ');
            const labels = trend.map((m: any) => m.month?.slice(5) || '');
            return (
              <>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 120, display: 'block', marginTop: 8 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.15"/>
                      <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <polygon points={`0,100 ${pts(rev)} 100,100`} fill="url(#revGrad)" />
                  <polyline points={pts(rev)} fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                  <polyline points={pts(fuel)} fill="none" stroke="var(--status-danger)" strokeWidth="1.2" strokeDasharray="3,2" vectorEffect="non-scaling-stroke" />
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {labels.slice(-4).map((l: string, i: number) => <span key={i}>{l}</span>)}
                </div>
              </>
            );
          })()}
          <div style={{ display: 'flex', gap: 20, marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            <span>Net Margin <span style={{ color: 'var(--accent-primary)' }}>{financeData?.net_margin_percent != null ? `${financeData.net_margin_percent.toFixed(1)}%` : '—'}</span></span>
            <span>Fuel/Rev ratio <span style={{ color: 'var(--status-warning)' }}>{financeData?.monthly_trend?.length > 0 ? `${Math.round((financeData.monthly_trend.at(-1).expenses / Math.max(financeData.monthly_trend.at(-1).revenue, 1)) * 100)}%` : '—'}</span></span>
            <span>Trend <span style={{ color: 'var(--status-success)' }}>↑ improving</span></span>
          </div>
        </div>

        {/* Utilization card */}
        <div className="card utilization-card">
          <div className="card-header"><span className="card-title">Fleet Utilization</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-primary)' }}>{totalVehicles > 0 ? `${Math.round((activeLoadsCount / totalVehicles) * 100)}%` : '—'}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{activeLoadsCount} active loads</span>
          </div>
          <div className="heatmap-grid">
            {['low','med','high','low','high','high','low','high','high','med','high','low','high','high','high','med','high','high','high','high','med','med','med','low','low','med','low','low'].map((v, i) => (
              <div key={i} className={`heat-cell heat-${v}`} />
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>{totalVehicles > 0 ? `${totalVehicles - activeLoadsCount} vehicle${totalVehicles - activeLoadsCount !== 1 ? 's' : ''} available` : 'Loading...'}</div>
        </div>

        {/* Recent Quotes */}
        <div className="card table-card">
          <div className="card-header">
            <span className="card-title">Recent Quotes</span>
            <button onClick={() => navigate('/quotes')} style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '4px 8px', fontSize: 10, borderRadius: 2, cursor: 'pointer' }}>VIEW ALL</button>
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading quotes...</div>
          ) : recentQuotes.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr><th>Quote #</th><th>Customer</th><th>Route</th><th>Total</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recentQuotes.map((quote: any) => (
                  <tr key={quote.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/quotes/${quote.id}`)}>
                    <td className="mono">{quote.quote_number}</td>
                    <td>{quote.customer_name}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                      {quote.pickup_location?.split(' ').slice(0, 2).join(' ')} → {quote.delivery_location?.split(' ').slice(0, 2).join(' ')}
                    </td>
                    <td style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(parseFloat(quote.total_amount || '0'))}
                    </td>
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: quote.status === 'ACCEPTED' ? 'var(--status-success)' : quote.status === 'SENT' ? 'var(--status-warning)' : 'var(--text-tertiary)',
                        padding: '2px 6px',
                        background: 'var(--bg-surface-hover)',
                        borderRadius: 2
                      }}>
                        {quote.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>No recent quotes</div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Quick Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              onClick={() => navigate('/finance/invoices/new')}
              className="btn-action"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
            >
              Create Invoice
            </button>
            <button
              onClick={() => navigate('/capital')}
              className="btn-action"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              Request Advance
            </button>
            <button
              onClick={() => navigate('/expenses')}
              className="btn-action"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              Add Expense
            </button>
            <button
              onClick={() => navigate('/finance-reports')}
              className="btn-action"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              View Reports
            </button>
          </div>
          <div style={{ marginTop: 16, padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Active Loads:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--accent-primary)' }}>
              {activeLoadsCount}
            </span>
          </div>

          {/* RECENT ACTIVITY */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12 }}>
              Recent Activity
            </div>
            {activityLoading ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Loading...</div>
            ) : activity.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '16px 0' }}>No recent activity</div>
            ) : (
              <div>
                {activity.slice(0, 8).map((e: any) => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-row)' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{e.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', marginLeft: 16 }}>{timeAgo(e.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AGENT SIDEBAR */}
      <aside style={{
        width: 260,
        flexShrink: 0,
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--card-radius)',
        background: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div className="agent-header">
          <div className="live-dot" />
          Agent Activity Stream
        </div>
        <div className="agent-feed">
          {loading ? (
            <div className="feed-item">
              <div className="feed-meta"><span>LOADING</span><span>...</span></div>
              <div className="feed-content">Loading insights...</div>
            </div>
          ) : insights.length > 0 ? (
            insights.slice(0, 5).map((insight: any, idx: number) => (
              <div key={idx} className="feed-item">
                <div className="feed-meta">
                  <span style={{ color: insight.priority === 'high' ? 'var(--accent-primary)' : 'inherit' }}>
                    {insight.category?.toUpperCase() || 'INSIGHT'}
                  </span>
                  <span>{insight.time_ago || 'NOW'}</span>
                </div>
                <div className="feed-content">
                  <span className="highlight-text">{insight.title || insight.message}</span>
                  {insight.description && ` ${insight.description}`}
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="feed-item">
                <div className="feed-meta"><span style={{ color: 'var(--accent-primary)' }}>ROUTE OPTIMIZER</span><span>NOW</span></div>
                <div className="feed-content">
                  <span className="highlight-text">Margin Leak Detected</span> on JHB-CPT route. Fuel costs spiked 12% above baseline for Truck 42.
                  <div className="alert-box">
                    <div className="alert-title">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      Recommendation
                    </div>
                    <div>Reroute via N1 Alternate or renegotiate return load.</div>
                    <button className="btn-action">APPLY REROUTE</button>
                  </div>
                </div>
              </div>
              <div className="feed-item">
                <div className="feed-meta"><span>INVOICE COLLECTOR</span><span>2m AGO</span></div>
                <div className="feed-content">Chasing invoice #INV-2024-09. Client opened email 3 times. <span className="highlight-text">Probability of payment today: 85%.</span></div>
              </div>
              <div className="feed-item">
                <div className="feed-meta"><span>QUOTE GENERATOR</span><span>14m AGO</span></div>
                <div className="feed-content">Generated 3 quotes for <span className="highlight-text">LogiCorp</span>. Margin locked at 22%.</div>
              </div>
              <div className="feed-item">
                <div className="feed-meta"><span>FLEET MONITOR</span><span>1h AGO</span></div>
                <div className="feed-content">Tyre pressure warning on TRK-892. Maintenance ticket auto-created.</div>
              </div>
            </>
          )}
        </div>
        <div style={{ padding: 20, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', borderRadius: '0 0 var(--card-radius) var(--card-radius)' }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Quick Quote</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input type="text" placeholder="Origin" style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)', padding: 8, color: 'var(--text-primary)', borderRadius: 2, fontSize: 11, outline: 'none' }} />
            <input type="text" placeholder="Dest" style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)', padding: 8, color: 'var(--text-primary)', borderRadius: 2, fontSize: 11, outline: 'none' }} />
          </div>
          <button className="btn-action" onClick={() => navigate('/quotes/new')} style={{ background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}>GENERATE PREVIEW</button>
        </div>
      </aside>
    </div>
  );
}
