import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchData, patchData, postData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";
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

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--text-tertiary)',
  SENT: 'var(--status-warning)',
  ACCEPTED: '#22c55e',
  IT: 'var(--accent-primary)',
  COMPLETED: '#22c55e',
};

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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="card"
      onClick={onClick}
    >
      <div style={{ padding: 14, borderLeft: `2px solid ${STATUS_COLOR[quote.status] || 'var(--border-subtle)'}` }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>{quote.quote_number}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{quote.customer_name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {quote.origin} → {quote.destination}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: quote.status === 'ACCEPTED' ? 8 : 0 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-primary)' }}>{formatCurrency(parseFloat(quote.total_amount || '0'))}</span>
          <span style={{ fontSize: 10, color: quote.confidence === 'HIGH' ? '#22c55e' : quote.confidence === 'LOW' ? 'var(--status-danger)' : 'var(--status-warning)' }}>{quote.confidence}</span>
        </div>
        {quote.status === 'ACCEPTED' && onConvertToLoad && (
          <button
            onClick={(e) => onConvertToLoad(e, quote)}
            className="btn-action"
            style={{ width: '100%', fontSize: 9, padding: '6px 8px', background: 'var(--status-success)', border: 'none', pointerEvents: 'auto' }}
          >
            ✓ CONVERT TO BOOKING
          </button>
        )}
      </div>
    </div>
  );
}

// Droppable Column Component
function DroppableColumn({ columnId, items, children }: { columnId: string; items: any[]; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({
    id: columnId,
  });

  return (
    <div ref={setNodeRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SortableContext items={items.map(q => String(q.id))} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}

export function QuotesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      patchData({ url: `api/v1/quotes/${id}/`, data: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });

  const convertToLoadMutation = useMutation({
    mutationFn: (quote: any) =>
      postData({
        url: `api/v1/quotes/${quote.id}/convert_to_load/`,
        data: {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loads'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: () => {
      // Error handling - could add state here if needed
    },
  });

  const handleConvertToLoad = (e: React.MouseEvent, quote: any) => {
    e.stopPropagation();
    if (confirm(`Convert quote ${quote.quote_number} to a booking/load?`)) {
      convertToLoadMutation.mutate(quote);
    }
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

    // Optimistically update UI and call API
    statusMutation.mutate({ id: quoteId, status: newStatus });
  };

  const activeQuote = activeQuoteId ? quotes.find(q => String(q.id) === activeQuoteId) : null;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Operations</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Loads & Quotes</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-action" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} onClick={() => navigate('/quotes/new')}>
              + NEW QUOTE
            </button>
            <button className="btn-action" onClick={() => navigate('/quotes/new')}>+ NEW LOAD</button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search loads, customers, routes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '8px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 12, outline: 'none', width: 280, fontFamily: 'var(--font-sans)' }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {(['board', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? 'var(--accent-primary)' : 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: view === v ? 'var(--bg-deep)' : 'var(--text-secondary)',
              padding: '7px 14px',
              borderRadius: 2,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.06em',
              fontWeight: view === v ? 600 : 400,
              transition: 'all 0.2s ease',
            }}>{v}</button>
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
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 12 }}>QUOTES PIPELINE — DRAG TO UPDATE STATUS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
            {COLUMNS.map(col => (
              <div key={col}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 2px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[col] || 'var(--text-secondary)', letterSpacing: '0.08em' }}>{COLUMN_LABELS[col]}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-surface-hover)', padding: '2px 6px', borderRadius: 2 }}>{quotesByStatus[col]?.length || 0}</span>
                </div>
                <DroppableColumn columnId={col} items={quotesByStatus[col] || []}>
                  {(quotesByStatus[col] || []).map((q: any) => (
                    <DraggableQuoteCard
                      key={q.id}
                      quote={q}
                      onClick={() => navigate(`/quotes/${q.id}`)}
                      onConvertToLoad={handleConvertToLoad}
                    />
                  ))}
                  {(quotesByStatus[col] || []).length === 0 && (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, border: '1px dashed var(--border-subtle)', borderRadius: 2 }}>—</div>
                  )}
                </DroppableColumn>
              </div>
            ))}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeQuote ? (
              <div className="card" style={{ padding: 14, borderLeft: `2px solid ${STATUS_COLOR[activeQuote.status] || 'var(--border-subtle)'}`, opacity: 0.9, boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>{activeQuote.quote_number}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{activeQuote.customer_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {activeQuote.origin} → {activeQuote.destination}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-primary)' }}>{formatCurrency(parseFloat(activeQuote.total_amount || '0'))}</span>
                  <span style={{ fontSize: 10, color: activeQuote.confidence === 'HIGH' ? '#22c55e' : activeQuote.confidence === 'LOW' ? 'var(--status-danger)' : 'var(--status-warning)' }}>{activeQuote.confidence}</span>
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
                  padding: '7px 14px',
                  borderRadius: 2,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.06em',
                  fontWeight: statusFilter === status ? 600 : 400,
                  transition: 'all 0.2s ease',
                }}
              >
                {status === 'ALL' ? 'ALL' : COLUMN_LABELS[status]} ({status === 'ALL' ? quotes.length : quotesByStatus[status]?.length || 0})
              </button>
            ))}
          </div>

          <div className="card table-card">
            <table className="data-table">
              <thead>
                <tr><th>Quote #</th><th>Customer</th><th>Route</th><th>Total</th><th>Status</th><th className="text-right">Created</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredQuotes.map((quote: any) => (
                  <tr key={quote.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/quotes/${quote.id}`)}>
                    <td className="mono">{quote.quote_number}</td>
                    <td>{quote.customer_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{quote.origin} → {quote.destination}</td>
                    <td style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(parseFloat(quote.total_amount || '0'))}</td>
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: STATUS_COLOR[quote.status] || 'var(--text-secondary)',
                        padding: '2px 6px',
                        background: 'var(--bg-surface-hover)',
                        borderRadius: 2
                      }}>
                        {COLUMN_LABELS[quote.status] || quote.status}
                      </span>
                    </td>
                    <td className="text-right" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      {quote.created_at ? new Date(quote.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {quote.status === 'ACCEPTED' && (
                        <button
                          onClick={(e) => handleConvertToLoad(e, quote)}
                          className="btn-action"
                          style={{ fontSize: 9, padding: '4px 8px', background: 'var(--status-success)', border: 'none' }}
                        >
                          → BOOKING
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredQuotes.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>No quotes found</div>}
          </div>
        </>
      )}
    </div>
  );
}
