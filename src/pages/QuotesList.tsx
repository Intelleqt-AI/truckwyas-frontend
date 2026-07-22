import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchData, patchData, postData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";
import { LiveBadge } from "@/components/LiveBadge";
import { toast } from "@/lib/toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ConvertToBookingModal } from "@/components/ConvertToBookingModal";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Distinct hue per pipeline stage so the board reads as progression
// (the design system's --status-success and --accent-primary are the same blue,
// which made Accepted / In-Transit / Completed indistinguishable).
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--text-tertiary)',   // neutral grey
  SENT: '#F59E0B',                 // amber — awaiting reply
  ACCEPTED: '#22C55E',             // green — won
  IT: 'var(--accent-primary)',     // blue — in motion
  COMPLETED: '#14B8A6',            // teal — done
};

const WON_GREEN = '#22C55E';
const WON_GREEN_BG = 'rgba(34,197,94,0.12)';

const confidenceColor = (c?: string) =>
  c === 'HIGH' ? WON_GREEN : c === 'LOW' ? 'var(--status-danger)' : 'var(--status-warning)';

const routeOf = (q: any) =>
  `${q.origin || q.pickup_location || '—'} → ${q.destination || q.delivery_location || '—'}`;

// Sentence-case a single-word token for display: "HIGH" → "High".
const sentenceCase = (s?: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';

const COLUMNS = ['DRAFT', 'SENT', 'ACCEPTED', 'IT', 'COMPLETED'];
const COLUMN_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  IT: 'In-Transit',
  COMPLETED: 'Completed',
};

// Draggable Quote Card Component
function DraggableQuoteCard({ quote, onClick, onConvertToLoad }: { quote: any; onClick: () => void; onConvertToLoad?: (e: React.MouseEvent, quote: any) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(quote.id) });

  const accent = STATUS_COLOR[quote.status] || 'var(--border-subtle)';
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 2,
    boxShadow: isDragging ? '0 8px 16px rgba(0,0,0,0.25)' : 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
    >
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 6, background: accent, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>{quote.quote_number}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {quote.fuel_alert && (
              <span title={`Fuel price +${quote.fuel_delta_pct}% since quote created`} style={{ fontSize: 11 }}>⛽</span>
            )}
            {quote.outcome === 'accepted' && (
              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', display: 'inline-block', background: WON_GREEN_BG, color: WON_GREEN, border: `1px solid ${WON_GREEN}`, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>✓ Won</span>
            )}
            {quote.outcome === 'rejected' && (
              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', display: 'inline-block', background: 'var(--status-danger-bg)', color: 'var(--status-danger)', border: '1px solid var(--status-danger)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>✗ Lost</span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{quote.customer_name || '—'}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
          {routeOf(quote)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: quote.status === 'ACCEPTED' ? 10 : 0 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(parseFloat(quote.total_amount || '0'))}</span>
          {quote.confidence && (
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 500, letterSpacing: '0.05em', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', display: 'inline-block', color: confidenceColor(quote.confidence), border: `1px solid ${confidenceColor(quote.confidence)}` }}>{sentenceCase(quote.confidence)}</span>
          )}
        </div>
        {quote.status === 'ACCEPTED' && onConvertToLoad && (
          <button
            onClick={(e) => onConvertToLoad(e, quote)}
            style={{ width: '100%', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 500, letterSpacing: '0.05em', padding: '7px 8px', background: 'transparent', border: `1px solid ${WON_GREEN}`, color: WON_GREEN, borderRadius: 2, cursor: 'pointer', pointerEvents: 'auto' }}
          >
            → Convert to booking
          </button>
        )}
      </div>
    </div>
  );
}

// Droppable Column Component
function DroppableColumn({ columnId, items, children }: { columnId: string; items: any[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
  });

  return (
    <div ref={setNodeRef} style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      minHeight: 80, padding: 4, borderRadius: 4,
      background: isOver ? 'var(--bg-surface)' : 'transparent',
      outline: isOver ? '1px dashed var(--accent-primary)' : '1px solid transparent',
      transition: 'background 0.15s ease',
    }}>
      <SortableContext items={items.map(q => String(q.id))} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}

