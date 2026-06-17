import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { postData, fetchData, deleteData } from '@/lib/Api';

const CACHE_KEY = 'copilot_current';
function loadCache(): { conversationId: number | null; messages: Message[] } | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && Array.isArray(c.messages) && c.messages.length) return c;
  } catch { /* ignore */ }
  return null;
}
function relTime(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (d < 1) return 'now'; if (d < 60) return `${d}m`;
  const h = Math.floor(d / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

interface Action { label: string; route: string; }
interface ProposedAction {
  type: string; method: string; endpoint: string; body: Record<string, any>;
  label: string; detail?: string; confirm_text?: string; success_text?: string;
}
interface Message {
  role: 'user' | 'assistant';
  content: string;
  actions?: Action[];
  proposedAction?: ProposedAction | null;
  actionState?: 'pending' | 'done' | 'dismissed' | 'error';
  animate?: boolean;
}

const STARTERS: { title: string; prompt: string; hint: string }[] = [
  { title: "What's overdue?", prompt: "What's overdue?", hint: 'Chase the right accounts first' },
  { title: 'Fast-pay capacity', prompt: 'How much can I advance?', hint: 'Eligible invoices & net payout' },
  { title: 'Quotes pipeline', prompt: "How's my pipeline?", hint: 'Win/loss & open quotes' },
  { title: 'Fleet status', prompt: 'Fleet status', hint: 'Active, idle & maintenance' },
];

const INTRO: Message = {
  role: 'assistant',
  content: "I'm your TruckWys copilot. Ask me about your cash position, overdue invoices, quotes pipeline, fleet status or fast-pay capacity — I answer from your live data.",
};

// Lightweight typewriter for the streaming feel (used on freshly-arrived replies).
function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let i = 0;
    const id = setInterval(() => { i += 2; setN(Math.min(text.length, i)); if (i >= text.length) clearInterval(id); }, 12);
    return () => clearInterval(id);
  }, [text]);
  return <>{text.slice(0, n)}</>;
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
  letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4,
};

