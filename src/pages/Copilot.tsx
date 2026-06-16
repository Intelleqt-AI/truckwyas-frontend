import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { postData } from '@/lib/Api';

interface Action { label: string; route: string; }
interface Message {
  role: 'user' | 'assistant';
  content: string;
  actions?: Action[];
  source?: 'llm' | 'rules';
}

const STARTERS = [
  "What's overdue?",
  'How much can I advance?',
  "How's my pipeline?",
  'Fleet status',
];

export default function Copilot() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: "I'm your TruckWys copilot. Ask me about your cash position, overdue invoices, quotes pipeline, fleet status or fast-pay capacity — I answer from your live data.",
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  useEffect(() => { document.title = 'Copilot - TruckWys'; }, []);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const userMsg: Message = { role: 'user', content };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);
    try {
      const payload = history
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));
      const res: any = await postData({ url: 'api/v1/agent/chat/', data: { messages: payload } });
      setAiAvailable(!!res?.ai_available);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res?.reply || 'Sorry, I could not produce a response.',
        actions: res?.actions || [],
        source: res?.source,
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: e?.message || 'Something went wrong reaching the copilot.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            Intelligence
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Copilot</div>
        </div>
        {aiAvailable !== null && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, padding: '4px 8px', borderRadius: 2,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            color: aiAvailable ? 'var(--accent-primary)' : 'var(--text-tertiary)',
          }}>
            {aiAvailable ? 'Claude · Live' : 'Rules engine'}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="card" style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '78%', padding: '10px 14px', borderRadius: 8, fontSize: 13, lineHeight: 1.55,
              background: m.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-surface)',
              color: m.role === 'user' ? 'var(--bg-deep)' : 'var(--text-primary)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
            {m.actions && m.actions.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {m.actions.map((a, j) => (
                  <button
                    key={j}
                    onClick={() => navigate(a.route)}
                    style={{
                      background: 'none', border: '1px solid var(--border-active)',
                      color: 'var(--accent-primary)', padding: '5px 10px',
                      fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2,
                      cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase',
                    }}
                  >
                    {a.label} →
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', padding: '10px 14px', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Starters */}
      {messages.length <= 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {STARTERS.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', padding: '7px 12px', fontSize: 12,
                borderRadius: 2, cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask your copilot…"
          style={{
            flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 2, padding: '11px 14px', color: 'var(--text-primary)',
            fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)',
          }}
        />
        <button className="btn-action" onClick={() => send()} disabled={loading || !input.trim()}>
          {loading ? '…' : 'SEND'}
        </button>
      </div>
    </div>
  );
}