export function QuotesList({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [confirmOpts, setConfirmOpts] = useState<{ title: string; message: string; confirmLabel?: string; onConfirm: () => void } | null>(null);
  const [pendingConvertQuote, setPendingConvertQuote] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: loadsData } = useQuery({
    queryKey: ['loads'],
    queryFn: () => fetchData('api/v1/loads/'),
    retry: 1,
  });

  const { data: quotesData } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => fetchData('api/v1/quotes/'),
    retry: 1,
  });

  const loads: any[] = loadsData?.results || loadsData || [];
  const quotes: any[] = quotesData?.results || quotesData || [];

  // Live update: refetch when backend pushes any quote event over WebSocket
  useEffect(() => {
    const handler = (e: Event) => {
      const { detail } = (e as CustomEvent);
      if (typeof detail?.event === 'string' && detail.event.startsWith('quote.')) {
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
      }
    };
    window.addEventListener('tw:live-event', handler);
    return () => window.removeEventListener('tw:live-event', handler);
  }, [queryClient]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      patchData({ url: `api/v1/quotes/${id}/`, data: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });

  const convertToLoadMutation = useMutation({
    mutationFn: ({ quote, driverId, vehicleId }: { quote: any; driverId: string; vehicleId: string }) =>
      postData({
        url: `api/v1/quotes/${quote.id}/convert_to_load/`,
        data: { driver_id: driverId, vehicle_id: vehicleId },
      }).then(data => ({ data, quote })),
    onSuccess: ({ quote }) => {
      // Invalidate both keys — QuotesList uses 'loads', LoadsList uses 'loads-list'
      queryClient.invalidateQueries({ queryKey: ['loads'] });
      queryClient.invalidateQueries({ queryKey: ['loads-list'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setPendingConvertQuote(null);
      toast.success(`Quote ${quote.quote_number} converted to load`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to convert quote to load');
    },
  });

  const handleConvertToLoad = (e: React.MouseEvent, quote: any) => {
    e.stopPropagation();
    setPendingConvertQuote(quote);
  };

  const filteredLoads = loads.filter(l =>
    !search ||
    l.load_number?.toLowerCase().includes(search.toLowerCase()) ||
    l.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.pickup_location?.toLowerCase().includes(search.toLowerCase()) ||
    l.delivery_location?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredQuotes = quotes.filter(q => {
    const matchesSearch = !search ||
      q.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
      q.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      q.pickup_location?.toLowerCase().includes(search.toLowerCase()) ||
      q.delivery_location?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const quotesByStatus = COLUMNS.reduce((acc, col) => {
    acc[col] = filteredQuotes.filter(q => q.status === col);
    return acc;
  }, {} as Record<string, any[]>);

  // Drop unrecognised statuses into DRAFT
  filteredQuotes.forEach(q => {
    if (!COLUMNS.includes(q.status)) {
      quotesByStatus['DRAFT'].push(q);
    }
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveQuoteId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveQuoteId(null);

    if (!over) return;

    const quoteId = active.id as string;
    const newStatus = over.id as string;

    // Only update if dropped on a column
    if (!COLUMNS.includes(newStatus)) return;

    const quote = quotes.find(q => String(q.id) === quoteId);
    if (!quote || quote.status === newStatus) return;

    // Dragging to In-Transit must create a load record, not just patch status —
    // and that now requires picking a driver + vehicle, so open the same modal
    // the "Convert to Booking" button uses rather than converting immediately.
    if (newStatus === 'IT') {
      setPendingConvertQuote(quote);
    } else {
      statusMutation.mutate({ id: quoteId, status: newStatus });
    }
  };

  const activeQuote = activeQuoteId ? quotes.find(q => String(q.id) === activeQuoteId) : null;

  return (
    <div>
      {/* Header — hidden when embedded in Bookings tabs */}
      {!embedded && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Operations</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Loads & Quotes</div>
              <LiveBadge />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-action" style={{ background: 'var(--accent-primary)', color: 'var(--bg-deep)' }} onClick={() => navigate('/bookings/quotes/ai-chat')}>
                AI quote
              </button>
              <button className="btn-action" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} onClick={() => navigate('/bookings/quotes/new')}>
                + New quote
              </button>
              <button className="btn-action" onClick={() => navigate('/bookings/quotes/new')}>+ New load</button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search loads, customers, routes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '6px 10px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 12, outline: 'none', width: 280, fontFamily: 'var(--font-sans)' }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {(['board', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? 'var(--accent-primary)' : 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: view === v ? 'var(--bg-deep)' : 'var(--text-secondary)',
              padding: '6px 12px',
              borderRadius: 2,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              letterSpacing: '0.06em',
              fontWeight: view === v ? 500 : 400,
              transition: 'all 0.2s ease',
            }}>{v === 'board' ? 'Board' : 'List'}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
          <span>{quotes.length} quotes</span>
        </div>

      </div>

      {/* Tabs */}
      {view === 'board' ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Quotes Kanban */}
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 16 }}>QUOTES PIPELINE — DRAG TO UPDATE STATUS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24, alignItems: 'start' }}>
            {COLUMNS.map(col => {
              const colItems = quotesByStatus[col] || [];
              const colTotal = colItems.reduce((s, q) => s + parseFloat(q.total_amount || '0'), 0);
              return (
              <div key={col}>
                <div style={{ borderTop: `2px solid ${STATUS_COLOR[col] || 'var(--border-subtle)'}`, paddingTop: 8, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[col] || 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{COLUMN_LABELS[col]}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-surface-hover)', padding: '2px 7px', borderRadius: 10 }}>{colItems.length}</span>
                  </div>
                  {colTotal > 0 && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', padding: '4px 2px 0' }}>{formatCurrency(colTotal)}</div>
                  )}
                </div>
                <DroppableColumn columnId={col} items={colItems}>
                  {colItems.map((q: any) => (
                    <DraggableQuoteCard
                      key={q.id}
                      quote={q}
                      onClick={() => navigate(`/bookings/quotes/${q.id}`)}
                      onConvertToLoad={handleConvertToLoad}
                    />
                  ))}
                  {colItems.length === 0 && (
                    <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 11, border: '1px dashed var(--border-subtle)', borderRadius: 2 }}>Drop here</div>
                  )}
                </DroppableColumn>
              </div>
              );
            })}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeQuote ? (
              <div style={{ padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 2, boxShadow: '0 8px 16px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 6, background: STATUS_COLOR[activeQuote.status] || 'var(--border-subtle)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>{activeQuote.quote_number}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{activeQuote.customer_name || '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {routeOf(activeQuote)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(parseFloat(activeQuote.total_amount || '0'))}</span>
                  {activeQuote.confidence && (
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 500, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', display: 'inline-block', color: confidenceColor(activeQuote.confidence), border: `1px solid ${confidenceColor(activeQuote.confidence)}` }}>{sentenceCase(activeQuote.confidence)}</span>
                  )}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* List view — quotes table */
        <>
          {/* Status filter tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['ALL', ...COLUMNS].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  background: statusFilter === status ? 'var(--accent-primary)' : 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: statusFilter === status ? 'var(--bg-deep)' : 'var(--text-secondary)',
                  padding: '6px 12px',
                  borderRadius: 2,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                  fontWeight: statusFilter === status ? 500 : 400,
                  transition: 'all 0.2s ease',
                }}
              >
                {status === 'ALL' ? 'All' : COLUMN_LABELS[status]} ({status === 'ALL' ? quotes.length : quotesByStatus[status]?.length || 0})
              </button>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-deep)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['QUOTE #', 'CUSTOMER', 'ROUTE', 'STATUS', 'OUTCOME', 'CREATED', 'AMOUNT', 'ACTION'].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px',
                      textAlign: h === 'AMOUNT' ? 'right' : h === 'ACTION' ? 'center' : 'left',
                      fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
                      fontWeight: 500, letterSpacing: '0.08em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map((quote: any, idx: number) => (
                  <tr
                    key={quote.id}
                    onClick={() => navigate(`/bookings/quotes/${quote.id}`)}
                    style={{
                      borderBottom: idx < filteredQuotes.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      cursor: 'pointer', transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {quote.quote_number}
                      {quote.fuel_alert && (
                        <span title={`Fuel price +${quote.fuel_delta_pct}% since quote created`} style={{ fontSize: 11, marginLeft: 6 }}>⛽</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{quote.customer_name || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }} title={routeOf(quote)}>{routeOf(quote)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-mono)', fontSize: 10,
                        color: STATUS_COLOR[quote.status] || 'var(--text-secondary)',
                        padding: '4px 8px',
                        border: `1px solid ${STATUS_COLOR[quote.status] || 'var(--border-subtle)'}`,
                        borderRadius: 4,
                      }}>
                        {COLUMN_LABELS[quote.status] || quote.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {quote.outcome === 'accepted' && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px', background: WON_GREEN_BG, color: WON_GREEN, border: `1px solid ${WON_GREEN}`, borderRadius: 4, whiteSpace: 'nowrap', display: 'inline-block', fontWeight: 500 }}>✓ Won</span>
                      )}
                      {quote.outcome === 'rejected' && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px', background: 'var(--status-danger-bg)', color: 'var(--status-danger)', border: '1px solid var(--status-danger)', borderRadius: 4, whiteSpace: 'nowrap', display: 'inline-block', fontWeight: 500 }}>✗ Lost</span>
                      )}
                      {(!quote.outcome || quote.outcome === 'pending') && (
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {quote.created_at ? new Date(quote.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {formatCurrency(parseFloat(quote.total_amount || '0'))}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      {quote.status === 'ACCEPTED' && (
                        <button
                          onClick={(e) => handleConvertToLoad(e, quote)}
                          style={{ background: 'transparent', border: `1px solid ${WON_GREEN}`, color: WON_GREEN, padding: '4px 10px', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', borderRadius: 2, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          → Booking
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredQuotes.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>No quotes found</div>}
          </div>
        </>
      )}

      {confirmOpts && (
        <ConfirmModal
          title={confirmOpts.title}
          message={confirmOpts.message}
          confirmLabel={confirmOpts.confirmLabel}
          onConfirm={confirmOpts.onConfirm}
          onCancel={() => setConfirmOpts(null)}
        />
      )}

      {pendingConvertQuote && (
        <ConvertToBookingModal
          quoteNumber={pendingConvertQuote.quote_number}
          busy={convertToLoadMutation.isPending}
          onConfirm={(driverId, vehicleId) => convertToLoadMutation.mutate({ quote: pendingConvertQuote, driverId, vehicleId })}
          onCancel={() => setPendingConvertQuote(null)}
        />
      )}
    </div>
  );
}
