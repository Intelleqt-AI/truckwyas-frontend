/**
 * TruckWys V3 - Agent Activity Sidebar
 * 320px right sidebar with real-time agent activity feed and quick quote form
 */

import { AlertCircle } from 'lucide-react';

// Mock activity feed data matching reference design
const AGENT_FEED = [
  {
    id: '1',
    source: 'ROUTE OPTIMIZER',
    time: 'NOW',
    content: 'Margin Leak Detected on JHB-CPT route. Fuel costs spiked 12% above baseline for Truck 42.',
    highlight: 'Margin Leak Detected',
    alert: {
      title: 'Recommendation',
      text: 'Reroute via N1 Alternate or renegotiate return load.',
      buttonText: 'APPLY REROUTE',
    },
  },
  {
    id: '2',
    source: 'INVOICE COLLECTOR',
    time: '2m AGO',
    content: 'Chasing invoice #INV-2024-09. Client opened email 3 times. Probability of payment today: 85%.',
    highlight: 'Probability of payment today: 85%.',
  },
  {
    id: '3',
    source: 'QUOTE GENERATOR',
    time: '14m AGO',
    content: 'Generated 3 quotes for LogiCorp. Margin locked at 22%.',
    highlight: 'LogiCorp',
  },
  {
    id: '4',
    source: 'FLEET MONITOR',
    time: '1h AGO',
    content: 'Tyre pressure warning on TRK-892. Maintenance ticket auto-created.',
  },
];

export function AgentSidebar() {
  return (
    <aside className="agent-sidebar">
      {/* Header */}
      <div className="agent-header">
        <div className="live-dot" />
        Agent Activity Stream
      </div>

      {/* Activity Feed */}
      <div className="agent-feed">
        {AGENT_FEED.map((item) => (
          <div key={item.id} className="feed-item">
            <div className="feed-meta">
              <span style={{ color: item.time === 'NOW' ? 'var(--accent-primary)' : undefined }}>
                {item.source}
              </span>
              <span>{item.time}</span>
            </div>
            <div className="feed-content">
              {item.highlight ? (
                <>
                  {item.content.split(item.highlight).map((part, idx, arr) => (
                    <span key={idx}>
                      {part}
                      {idx < arr.length - 1 && (
                        <span className="highlight-text">{item.highlight}</span>
                      )}
                    </span>
                  ))}
                </>
              ) : (
                item.content
              )}

              {item.alert && (
                <div className="alert-box">
                  <div className="alert-title">
                    <AlertCircle size={12} />
                    {item.alert.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {item.alert.text}
                  </div>
                  <button className="btn-action">
                    {item.alert.buttonText}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Quote Form */}
      <div className="quick-quote">
        <div className="card-title" style={{ marginBottom: '12px' }}>
          Quick Quote
        </div>
        <div className="quick-quote-inputs">
          <input
            type="text"
            placeholder="Origin"
            className="quick-quote-input"
          />
          <input
            type="text"
            placeholder="Dest"
            className="quick-quote-input"
          />
        </div>
        <button className="btn-action btn-ghost">
          GENERATE PREVIEW
        </button>
      </div>
    </aside>
  );
}
