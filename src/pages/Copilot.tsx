import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { postData } from '@/lib/Api';

interface Action { label: string; route: string; }
interface ProposedAction {
  type: string;
  method: string;
  endpoint: string;
  body: Record<string, any>;
  label: string;
  detail?: string;
  confirm_text?: string;
  success_text?: string;
}
interface Message {
  role: 'user' | 'assistant';
  content: string;
  actions?: Action[];
  source?: 'llm' | 'rules';
  proposedAction?: ProposedAction | null;
  actionState?: 'pending' | 'done' | 'dismissed' | 'error';
  animate?: boolean;
}

// Lightweight typewriter for the streaming feel (used on freshly-arrived replies).
function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setN(Math.min(text.length, i));
      if (i >= text.length) clearInterval(id);
    }, 12);
    return () => clearInterval(id);
  }, [text]);
  return <>{text.slice(0, n)}</>;
}

const STARTERS: { title: string; prompt: string; hint: string }[] = [
  { title: "What's overdue?", prompt: "What's overdue?", hint: 'Chase the right accounts first' },
  { title: 'Fast-pay capacity', prompt: 'How much can I advance?', hint: 'Eligible invoices & net payout' },
  { title: 'Quotes pipeline', prompt: "How's my pipeline?", hint: 'Win/loss & open quotes' },
  { title: 'Fleet status', prompt: 'Fleet status', hint: 'Active, idle & maintenance' },
];

const SparkIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
  </svg>
);

const INTRO: Message = {
  role: 'assistant',
  content: "I'm your TruckWys copilot. Ask me about your cash position, overdue invoices, quotes pipeline, fleet status or fast-pay capacity — I answer from your live data.",
};

