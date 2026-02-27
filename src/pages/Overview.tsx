import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';

export default function Overview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [financeData, setFinanceData] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [finance, insightsData, advancesData] = await Promise.all([
          fetchData('/api/v1/dashboard/finance/').catch(() => null),
          fetchData('/api/v1/dashboard/insights/').catch(() => []),
          fetchData('/api/v1/advances/').catch(() => []),
        ]);
        setFinanceData(finance);
        setInsights(Array.isArray(insightsData) ? insightsData : []);
        setAdvances(Array.isArray(advancesData) ? advancesData : []);
      } catch (error) {
        console.error('Failed to load overview data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <div style={{ display: 'flex', gap: 0, margin: -24, minHeight: 'calc(100% + 48px)' }}>
      {/* MAIN WORKSPACE */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 20,
        alignContent: 'start',
        padding: 24,
      }}>
        {/* Metric cards */}
        <div className="card metric-card">
          <div className="card-header">
            <span className="card-title">{loading ? 'Loading...' : 'Total Revenue'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="card-action"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </div>
          <div className="metric-value">{loading ? '...' : formatCurrency(financeData?.total_revenue || 18450)}</div>
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
            {loading ? '...' : `${financeData?.net_margin_percent || 24.8}%`}
          </div>
          <div className="metric-delta delta-up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg>
            <span>+2.1% uplift</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="card-header">
            <span className="card-title">{loading ? 'Loading...' : 'Capital In Use'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="card-action"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </div>
          <div className="metric-value">
            {loading ? '...' : formatCurrency(advances.filter((a: any) => a.status === 'ACTIVE' || a.status === 'FUNDED').reduce((sum: number, a: any) => sum + (a.advanced_amount || 0), 0) || 0)}
          </div>
          <div className="metric-delta delta-neutral"><span>{advances.length} advances</span></div>
        </div>

        {/* Chart card — Revenue vs Fuel Cost trend */}
        <div className="card chart-card">
          <div className="card-header">
            <span className="card-title">Revenue vs Fuel Cost (Last 30 Days)</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 20, height: 2, background: 'var(--accent-primary)', display: 'inline-block', borderRadius: 1 }}/>Revenue</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 20, height: 2, background: 'var(--status-danger)', display: 'inline-block', borderRadius: 1, borderTop: '1px dashed var(--status-danger)' }}/>Fuel Cost</span>
            </div>
          </div>
          {(() => {
            const rev =  [42,48,51,45,58,62,55,68,72,65,80,76,71,85,90,82,78,88,92,86,95,100,94,88,96,102,98,104,108,112];
            const fuel = [18,20,19,21,22,20,24,22,25,23,28,26,24,27,30,28,26,29,31,28,32,34,31,30,33,35,32,34,36,37];
            const maxV = 120;
            const pts = (arr: number[]) => arr.map((v, i) => `${(i / (arr.length - 1)) * 100},${100 - (v / maxV) * 100}`).join(' ');
            return (
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
            );
          })()}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
            <span>01 Feb</span><span>10 Feb</span><span>20 Feb</span><span>26 Feb</span>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            <span>Net Margin <span style={{ color: 'var(--accent-primary)' }}>72.1%</span></span>
            <span>Fuel/Rev ratio <span style={{ color: 'var(--status-warning)' }}>28%</span></span>
            <span>Trend <span style={{ color: 'var(--status-success)' }}>↑ improving</span></span>
          </div>
        </div>

        {/* Utilization card */}
        <div className="card utilization-card">
          <div className="card-header"><span className="card-title">Fleet Utilization</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-primary)' }}>88%</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>High Demand</span>
          </div>
          <div className="heatmap-grid">
            {['low','med','high','low','high','high','low','high','high','med','high','low','high','high','high','med','high','high','high','high','med','med','med','low','low','med','low','low'].map((v, i) => (
              <div key={i} className={`heat-cell heat-${v}`} />
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>3 trucks idle in Depot 4</div>
        </div>

        {/* P&L Table */}
        <div className="card table-card">
          <div className="card-header">
            <span className="card-title">Live Trip P&L Breakdown</span>
            <button style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '4px 8px', fontSize: 10, borderRadius: 2, cursor: 'pointer' }}>EXPORT CSV</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Route ID</th><th>Driver</th><th>Status</th><th>Est. Rev</th><th>Fuel Cost</th><th className="text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono">TRK-892</td><td>S. Nkosi</td>
                <td><span className="status-badge active">In Transit</span></td>
                <td>R 45,200</td><td>R 12,400</td>
                <td className="text-right" style={{ color: 'var(--accent-primary)' }}>+ R 18,200</td>
              </tr>
              <tr>
                <td className="mono">TRK-901</td><td>J. Dlamini</td>
                <td><span className="status-badge">Loading</span></td>
                <td>R 32,150</td><td>R 8,900</td>
                <td className="text-right" style={{ color: 'var(--accent-primary)' }}>+ R 14,050</td>
              </tr>
              <tr>
                <td className="mono">TRK-774</td><td>P. Botha</td>
                <td><span className="status-badge">Completed</span></td>
                <td>R 28,400</td><td>R 9,200</td>
                <td className="text-right" style={{ color: 'var(--text-primary)' }}>+ R 9,100</td>
              </tr>
              <tr>
                <td className="mono">TRK-882</td><td>M. Moyo</td>
                <td><span className="status-badge active" style={{ color: 'var(--status-danger)', background: 'var(--status-danger-bg)' }}>Delayed</span></td>
                <td>R 51,000</td><td>R 16,500</td>
                <td className="text-right" style={{ color: 'var(--status-danger)' }}>+ R 8,200</td>
              </tr>
              <tr>
                <td className="mono">TRK-911</td><td>L. Zulu</td>
                <td><span className="status-badge">Scheduled</span></td>
                <td>R 38,000</td><td>R 10,100</td>
                <td className="text-right" style={{ color: 'var(--text-tertiary)' }}>--</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* AGENT SIDEBAR */}
      <aside style={{
        width: 280,
        flexShrink: 0,
        borderLeft: '1px solid var(--border-subtle)',
        background: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
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
        <div style={{ padding: 20, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', marginTop: 'auto' }}>
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