export default function Copilot() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>(() => loadCache()?.messages || [INTRO]);
  const [conversationId, setConversationId] = useState<number | null>(() => loadCache()?.conversationId ?? null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const isEmpty = messages.length <= 1;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { document.title = 'Copilot - TruckWys'; }, []);

  const refreshConversations = useCallback(() => {
    fetchData('api/v1/agent/conversations/')
      .then((d: any) => setConversations(d?.conversations || []))
      .catch(() => {});
  }, []);

  const openConversation = useCallback((id: number) => {
    setShowHistory(false);
    fetchData(`api/v1/agent/conversations/${id}/`)
      .then((d: any) => {
        const hist = (d?.messages || []).map((m: any) => ({ role: m.role, content: m.content }));
        setConversationId(id);
        setMessages(hist.length ? [INTRO, ...hist] : [INTRO]);
      })
      .catch(() => {});
  }, []);

  // On mount: load the conversation list, and if we have no cached thread,
  // restore the most recent conversation from the server.
  useEffect(() => {
    fetchData('api/v1/agent/conversations/')
      .then((d: any) => {
        const list = d?.conversations || [];
        setConversations(list);
        if (!loadCache() && list.length) openConversation(list[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cache the current conversation for instant restore next time.
  useEffect(() => {
    try {
      if (messages.length > 1) localStorage.setItem(CACHE_KEY, JSON.stringify({ conversationId, messages }));
      else localStorage.removeItem(CACHE_KEY);
    } catch { /* ignore quota */ }
  }, [messages, conversationId]);

  const autoGrow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const history = [...messages, { role: 'user' as const, content }];
    setMessages(history);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
    setLoading(true);
    try {
      const payload = history.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.content }));
      const res: any = await postData({ url: 'api/v1/agent/chat/', data: { messages: payload, conversation_id: conversationId } });
      setAiAvailable(!!res?.ai_available);
      if (res?.conversation_id && res.conversation_id !== conversationId) setConversationId(res.conversation_id);
      setMessages(prev => [...prev, {
        role: 'assistant', content: res?.reply || 'Sorry, I could not produce a response.',
        actions: res?.actions || [], proposedAction: res?.proposed_action || null,
        actionState: res?.proposed_action ? 'pending' : undefined, animate: true,
      }]);
      refreshConversations();
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: e?.message || 'Something went wrong reaching the copilot.', animate: true }]);
    } finally {
      setLoading(false);
    }
  };

  // Handoff: ?q= from the homepage "Ask agent" bar — auto-send once.
  useEffect(() => {
    const q = params.get('q');
    if (q && q.trim()) {
      send(q.trim());
      params.delete('q');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAction = async (msgIndex: number, a: ProposedAction) => {
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, actionState: 'pending' } : m));
    setLoading(true);
    try {
      const res: any = await postData({ url: a.endpoint, data: a.body });
      setMessages(prev => {
        const next = prev.map((m, i) => i === msgIndex ? { ...m, actionState: 'done' as const } : m);
        return [...next, { role: 'assistant' as const, content: a.success_text || 'Done.', animate: true,
          actions: [{ label: 'View in Fast Pay', route: res?.id ? `/capital/advances/${res.id}` : '/capital' }] }];
      });
    } catch (e: any) {
      setMessages(prev => {
        const next = prev.map((m, i) => i === msgIndex ? { ...m, actionState: 'error' as const } : m);
        return [...next, { role: 'assistant' as const, content: e?.message || 'That action could not be completed.', animate: true }];
      });
    } finally {
      setLoading(false);
    }
  };
  const dismissAction = (i: number) => setMessages(prev => prev.map((m, j) => j === i ? { ...m, actionState: 'dismissed' } : m));

  // New chat — starts a fresh conversation. The previous one is KEPT (browsable
  // in History), never deleted.
  const newChat = async () => {
    setShowHistory(false); setInput(''); setAiAvailable(null); setMessages([INTRO]);
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
    try {
      const res: any = await postData({ url: 'api/v1/agent/conversations/', data: {} });
      setConversationId(res?.id ?? null);
    } catch { setConversationId(null); }
    refreshConversations();
  };

  const deleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    await deleteData({ url: `api/v1/agent/conversations/${id}/` }).catch(() => {});
    if (id === conversationId) { setMessages([INTRO]); setConversationId(null); try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ } }
    refreshConversations();
  };

  const avatar = (role: 'user' | 'assistant') => (
    <div style={{
      flexShrink: 0, width: 26, height: 26, borderRadius: 2, display: 'grid', placeItems: 'center',
      background: role === 'user' ? 'var(--bg-surface)' : 'var(--accent-primary)',
      border: role === 'user' ? '1px solid var(--border-subtle)' : 'none',
      color: role === 'user' ? 'var(--text-secondary)' : 'var(--bg-deep)',
      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
    }}>{role === 'user' ? 'YOU' : 'AI'}</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <style>{`
        @keyframes cp-blink { 0%,80%,100% { opacity:.2 } 40% { opacity:1 } }
        @keyframes cp-rise { from { opacity:0; transform: translateY(5px) } to { opacity:1; transform:none } }
        .cp-msg { animation: cp-rise .16s ease both; }
        .cp-dot { width:5px; height:5px; border-radius:50%; background:var(--text-tertiary); display:inline-block; animation: cp-blink 1.2s infinite both; }
        .cp-card:hover { border-color: var(--accent-primary); }
        .cp-chip:hover { background: var(--accent-primary); color: var(--bg-deep); }
        .cp-conv:hover { background: var(--bg-surface-hover); }
        .cp-conv:hover .cp-del { opacity: 1; }
        .cp-del:hover { color: var(--status-danger) !important; }
      `}</style>

      {/* Header — eyebrow + title + status pill */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={labelStyle}>Intelligence</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Copilot</div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 10,
          padding: '4px 9px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.07em',
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          color: aiAvailable ? 'var(--accent-primary)' : 'var(--text-tertiary)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: aiAvailable ? 'var(--accent-primary)' : 'var(--text-tertiary)' }} />
          {aiAvailable === null ? 'Ready' : aiAvailable ? 'Claude · Live' : 'Rules engine'}
        </span>
      </div>

      {/* Two-pane: conversation history sidebar (left) + active chat (right) */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
        {/* Sidebar */}
        <div style={{ width: 250, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ padding: 10, borderBottom: '1px solid var(--border-subtle)' }}>
            <button onClick={newChat} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none', borderRadius: 2, padding: '9px 12px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New chat
            </button>
          </div>
          <div style={{ padding: '10px 12px 4px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Conversations</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length === 0 ? (
              <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 11 }}>No conversations yet</div>
            ) : conversations.map((c: any) => (
              <div
                key={c.id}
                onClick={() => openConversation(c.id)}
                className="cp-conv"
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 10px 10px 12px', cursor: 'pointer', borderLeft: c.id === conversationId ? '2px solid var(--accent-primary)' : '2px solid transparent', background: c.id === conversationId ? 'var(--bg-surface-hover)' : 'transparent' }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || 'New conversation'}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{c.message_count} msgs · {relTime(c.updated_at)}</div>
                </div>
                <button onClick={(e) => deleteConversation(c.id, e)} className="cp-del" title="Delete" style={{ flexShrink: 0, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13, padding: 2, opacity: 0.6 }}>✕</button>
              </div>
            ))}
          </div>
        </div>

      {/* Conversation card fills remaining height; input docked inside at the bottom */}
      <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20 }}>
          {isEmpty ? (
            <div>
              <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>How can I help you run the business today?</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 620, marginBottom: 22, lineHeight: 1.55 }}>{INTRO.content}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
                {STARTERS.map(s => (
                  <button key={s.title} className="cp-card" onClick={() => send(s.prompt)}
                    style={{ textAlign: 'left', cursor: 'pointer', padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 2, transition: 'border-color .15s ease' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {messages.slice(1).map((m, i) => {
                const realIndex = i + 1;
                return (
                  <div key={realIndex} className="cp-msg" style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                    {avatar(m.role)}
                    <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        padding: '11px 14px', borderRadius: 2, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                        background: m.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-surface)',
                        color: m.role === 'user' ? 'var(--bg-deep)' : 'var(--text-primary)',
                        border: m.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                      }}>
                        {m.role === 'assistant' && m.animate ? <Typewriter text={m.content} /> : m.content}
                      </div>

                      {m.proposedAction && m.actionState === 'pending' && (
                        <div style={{ marginTop: 10, padding: 13, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--accent-primary)', borderRadius: 2 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{m.proposedAction.label}</div>
                          {m.proposedAction.detail && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 11 }}>{m.proposedAction.detail}</div>}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn-action" onClick={() => runAction(realIndex, m.proposedAction!)} disabled={loading}
                              style={{ background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none' }}>
                              {m.proposedAction.confirm_text || 'Confirm'}
                            </button>
                            <button className="btn-action" onClick={() => dismissAction(realIndex)} style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Dismiss</button>
                          </div>
                        </div>
                      )}
                      {m.proposedAction && m.actionState === 'done' && <div style={{ marginTop: 7, fontSize: 11, color: 'var(--status-success)', fontFamily: 'var(--font-mono)' }}>✓ Confirmed</div>}
                      {m.proposedAction && m.actionState === 'dismissed' && <div style={{ marginTop: 7, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Dismissed</div>}

                      {m.actions && m.actions.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                          {m.actions.map((a, j) => (
                            <button key={j} className="cp-chip" onClick={() => navigate(a.route)}
                              style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '6px 11px', fontFamily: 'var(--font-mono)', fontSize: 10.5, borderRadius: 2, cursor: 'pointer', letterSpacing: '0.04em', transition: 'all .12s ease', textTransform: 'uppercase' }}>
                              {a.label} →
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div className="cp-msg" style={{ display: 'flex', gap: 10 }}>
                  {avatar('assistant')}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '13px 15px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 2 }}>
                    <span className="cp-dot" /><span className="cp-dot" style={{ animationDelay: '.2s' }} /><span className="cp-dot" style={{ animationDelay: '.4s' }} />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Input dock */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 12, background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <textarea ref={taRef} value={input} rows={1}
              onChange={e => { setInput(e.target.value); autoGrow(); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask your copilot anything about your operations…"
              style={{ flex: 1, resize: 'none', maxHeight: 140, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 2, color: 'var(--text-primary)', fontSize: 13.5, lineHeight: 1.5, outline: 'none', fontFamily: 'var(--font-sans)', padding: '10px 12px' }} />
            <button className="btn-action" onClick={() => send()} disabled={loading || !input.trim()}
              style={{ background: input.trim() && !loading ? 'var(--accent-primary)' : 'var(--bg-surface-hover)', color: input.trim() && !loading ? 'var(--bg-deep)' : 'var(--text-tertiary)', border: 'none', padding: '10px 18px' }}>
              {loading ? '…' : 'SEND'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
