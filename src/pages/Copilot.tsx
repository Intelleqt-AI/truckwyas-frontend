import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { postData, fetchData, deleteData } from '@/lib/Api';
import { useAuth } from '@/lib/AuthContext';
import Markdown from '@/components/copilot/Markdown';
import ProposalCard, { Proposal } from '@/components/copilot/ProposalCard';

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
  proposal?: Proposal | null;
  animate?: boolean;
  degraded?: boolean; // reply came from the rules engine (AI unavailable), not the LLM
}

// The Typewriter streams raw text, which would flash unrendered markdown syntax.
// Replies containing markdown (tables, fences, headings, lists, bold, links,
// inline code) skip the animation and render through <Markdown> immediately;
// plain replies animate and then hand off to <Markdown> when done (onDone).
function looksLikeMarkdown(s: string): boolean {
  return s.includes('|') || s.includes('```') || s.includes('**') || s.includes('`')
    || /\[[^\]]+\]\([^)]+\)/.test(s) || /^#{1,6}\s/m.test(s)
    || /^\s*[-*]\s/m.test(s) || /^\s*\d+\.\s/m.test(s);
}

const STARTERS: { title: string; prompt: string; hint: string }[] = [
  { title: "What's overdue?", prompt: "What's overdue?", hint: 'Chase the right accounts first' },
  { title: 'Fast-pay capacity', prompt: 'How much can I advance?', hint: 'Eligible invoices & net payout' },
  { title: 'Quotes pipeline', prompt: "How's my pipeline?", hint: 'Win/loss & open quotes' },
  { title: 'Fleet status', prompt: 'Fleet status', hint: 'Active, idle & maintenance' },
];

// Extra starters for roles that can write — the agent drafts the record, the
// user confirms via the proposal card. Hidden for VIEWER/DRIVER.
const WRITE_STARTERS: { title: string; prompt: string; hint: string }[] = [
  { title: 'Add a customer', prompt: 'Add a new customer', hint: 'Draft a record — you confirm before it saves' },
  { title: 'Draft a quote', prompt: 'Create a new quote', hint: 'Propose a quote for your confirmation' },
];

const GENERIC_INTRO_TEXT = "I'm your TruckWys copilot. Ask me about your cash position, overdue invoices, quotes pipeline, fleet status or fast-pay capacity — I answer from your live data.";

function buildIntro(firstName?: string): Message {
  return {
    role: 'assistant',
    content: firstName ? `Hi ${firstName} — ${GENERIC_INTRO_TEXT}` : GENERIC_INTRO_TEXT,
  };
}

// Lightweight typewriter for the streaming feel (used on freshly-arrived replies).
// Calls onDone when finished so the message can re-render through <Markdown>.
function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setN(Math.min(text.length, i));
      if (i >= text.length) {
        clearInterval(id);
        onDone?.();
      }
    }, 12);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return <>{text.slice(0, n)}</>;
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
  letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4,
};