export default function Copilot() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([INTRO]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const isEmpty = messages.length <= 1;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { document.title = 'Copilot - TruckWys'; }, []);

  const autoGrow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const userMsg: Message = { role: 'user', content };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
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
        proposedAction: res?.proposed_action || null,
        actionState: res?.proposed_action ? 'pending' : undefined,
        animate: true,
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: e?.message || 'Something went wrong reaching the copilot.',
        animate: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (msgIndex: number, a: ProposedAction) => {
    // mark this message's action as in-flight by flipping to done optimistically guarded below
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, actionState: 'pending' } : m));
    setLoading(true);
    try {
      const res: any = await postData({ url: a.endpoint, data: a.body });
      setMessages(prev => {
        const next = prev.map((m, i) => i === msgIndex ? { ...m, actionState: 'done' as const } : m);
        return [...next, {
          role: 'assistant' as const,
          content: a.success_text || 'Done.',
          animate: true,
          actions: [{ label: 'View in Fast Pay', route: res?.id ? `/capital/advances/${res.id}` : '/capital' }],
        }];
      });
    } catch (e: any) {
      setMessages(prev => {
        const next = prev.map((m, i) => i === msgIndex ? { ...m, actionState: 'error' as const } : m);
        return [...next, {
          role: 'assistant' as const,
          content: e?.message || 'That action could not be completed.',
          animate: true,
        }];
      });
    } finally {
      setLoading(false);
    }
  };

  const dismissAction = (msgIndex: number) => {
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, actionState: 'dismissed' } : m));
  };

  const reset = () => { setMessages([INTRO]); setInput(''); setAiAvailable(null); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', width: '100%' }}>
      <style>{`
        @keyframes cp-blink { 0%,80%,100% { opacity:.2 } 40% { opacity:1 } }
        @keyframes cp-rise { from { opacity:0; transform: translateY(6px) } to { opacity:1; transform:none } }
        .cp-msg { animation: cp-rise .18s ease both; }
        .cp-dot { width:5px; height:5px; border-radius:50%; background:var(--text-tertiary); display:inline-block; animation: cp-blink 1.2s infinite both; }
        .cp-card:hover { border-color: var(--border-active); background: var(--bg-surface-hover); }
        .cp-chip:hover { background: var(--accent-primary); color: var(--bg-deep); }
        .cp-send:hover:not(:disabled) { filter: brightness(1.08); }
        .cp-ta::placeholder { color: var(--text-tertiary); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center',
            background: 'linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 55%, #000))',
            color: 'var(--bg-deep)', boxShadow: '0 2px 10px color-mix(in srgb, var(--accent-primary) 35%, transparent)',
          }}>
            <SparkIcon size={18} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1 }}>Copilot</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
              Grounded in your live operations data
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-mono)', fontSize: 10, padding: '5px 9px', borderRadius: 999,
            textTransform: 'uppercase', letterSpacing: '0.07em',
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            color: aiAvailable ? 'var(--accent-primary)' : 'var(--text-tertiary)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: aiAvailable ? 'var(--accent-primary)' : 'var(--text-tertiary)' }} />
            {aiAvailable === null ? 'Ready' : aiAvailable ? 'Claude · Live' : 'Rules engine'}
          </span>
          {!isEmpty && (
            <button onClick={reset} style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
              background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
              padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
            }}>New chat</button>
          )}
        </div>
      </div>

      {/* Transcript */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        <div style={{ maxWidth: 940, margin: '0 auto', width: '100%' }}>
          {isEmpty ? (
            <div style={{ padding: '24px 0' }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                How can I help you run the business today?
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 620, marginBottom: 28, lineHeight: 1.55 }}>
                {INTRO.content}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {STARTERS.map(s => (
                  <button
                    key={s.title}
                    className="cp-card"
                    onClick={() => send(s.prompt)}
                    style={{
                      textAlign: 'left', cursor: 'pointer', padding: '16px 16px',
                      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                      borderRadius: 12, transition: 'all .15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ color: 'var(--accent-primary)' }}><SparkIcon size={13} /></span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {messages.slice(1).map((m, i) => {
                const realIndex = i + 1;
                return (
                <div key={realIndex} className="cp-msg" style={{ display: 'flex', gap: 12, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                  {/* avatar */}
                  <div style={{
                    flexShrink: 0, width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center',
                    background: m.role === 'user' ? 'var(--bg-surface)' : 'linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 55%, #000))',
                    border: m.role === 'user' ? '1px solid var(--border-subtle)' : 'none',
                    color: m.role === 'user' ? 'var(--text-secondary)' : 'var(--bg-deep)',
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                  }}>
                    {m.role === 'user' ? 'You' : <SparkIcon size={16} />}
                  </div>
                  {/* bubble */}
                  <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      padding: '12px 15px', borderRadius: 14,
                      borderTopLeftRadius: m.role === 'user' ? 14 : 4,
                      borderTopRightRadius: m.role === 'user' ? 4 : 14,
                      fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                      background: m.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-surface)',
                      color: m.role === 'user' ? 'var(--bg-deep)' : 'var(--text-primary)',
                      border: m.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                    }}>
                      {m.role === 'assistant' && m.animate ? <Typewriter text={m.content} /> : m.content}
                    </div>
                    {/* Confirmable action card */}
                    {m.proposedAction && (m.actionState === 'pending') && (
                      <div style={{
                        marginTop: 10, padding: 14, width: '100%',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-active)', borderRadius: 12,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ color: 'var(--accent-primary)' }}><SparkIcon size={14} /></span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.proposedAction.label}</span>
                        </div>
                        {m.proposedAction.detail && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{m.proposedAction.detail}</div>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => runAction(realIndex, m.proposedAction!)}
                            disabled={loading}
                            style={{
                              background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none',
                              padding: '8px 14px', borderRadius: 8, cursor: loading ? 'default' : 'pointer',
                              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}
                          >
                            {m.proposedAction.confirm_text || 'Confirm'}
                          </button>
                          <button
                            onClick={() => dismissAction(realIndex)}
                            style={{
                              background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)',
                              padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                              fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}
                    {m.proposedAction && m.actionState === 'done' && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--status-success)', fontFamily: 'var(--font-mono)' }}>✓ Confirmed</div>
                    )}
                    {m.proposedAction && m.actionState === 'dismissed' && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Dismissed</div>
                    )}
                    {m.actions && m.actions.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        {m.actions.map((a, j) => (
                          <button
                            key={j}
                            className="cp-chip"
                            onClick={() => navigate(a.route)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              background: 'var(--bg-surface)', border: '1px solid var(--border-active)',
                              color: 'var(--accent-primary)', padding: '7px 12px',
                              fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 999,
                              cursor: 'pointer', letterSpacing: '0.03em', transition: 'all .12s ease',
                            }}
                          >
                            {a.label} <span style={{ fontSize: 13 }}>→</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
              {loading && (
                <div className="cp-msg" style={{ display: 'flex', gap: 12 }}>
                  <div style={{
                    flexShrink: 0, width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center',
                    background: 'linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 55%, #000))',
                    color: 'var(--bg-deep)',
                  }}><SparkIcon size={16} /></div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 14, borderTopLeftRadius: 4 }}>
                    <span className="cp-dot" /><span className="cp-dot" style={{ animationDelay: '.2s' }} /><span className="cp-dot" style={{ animationDelay: '.4s' }} />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input dock */}
      <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: 940, margin: '0 auto', width: '100%' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 10, padding: 8,
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 14,
          }}>
            <textarea
              ref={taRef}
              className="cp-ta"
              value={input}
              rows={1}
              onChange={e => { setInput(e.target.value); autoGrow(); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask your copilot anything about your operations…"
              style={{
                flex: 1, resize: 'none', maxHeight: 160, background: 'transparent', border: 'none',
                color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.5, outline: 'none',
                fontFamily: 'var(--font-sans)', padding: '8px 8px',
              }}
            />
            <button
              className="cp-send"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label="Send"
              style={{
                flexShrink: 0, width: 38, height: 38, borderRadius: 10, border: 'none',
                display: 'grid', placeItems: 'center',
                background: input.trim() && !loading ? 'var(--accent-primary)' : 'var(--bg-surface-hover)',
                color: input.trim() && !loading ? 'var(--bg-deep)' : 'var(--text-tertiary)',
                cursor: input.trim() && !loading ? 'pointer' : 'default', transition: 'all .12s ease',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textAlign: 'center', marginTop: 8 }}>
            Read-only · grounded in your data · {aiAvailable === false ? 'rules engine (add ANTHROPIC_API_KEY for Claude)' : 'Enter to send, Shift+Enter for newline'}
          </div>
        </div>
      </div>
    </div>
  );
}
