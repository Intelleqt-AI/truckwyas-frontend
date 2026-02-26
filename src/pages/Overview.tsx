import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Overview() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('tw-theme') as 'dark' | 'light') || 'dark';
  });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tw-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <div className="os-container">
      {/* Ambient glow */}
      <div className="ambient-glow" />

      {/* HEADER */}
      <header className="os-header">
        <div className="logo">
          <img src="/brand/logo.svg" alt="Truckwys" style={{ height: 24, width: 'auto', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
          TRUCKWYS<span>OS</span>
        </div>

        <div className="agent-command">
          <div className="agent-icon" />
          <input
            type="text"
            className="agent-input"
            placeholder="Ask Agent to analyze route profitability or generate quote..."
            defaultValue="Agent, show me margin leaks on the JHB-CPT route"
          />
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="status-badge active">
            <span style={{ width: 6, height: 6, background: 'currentColor', borderRadius: '50%', display: 'inline-block' }} />
            SYSTEMS ONLINE
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          <div style={{ width: 32, height: 32, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>TW</div>
        </div>
      </header>

      {/* LEFT NAV */}
      <nav className="os-nav">
        <div className={`nav-item${isActive('/') ? ' active' : ''}`} title="Home" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <div className="nav-item" title="Bookings" onClick={() => navigate('/quotes')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div className="nav-item" title="Fleet" onClick={() => navigate('/vehicles')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        </div>
        <div className="nav-item" title="Finance" onClick={() => navigate('/invoices')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div className="nav-item" title="Capital" onClick={() => navigate('/capital')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
        <div className="nav-item" title="Insights" onClick={() => navigate('/insights')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        </div>
        <div className="nav-item" title="Settings" onClick={() => navigate('/settings')} style={{ marginTop: 'auto', marginBottom: 24 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </div>
      </nav>

      {/* MAIN WORKSPACE */}
      <main className="workspace">
        {/* Metric cards */}
        <div className="card metric-card">
          <div className="card-header">
            <span className="card-title">Net Rev / Trip</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="card-action"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </div>
          <div className="metric-value">R 18,450</div>
          <div className="metric-delta delta-up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg>
            <span>+12.5% vs avg</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="card-header">
            <span className="card-title">Fleet Margin</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="card-action"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-primary)' }}>24.8%</div>
          <div className="metric-delta delta-up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg>
            <span>+2.1% uplift</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="card-header">
            <span className="card-title">Avg Payment Days</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="card-action"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </div>
          <div className="metric-value">28 Days</div>
          <div className="metric-delta delta-neutral"><span>-10 days faster</span></div>
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
            <span>Trend <span style={{ color: '#22c55e' }}>↑ improving</span></span>
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
      </main>

      {/* AGENT SIDEBAR */}
      <aside className="agent-sidebar">
        <div className="agent-header">
          <div className="live-dot" />
          Agent Activity Stream
        </div>
        <div className="agent-feed">
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
        </div>
        <div style={{ padding: 20, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Quick Quote</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input type="text" placeholder="Origin" style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)', padding: 8, color: 'var(--text-primary)', borderRadius: 2, fontSize: 11, outline: 'none' }} />
            <input type="text" placeholder="Dest" style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)', padding: 8, color: 'var(--text-primary)', borderRadius: 2, fontSize: 11, outline: 'none' }} />
          </div>
          <button className="btn-action" style={{ background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}>GENERATE PREVIEW</button>
        </div>
      </aside>
    </div>
  );
}
