import './copilot-page.css';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { TriangleAlert, Check, Bot, Plus, ArrowUp, MessagesSquare, Trash2 } from 'lucide-react';
import SectionHeader from '@/components/layout/SectionHeader';
import OverflowMenu from '@/components/ui/OverflowMenu';
import { StatusChip } from '@/components/ui/StatusChip';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CAPITAL_LAUNCHED } from '@/lib/features';
import { toast } from '@/lib/toast';
import { normaliseFigures, formatMoney, formatDate, formatDateTime, formatDays } from '@/lib/formatters';
import { saDateISO, saDaysBetween } from '@/lib/dates';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { postData, fetchData, deleteData } from '@/lib/Api';
import { useAuth } from '@/lib/AuthContext';
import Markdown from '@/components/copilot/Markdown';
import ProposalCard, { Proposal } from '@/components/copilot/ProposalCard';
import ConversationList, { ConversationSummary, conversationTitle } from '@/components/copilot/ConversationList';
import ConversationsSheet from '@/components/copilot/ConversationsSheet';

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
  /** When the reply was written (stored created_at, or when it arrived). */
  createdAt?: string | null;
}

/**
 * The day a stretch of the conversation was written (R8): said once, as a
 * divider, when the conversation starts and whenever the day changes, so an
 * old answer's figures never read as today's without repeating the age on
 * every reply. "Today", "Yesterday", else "15 Jun 2026 · 104 days ago".
 * The full date and time of the first message that day are the title.
 */
function dayDivider(iso: string): string {
  const day = saDateISO(new Date(iso));
  if (!day) return '';
  const age = saDaysBetween(day) ?? 0;
  if (age <= 0) return 'Today';
  if (age === 1) return 'Yesterday';
  return `${formatDate(day)} · ${formatDays(age)} ago`;
}

// The Typewriter streams raw text, which would flash unrendered markdown syntax.
// Replies containing markdown (tables, fences, headings, lists, bold, links,
// inline code) skip the animation and render through <Markdown> immediately;
// plain replies animate and then hand off to <Markdown> when done (onDone).
function looksLikeMarkdown(s: string): boolean {
  return s.includes('|') || s.includes('```') || s.includes(' • ') || s.includes('**') || s.includes('`')
    || /\[[^\]]+\]\([^)]+\)/.test(s) || /^#{1,6}\s/m.test(s)
    || /^\s*[-*]\s/m.test(s) || /^\s*\d+\.\s/m.test(s);
}

/**
 * House figures in replies (display only; the stored text is untouched).
 * normaliseFigures skips an amount directly followed by a comma ("R28,443, 46
 * days"), so those are rewritten here first.
 */
const houseFigures = (text: string) => normaliseFigures(
  text.replace(/\bR\s?(\d{1,3}(?:,\d{3})+)(?=,(?:\s|$))/g, (_m, int: string) => formatMoney(Number(int.replace(/,/g, '')), 0)),
);

/** The one wording for the ask box (the top bar search uses it too). */
const ASK = 'Ask Copilot about your business';

type Starter = { title: string; prompt: string; hint: string };

const STARTERS: Starter[] = [
  { title: "What's overdue?", prompt: "What's overdue?", hint: 'Who to chase first' },
  // Fast Pay is not live: no starter invites a capacity or payout answer until it is.
  ...(CAPITAL_LAUNCHED ? [{ title: 'Fast Pay capacity', prompt: 'How much can I advance?', hint: 'Eligible invoices and net payout' }] : []),
  { title: 'Quotes pipeline', prompt: "How's my pipeline?", hint: 'Won, lost and open quotes' },
  { title: 'Fleet status', prompt: 'Fleet status', hint: 'Active, idle and in maintenance' },
];

// Extra starters for roles that can write — the agent drafts the record, the
// user confirms via the proposal card. Hidden for VIEWER/DRIVER.
const WRITE_STARTERS: Starter[] = [
  { title: 'Add a customer', prompt: 'Add a new customer', hint: 'Drafts the record for you to check' },
  { title: 'Draft a quote', prompt: 'Create a new quote', hint: 'Drafts a quote for you to check' },
];

/**
 * Suggestion grid spans on a 6-column track, so no group leaves an orphan:
 * 3 per row (span 2) or 2 per row (span 3); 4 = 2 + 2, 5 = 3 + 2, 1 = full.
 */