export default function Copilot() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const introMsg = useMemo(() => buildIntro((user?.name || '').split(' ')[0] || undefined), [user?.name]);
  const [params, setParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([introMsg]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // The conversation the user is currently looking at. A reply must only be
  // applied if the user hasn't switched threads while it was in flight —
  // otherwise it lands in the wrong conversation (and reverts the pointer).
  const activeConvRef = useRef<number | null>(null);
  useEffect(() => { activeConvRef.current = conversationId; }, [conversationId]);

  const canWrite = !['VIEWER', 'DRIVER'].includes(user?.role || '');
  const starters = canWrite ? [...STARTERS, ...WRITE_STARTERS] : STARTERS;
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
    activeConvRef.current = id;  // switch the active thread now so any in-flight reply is dropped
    fetchData(`api/v1/agent/conversations/${id}/`)
      .then((d: any) => {
        // Proposals persist server-side; rehydrate their cards with live status
        // (pending/executed/dismissed/failed/expired) so history stays truthful.
        const hist = (d?.messages || []).map((m: any) => ({
          role: m.role, content: m.content, proposal: m.proposal || null,
          actions: m.actions || [],
        }));
        setConversationId(id);
        setMessages(hist.length ? [introMsg, ...hist] : [introMsg]);
      })
      .catch(() => {});
  }, [introMsg]);

  // On mount (e.g. clicking "Copilot" in the sidebar): always start a fresh
  // chat. We only load the conversation list so past chats stay browsable in
  // the history sidebar — we do NOT auto-open the last one.
  useEffect(() => {
    refreshConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Visible outside the try so the catch guard can compare against it too.
    let convId = conversationId;
    try {
      // Each conversation has its own chat endpoint; the server owns the history,
      // so we only send the new message. Create a conversation first if needed.
      if (!convId) {
        const created: any = await postData({ url: 'api/v1/agent/conversations/', data: {} });
        convId = created?.id ?? null;
        if (convId) { setConversationId(convId); activeConvRef.current = convId; }
      }
      const res: any = await postData({ url: `api/v1/agent/conversations/${convId}/chat/`, data: { message: content } });
      // The user may have switched threads (or started a new chat) while this was
      // in flight — if so, drop the reply here. It's already persisted server-side
      // and will appear when they reopen this thread. Applying it now would render
      // it into the wrong conversation.
      if (activeConvRef.current !== convId) return;
      setAiAvailable(!!res?.ai_available);
      if (res?.conversation_id && res.conversation_id !== conversationId) setConversationId(res.conversation_id);
      setMessages(prev => [...prev, {
        role: 'assistant', content: res?.reply || 'Sorry, I could not produce a response.',
        actions: res?.actions || [], proposedAction: res?.proposed_action || null,
        actionState: res?.proposed_action ? 'pending' : undefined,
        proposal: res?.proposal || null, animate: true,
        degraded: res?.ai_available === false,
      }]);
      refreshConversations();
    } catch (e: any) {
      if (activeConvRef.current !== convId) return;
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
      const followUp: Action = a.type === 'request_advance'
        ? { label: 'View in Fast Pay', route: res?.id ? `/capital/advances/${res.id}` : '/capital' }
        : { label: 'Open Invoices', route: '/finance/invoices' };
      setMessages(prev => {
        const next = prev.map((m, i) => i === msgIndex ? { ...m, actionState: 'done' as const } : m);
        return [...next, { role: 'assistant' as const, content: a.success_text || 'Done.', animate: true, actions: [followUp] }];
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

  // --- Server-side proposals (AI-drafted CREATE/UPDATE/DELETE, user-confirmed) ---

  const patchProposal = (msgIndex: number, patch: Partial<Proposal>) =>
    setMessages(prev => prev.map((m, i) =>
      i === msgIndex && m.proposal ? { ...m, proposal: { ...m.proposal, ...patch } } : m));

  const executeProposal = async (msgIndex: number, id: number) => {
    if (proposalBusy) return;
    setProposalBusy(true);
    try {
      const res: any = await postData({ url: `api/v1/agent/proposals/${id}/execute/`, data: {} });
      if (res?.status === 'executed') {
        setMessages(prev => {
          const next = prev.map((m, i) =>
            i === msgIndex && m.proposal ? { ...m, proposal: { ...m.proposal, status: 'executed' as const, result: res?.result || null } } : m);
          return [...next, {
            role: 'assistant' as const, content: res?.message || 'Done.',
            actions: res?.action ? [res.action] : [], animate: true,
          }];
        });
        refreshConversations();
      } else {
        // Defensive: a 200 that isn't "executed" is treated as a failure.
        patchProposal(msgIndex, { status: 'failed', result: { error: res?.error || 'The action could not be completed.' } });
      }
    } catch (e: any) {
      // The server includes the proposal's authoritative state on errors
      // (proposal_status): a 409 from a card that already executed in another
      // tab must show "Saved", not "Failed". Fall back to failed otherwise.
      const serverStatus = e?.data?.proposal_status as Proposal['status'] | undefined;
      if (serverStatus === 'executed' || serverStatus === 'dismissed') {
        patchProposal(msgIndex, { status: serverStatus });
      } else {
        patchProposal(msgIndex, {
          status: serverStatus === 'expired' ? 'expired' : 'failed',
          result: { error: e?.message || 'The action could not be completed.' },
        });
      }
    } finally {
      setProposalBusy(false);
    }
  };

  const dismissProposal = async (msgIndex: number, id: number) => {
    if (proposalBusy) return;
    setProposalBusy(true);
    try {
      await postData({ url: `api/v1/agent/proposals/${id}/dismiss/`, data: {} });
      // Only mark dismissed once the SERVER confirms it. Marking it locally on a
      // failed call would leave the card "Dismissed" here while it stays PENDING
      // on the server, so reopening the thread resurrects a confirmable card.
      patchProposal(msgIndex, { status: 'dismissed' });
    } catch (e: any) {
      patchProposal(msgIndex, { result: { error: e?.message || 'Could not dismiss — please try again.' } });
    } finally {
      setProposalBusy(false);
    }
  };

  // New chat — resets to an empty thread WITHOUT touching the server. The
  // conversation row is created lazily on the first message (see send()), so an
  // unused "New chat" never gets saved to history. The previous thread is KEPT.
  const newChat = () => {
    setShowHistory(false); setInput(''); setAiAvailable(null);
    activeConvRef.current = null;  // any in-flight reply from the previous thread is dropped
    setMessages([introMsg]); setConversationId(null);
  };

  const deleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    await deleteData({ url: `api/v1/agent/conversations/${id}/` }).catch(() => {});
    if (id === conversationId) { setMessages([introMsg]); setConversationId(null); }
    refreshConversations();
  };

  const avatar = (role: 'user' | 'assistant') => {
    const userAvatar = (user?.avatar as string) || undefined;
    if (role === 'user' && userAvatar) {
      return (
        <img
          src={userAvatar}
          alt="You"
          style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 2, objectFit: 'cover' }}
        />
      );
    }
    return (
      <div style={{
        flexShrink: 0, width: 26, height: 26, borderRadius: 2, display: 'grid', placeItems: 'center',
        background: role === 'user' ? 'var(--bg-surface)' : 'var(--accent-primary)',
        border: role === 'user' ? '1px solid var(--border-subtle)' : 'none',
        color: role === 'user' ? 'var(--text-secondary)' : 'var(--bg-deep)',
        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
      }}>{role === 'user' ? 'YOU' : 'AI'}</div>
    );
  };

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
        .cp-md > :last-child { margin-bottom: 0 !important; }
      `}</style>

      {/* Header — eyebrow + title + status pill */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={labelStyle}>Intelligence</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Copilot</div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 10,
          padding: '4px 9px', borderRadius: 2, letterSpacing: '0.07em',
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          color: aiAvailable ? 'var(--accent-primary)' : 'var(--text-tertiary)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: aiAvailable ? 'var(--accent-primary)' : 'var(--text-tertiary)' }} />
          {aiAvailable === null ? 'Ready' : aiAvailable ? 'AI · Live' : 'Rules engine'}
        </span>
      </div>

      {/* Two-pane: conversation history sidebar (left) + active chat (right) */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
        {/* Sidebar */}
        <div style={{ width: 250, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ padding: 10, borderBottom: '1px solid var(--border-subtle)' }}>
            <button onClick={newChat} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none', borderRadius: 2, padding: '9px 12px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em' }}>
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
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 620, marginBottom: 22, lineHeight: 1.55 }}>{introMsg.content}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
                {starters.map(s => (
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
                        {m.role === 'user'
                          ? m.content
                          : m.animate && !looksLikeMarkdown(m.content)
                            ? <Typewriter
                                text={m.content}
                                onDone={() => setMessages(prev => prev.map((mm, j) =>
                                  j === realIndex ? { ...mm, animate: false } : mm))}
                              />
                            : <Markdown>{m.content}</Markdown>}
                      </div>

                      {m.role === 'assistant' && m.degraded && (
                        <div style={{ marginTop: 5, fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                          ⚠ Rules engine — AI is unavailable, so this answer is basic. Try again shortly.
                        </div>
                      )}

                      {m.proposal && (
                        <ProposalCard
                          proposal={m.proposal}
                          onConfirm={() => executeProposal(realIndex, m.proposal!.id)}
                          onDismiss={() => dismissProposal(realIndex, m.proposal!.id)}
                          busy={proposalBusy || loading}
                        />
                      )}

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
              {loading ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