function groupSpans(n: number): number[] {
  const rows: number[] = [];
  let left = n;
  while (left > 0) {
    if (left === 4 || left === 2) { rows.push(2); left -= 2; }
    else if (left === 1) { rows.push(1); left -= 1; }
    else { rows.push(3); left -= 3; }
  }
  return rows.flatMap((size) => Array(size).fill(6 / size));
}

const TOPICS = CAPITAL_LAUNCHED
  ? 'Ask about cash, overdue invoices, quotes, your fleet or Fast Pay.'
  : 'Ask about cash, overdue invoices, quotes or your fleet.';

// Kept as messages[0] (never rendered): the thread logic below counts on it.
const INTRO: Message = { role: 'assistant', content: TOPICS };

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

export default function Copilot() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = (user?.name || '').split(' ')[0] || '';
  const introMsg = INTRO;
  const [params, setParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([introMsg]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ConversationSummary | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // The conversation the user is currently looking at. A reply must only be
  // applied if the user hasn't switched threads while it was in flight —
  // otherwise it lands in the wrong conversation (and reverts the pointer).
  const activeConvRef = useRef<number | null>(null);
  useEffect(() => { activeConvRef.current = conversationId; }, [conversationId]);

  const canWrite = !['VIEWER', 'DRIVER'].includes(user?.role || '');
  const readSpans = useMemo(() => groupSpans(STARTERS.length), []);
  const writeSpans = useMemo(() => groupSpans(WRITE_STARTERS.length), []);
  const starters = canWrite
    ? [...STARTERS.map((s, i) => ({ ...s, span: readSpans[i] })), ...WRITE_STARTERS.map((s, i) => ({ ...s, span: writeSpans[i] }))]
    : STARTERS.map((s, i) => ({ ...s, span: readSpans[i] }));
  const isEmpty = messages.length <= 1;
  const current = conversations.find((c) => c.id === conversationId) || null;
  const threadTitle = conversationId ? (current ? conversationTitle(current) : 'Conversation') : 'New conversation';

  // Keep the newest message in view (the thread scrolls inside its own column).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && !isEmpty) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, isEmpty]);
  useEffect(() => { document.title = 'Copilot - TruckWys'; }, []);

  const refreshConversations = useCallback(() => {
    return fetchData('api/v1/agent/conversations/')
      .then((d: any) => setConversations(d?.conversations || []))
      .catch(() => {})
      .finally(() => setConversationsLoaded(true));
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
          actions: m.actions || [], createdAt: m.created_at || null,
        }));
        setConversationId(id);
        setMessages(hist.length ? [introMsg, ...hist] : [introMsg]);
      })
      .catch(() => { toast.error("Couldn't open that conversation. Try again."); });
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
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
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
        createdAt: new Date().toISOString(),
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

  // A suggestion fills the ask box and focuses it; the user presses Send.
  const applySuggestion = (prompt: string) => {
    setInput(prompt);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(prompt.length, prompt.length);
      autoGrow();
    });
  };

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

  const executeProposal = async (msgIndex: number, id: number, acknowledged = false) => {
    if (proposalBusy) return;
    setProposalBusy(true);
    try {
      // Price warnings on a send are executed only with an explicit acknowledgement.
      const res: any = await postData({ url: `api/v1/agent/proposals/${id}/execute/`, data: acknowledged ? { acknowledge_price_warnings: true } : {} });
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
      if (e?.data?.status === 'needs_acknowledgement') {
        // Still pending: show the warnings and ask for the tick.
        patchProposal(msgIndex, {
          status: 'pending',
          price_warnings: e.data.price_warnings || [],
          requires_acknowledgement: true,
          result: { error: 'Check the price warnings, then confirm.' },
        });
      } else if (serverStatus === 'executed' || serverStatus === 'dismissed') {
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
      patchProposal(msgIndex, { result: { error: e?.message || 'Could not dismiss. Try again.' } });
    } finally {
      setProposalBusy(false);
    }
  };

  // New chat — resets to an empty thread WITHOUT touching the server. The
  // conversation row is created lazily on the first message (see send()), so an
  // unused "New chat" never gets saved to history. The previous thread is KEPT.
  const newChat = () => {
    setShowHistory(false); setInput(''); setAiAvailable(null);
    if (taRef.current) taRef.current.style.height = 'auto';
    activeConvRef.current = null;  // any in-flight reply from the previous thread is dropped
    setMessages([introMsg]); setConversationId(null);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  // Delete asks first (accessible dialog), and a failure is reported, never swallowed.
  const deleteConversation = async (c: ConversationSummary) => {
    try {
      await deleteData({ url: `api/v1/agent/conversations/${c.id}/` });
    } catch (e: any) {
      toast.error(e?.message ? `Couldn't delete the conversation. ${e.message}` : "Couldn't delete the conversation. Try again.");
      return;
    }
    if (c.id === conversationId) { activeConvRef.current = null; setMessages([introMsg]); setConversationId(null); }
    await refreshConversations();
    toast.success('Conversation deleted');
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const list = (
    <ConversationList
      conversations={conversations}
      loaded={conversationsLoaded}
      activeId={conversationId}
      onOpen={openConversation}
      onDelete={setPendingDelete}
    />
  );

  const canSend = !!input.trim() && !loading;

  return (
    <div className="copilot-page">
      <SectionHeader
        title="Copilot"
        description="Answers from your data. You approve every change."
        titleAdornment={aiAvailable === null ? undefined : (
          <StatusChip tone={aiAvailable ? 'success' : 'warning'} label={aiAvailable ? 'AI available' : 'Rules engine only'} />
        )}
        actions={
          <button type="button" className="tw-btn" onClick={newChat}>
            <Plus size={16} aria-hidden="true" />
            New chat
          </button>
        }
      />

      <div className="cp-layout">
        {/* Desktop: the conversation rail (hidden on phones; they use the sheet). */}
        <nav className="tw-card tw-card--flush cp-rail" aria-labelledby="cp-rail-title">
          <div className="cp-rail__head">
            <h2 id="cp-rail-title" className="tw-card__title">Conversations</h2>
            {conversationsLoaded && conversations.length > 0 && (
              <span className="cp-rail__count">{conversations.length}</span>
            )}
          </div>
          <div className="cp-rail__body">{list}</div>
        </nav>

        <section className="tw-card tw-card--flush cp-chat" aria-labelledby="cp-thread-title">
          <div className="cp-chat__head">
            <h2 id="cp-thread-title" className="cp-chat__title" title={threadTitle}>{threadTitle}</h2>
            <div className="cp-chat__tools">
              {conversationId && (
                <OverflowMenu
                  label="Conversation actions"
                  items={() => [{
                    label: 'Delete conversation', danger: true, icon: <Trash2 size={16} />,
                    onSelect: () => setPendingDelete(current || { id: conversationId, title: threadTitle }),
                  }]}
                />
              )}
              <button
                type="button"
                className="tw-btn cp-chats-btn"
                onClick={() => setShowHistory(true)}
                aria-haspopup="dialog"
                aria-expanded={showHistory}
              >
                <MessagesSquare size={16} aria-hidden="true" />
                Conversations
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="cp-scroll">
            {isEmpty ? (
              <div className="cp-empty">
                <h3 className="cp-empty__title">{firstName ? `Hi ${firstName}. What do you need to know?` : 'What do you need to know?'}</h3>
                <p className="cp-empty__sub">{TOPICS}</p>
                <ul className="cp-suggest" aria-label="Suggestions">
                  {starters.map((s) => (
                    <li key={s.title} style={{ gridColumn: `span ${s.span}` }}>
                      <button
                        type="button"
                        className="cp-suggest__btn"
                        onClick={() => applySuggestion(s.prompt)}
                        aria-label={`${s.title}. ${s.hint}. Puts "${s.prompt}" in the ask box`}
                      >
                        <span className="cp-suggest__title">{s.title}</span>
                        <span className="cp-suggest__hint">{s.hint}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="cp-thread" aria-live="polite" aria-relevant="additions">
                {messages.slice(1).map((m, i) => {
                  const realIndex = i + 1;
                  // A day divider before the first message of each day (R8).
                  const day = m.createdAt ? saDateISO(new Date(m.createdAt)) : null;
                  const prevDay = (() => {
                    for (let j = realIndex - 1; j >= 1; j--) {
                      const c = messages[j].createdAt;
                      if (c) return saDateISO(new Date(c));
                    }
                    return null;
                  })();
                  const divider = m.createdAt && day && day !== prevDay ? (
                    <p className="cp-day" key={`d-${realIndex}`}>
                      <time dateTime={m.createdAt} title={formatDateTime(m.createdAt)}>{dayDivider(m.createdAt)}</time>
                    </p>
                  ) : null;
                  if (m.role === 'user') {
                    return [divider,
                      <div key={realIndex} className="cp-msg cp-msg--user">
                        <span className="cp-sr">You said: </span>
                        <div className="cp-bubble">{m.content}</div>
                      </div>,
                    ];
                  }
                  return [divider,
                    <div key={realIndex} className="cp-msg cp-msg--assistant">
                      <span className="cp-mark" aria-hidden="true"><Bot size={16} /></span>
                      <div className="cp-msg__body">
                        <span className="cp-sr">Copilot: </span>
                        <div className="cp-answer">
                          {m.animate && !looksLikeMarkdown(m.content)
                            ? <Typewriter
                                text={houseFigures(m.content)}
                                onDone={() => setMessages(prev => prev.map((mm, j) =>
                                  j === realIndex ? { ...mm, animate: false } : mm))}
                              />
                            : <Markdown>{houseFigures(m.content)}</Markdown>}
                        </div>

                        {m.degraded && (
                          <p className="cp-note">
                            <TriangleAlert size={14} aria-hidden="true" /> Answered by the rules engine because AI is unavailable, so it is basic. Try again shortly.
                          </p>
                        )}

                        {m.proposal && (
                          <ProposalCard
                            proposal={m.proposal}
                            onConfirm={(ack) => executeProposal(realIndex, m.proposal!.id, ack)}
                            onDismiss={() => dismissProposal(realIndex, m.proposal!.id)}
                            busy={proposalBusy || loading}
                          />
                        )}

                        {m.proposedAction && m.actionState === 'pending' && (
                          <div className="cp-proposed">
                            <div className="cp-proposed__label">{m.proposedAction.label}</div>
                            {m.proposedAction.detail && <div className="cp-proposed__detail">{m.proposedAction.detail}</div>}
                            <div className="cp-proposed__actions">
                              <button type="button" className="tw-btn tw-btn--primary" onClick={() => runAction(realIndex, m.proposedAction!)} disabled={loading}>
                                {m.proposedAction.confirm_text || 'Confirm'}
                              </button>
                              <button type="button" className="tw-btn" onClick={() => dismissAction(realIndex)}>Dismiss</button>
                            </div>
                          </div>
                        )}
                        {m.proposedAction && m.actionState === 'done' && <p className="cp-note cp-note--ok"><Check size={14} aria-hidden="true" /> Confirmed</p>}
                        {m.proposedAction && m.actionState === 'dismissed' && <p className="cp-note">Dismissed</p>}

                        {m.actions && m.actions.length > 0 && (
                          <div className="cp-links">
                            {m.actions.map((a, j) => (
                              <button key={j} type="button" className="tw-btn tw-btn--sm" onClick={() => navigate(a.route)}>
                                {a.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>,
                  ];
                })}
                {loading && (
                  <div className="cp-msg cp-msg--assistant">
                    <span className="cp-mark" aria-hidden="true"><Bot size={16} /></span>
                    <div className="cp-msg__body">
                      <p role="status" className="cp-working">Working on an answer…</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <form
            className="cp-compose"
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            <div className="cp-compose__box">
              <label htmlFor="cp-ask" className="cp-sr">{ASK}</label>
              <textarea
                id="cp-ask"
                ref={taRef}
                value={input}
                rows={1}
                onChange={e => { setInput(e.target.value); autoGrow(); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={ASK}
                aria-describedby="cp-ask-hint"
                className="cp-compose__input"
              />
              <button type="submit" className="tw-btn tw-btn--primary cp-send" disabled={!canSend}>
                <ArrowUp size={16} aria-hidden="true" />
                <span className="cp-send__label">{loading ? 'Sending' : 'Send'}</span>
              </button>
            </div>
            <p id="cp-ask-hint" className="cp-compose__hint">Enter sends. Shift+Enter adds a line.</p>
          </form>
        </section>
      </div>

      {showHistory && (
        <ConversationsSheet onClose={() => setShowHistory(false)}>{list}</ConversationsSheet>
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete this conversation?"
          message={`"${conversationTitle(pendingDelete)}" and its messages will be removed. This can't be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => { const c = pendingDelete; deleteConversation(c); }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
