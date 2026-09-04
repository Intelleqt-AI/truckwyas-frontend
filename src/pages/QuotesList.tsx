import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { fetchData, patchData, postData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";
import { LiveBadge } from "@/components/LiveBadge";
import { Loader } from "@/components/Loader";
import { toast } from "@/lib/toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ConvertToBookingModal } from "@/components/ConvertToBookingModal";
import { useAuth } from "@/lib/AuthContext";
import { isSubscriptionBlocked, subscriptionStatusDetail } from "@/lib/subscriptionStatus";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
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
// which made Accepted / Declined indistinguishable from neutral).
// IT/COMPLETED aren't pipeline columns anymore (that's the Order's delivery
// status now — see convert_to_load) but the colors stay so any pre-existing
// quote still carrying one of those statuses renders sensibly in the list view.
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--text-tertiary)',   // neutral grey
  SENT: '#F59E0B',                 // amber — awaiting reply
  ACCEPTED: '#22C55E',             // green — won
  DECLINED: 'var(--status-danger)',
  IT: 'var(--accent-primary)',     // blue — in motion (legacy)
  COMPLETED: '#14B8A6',            // teal — done (legacy)
};

const WON_GREEN = '#22C55E';
const WON_GREEN_BG = 'rgba(34,197,94,0.12)';

const confidenceColor = (c?: string) =>
  c === 'HIGH' ? WON_GREEN : c === 'LOW' ? 'var(--status-danger)' : 'var(--status-warning)';

// Full route chain, stops included — same data the quote and its map show
// elsewhere, not just the pickup/delivery pair. Shared by every place this
// page lists a quote's route (the table, the board card, the detail panel).
const routeOf = (q: any) => {
  const stopLabels = Array.isArray(q.stops) ? q.stops.map((s: { location: string }) => s.location).filter(Boolean) : [];
  // Full address everywhere, matching what stops already show — the short
  // code (origin/destination, e.g. "DUR") is only a fallback for the rare
  // older quote that has a code but no saved location text.
  return [q.pickup_location || q.origin || '—', ...stopLabels, q.delivery_location || q.destination || '—'].join(' → ');
};

// Sentence-case a single-word token for display: "HIGH" → "High".
const sentenceCase = (s?: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';

// A quote's own lifecycle ends at Accepted or Declined — once accepted it
// converts to an Order (Load), which owns delivery status from there
// (Pending/Assigned/Loading/In-Transit/Delivered/Invoiced). IT/COMPLETED
// used to double as quote-pipeline columns too, which let a quote be
// dragged straight to "Completed" with no Order behind it at all.
const COLUMNS = ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED'];
const COLUMN_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  // Not board columns — kept only so a quote from before this change still
  // renders a readable label in the list view instead of the raw code.
  IT: 'In-Transit',
  COMPLETED: 'Completed',
};

// Draggable Quote Card Component
function DraggableQuoteCard({ quote, onClick, onConvertToLoad, onViewBooking, convertedLoad, dragDisabled }: { quote: any; onClick: () => void; onConvertToLoad?: (e: React.MouseEvent, quote: any) => void; onViewBooking?: (e: React.MouseEvent, load: any) => void; convertedLoad?: any; dragDisabled?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(quote.id), disabled: dragDisabled });

  const accent = STATUS_COLOR[quote.status] || 'var(--border-subtle)';
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: dragDisabled ? 'pointer' : (isDragging ? 'grabbing' : 'grab'),
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
      {...(dragDisabled ? {} : listeners)}
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
        <div style={{
          fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
        }} title={routeOf(quote)}>
          {routeOf(quote)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: quote.status === 'ACCEPTED' ? 10 : 0 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(parseFloat(quote.total_amount || '0'))}</span>
          {quote.confidence && (
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 500, letterSpacing: '0.05em', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', display: 'inline-block', color: confidenceColor(quote.confidence), border: `1px solid ${confidenceColor(quote.confidence)}` }}>{sentenceCase(quote.confidence)}</span>
          )}
        </div>
        {quote.status === 'ACCEPTED' && convertedLoad && (
          <button
            onClick={(e) => onViewBooking?.(e, convertedLoad)}
            style={{ width: '100%', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 500, letterSpacing: '0.05em', padding: '7px 8px', background: WON_GREEN_BG, border: `1px solid ${WON_GREEN}`, color: WON_GREEN, borderRadius: 2, cursor: 'pointer', pointerEvents: 'auto' }}
          >
            ✓ Converted — View booking →
          </button>
        )}
        {quote.status === 'ACCEPTED' && !convertedLoad && onConvertToLoad && (
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

// Droppable Column Component.
// `isOver` is driven by the parent (resolved from the drag's current `over`
// id, whether that's the column itself or one of its cards) rather than this
// hook's own isOver — dnd-kit reports `over` as the nearest droppable under
// the pointer, which is the *card* once the column is full and there's no
// empty space left to hover, so this hook's isOver alone misses that case.
function DroppableColumn({ columnId, items, children, isOver }: { columnId: string; items: any[]; children: React.ReactNode; isOver?: boolean }) {
  const { setNodeRef } = useDroppable({
    id: columnId,
  });

  return (
    <div ref={setNodeRef} style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      minHeight: 80, padding: 2, borderRadius: 4,
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

const QUOTE_PAGE_SIZE = 10;

interface QuotePage {
  results: any[];
  count: number;
  next: string | null;
  total_amount?: string | number;
}

// One pipeline column's data, fetched independently from the backend —
// 10 at a time, with more pages pulled in on "Load more" rather than every
// quote in the column being fetched up front. `status: null` fetches every
// status (used by the List view's "All" tab). Every board column AND the
// List view's per-status tabs share the exact same query (and thus cache)
// keyed by status+search — switching between Board/List, or between List's
// status tabs, doesn't lose "load more" progress or refetch redundantly.
function useQuoteColumn(status: string | null, search: string, enabled: boolean = true) {
  return useInfiniteQuery<QuotePage>({
    queryKey: ['quotes-column', status, search],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('page', String(pageParam));
      params.set('page_size', String(QUOTE_PAGE_SIZE));
      if (search) params.set('search', search);
      return fetchData(`api/v1/quotes/?${params.toString()}`);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage?.next ? allPages.length + 1 : undefined),
    enabled,
    retry: 1,
  });
}

// Flattens an infinite query's pages into one items array, plus the
// backend-computed count/total_amount (identical on every page, so the
// first page's value is all that's needed) and load-more state.
function flattenColumn(q: ReturnType<typeof useQuoteColumn>) {
  return {
    items: q.data?.pages.flatMap(p => p.results) ?? [],
    count: q.data?.pages[0]?.count ?? 0,
    totalAmount: Number(q.data?.pages[0]?.total_amount ?? 0),
    hasNextPage: !!q.hasNextPage,
    isLoading: q.isLoading,
    isFetchingNextPage: q.isFetchingNextPage,
    fetchNextPage: q.fetchNextPage,
  };
}

interface QuotesListProps {
  embedded?: boolean;
  // Search + view are owned by the parent (Bookings tab nav) when embedded,
  // so the search box and Board/List toggle can sit inline with the
  // Quotes/Orders/History tabs instead of on their own row. Falls back to
  // internal state so the component still works standalone.
  search?: string;
  onSearchChange?: (value: string) => void;
  view?: 'board' | 'list';
  onViewChange?: (value: 'board' | 'list') => void;
}

export function QuotesList({ embedded = false, search: searchProp, onSearchChange, view: viewProp, onViewChange }: QuotesListProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const billingBlocked = isSubscriptionBlocked(authUser?.subscription_status);
  const [internalSearch, setInternalSearch] = useState('');
  const [internalView, setInternalView] = useState<'board' | 'list'>('board');
  const search = searchProp ?? internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;
  const view = viewProp ?? internalView;
  const setView = onViewChange ?? setInternalView;
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  // Which column is the current drag hovering over — resolved from the raw
  // `over` id (a column, or a card within one) — drives each column's
  // drop-target highlight so it still lights up once the column is full.
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [confirmOpts, setConfirmOpts] = useState<{ title: string; message: string; confirmLabel?: string; onConfirm: () => void } | null>(null);
  const [pendingConvertQuote, setPendingConvertQuote] = useState<any>(null);

  // Search is sent to the backend (it searches across every quote, not just
  // whatever's already loaded on screen) — debounced so typing doesn't fire
  // a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

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
  const loads: any[] = loadsData?.results || loadsData || [];

  // A quote converts to at most one load (convert_to_load blocks a second
  // conversion) — map quote id -> its load so the "Convert to booking"
  // button can be swapped for a "View booking" link once that's happened.
  const loadByQuoteId = new Map<string, any>();
  loads.forEach(l => {
    if (l.quote != null) loadByQuoteId.set(String(l.quote), l);
  });

  // Each pipeline column is its own backend-paginated query (10 at a time,
  // "load more" — see useQuoteColumn) rather than one big "fetch every
  // quote" request sliced into columns client-side, which silently dropped
  // anything past the endpoint's default page size. These four run
  // unconditionally (not just in board view) since the List view's per-
  // status tabs reuse the exact same cached data. The 5th ("All") only runs
  // when actually needed — List view, "All" tab.
  const draftQ = useQuoteColumn('DRAFT', debouncedSearch);
  const sentQ = useQuoteColumn('SENT', debouncedSearch);
  const acceptedQ = useQuoteColumn('ACCEPTED', debouncedSearch);
  const declinedQ = useQuoteColumn('DECLINED', debouncedSearch);
  const allQ = useQuoteColumn(null, debouncedSearch, view === 'list' && statusFilter === 'ALL');
  const columnQueries = useMemo(
    () => ({ DRAFT: draftQ, SENT: sentQ, ACCEPTED: acceptedQ, DECLINED: declinedQ }),
    [draftQ, sentQ, acceptedQ, declinedQ]
  );
  const totalQuotesCount = COLUMNS.reduce((sum, col) => sum + flattenColumn(columnQueries[col]).count, 0);

  // Live update: refetch every column when the backend pushes any quote
  // event over WebSocket — prefix match invalidates all of them (and the
  // "All" list query) regardless of their search term.
  useEffect(() => {
    const handler = (e: Event) => {
      const { detail } = (e as CustomEvent);
      if (typeof detail?.event === 'string' && detail.event.startsWith('quote.')) {
        queryClient.invalidateQueries({ queryKey: ['quotes-column'] });
      }
    };
    window.addEventListener('tw:live-event', handler);
    return () => window.removeEventListener('tw:live-event', handler);
  }, [queryClient]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      patchData({ url: `api/v1/quotes/${id}/`, data: { status } }),
    onError: () => {
      toast.error('Failed to update quote status.');
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
      queryClient.invalidateQueries({ queryKey: ['quotes-column'] });
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

  // Once a column is full (scrolled, no empty space below the last card),
  // the only place to drop is on top of another card — dnd-kit then reports
  // `over` as that card's id (each card is a sortable drop target too), not
  // the column id. Map every LOADED card back to the column it's rendered
  // in (the Accepted column's own query already folds legacy IT/COMPLETED
  // quotes in server-side — see QuoteFilterSet on the backend — so this
  // naturally maps those to 'ACCEPTED' too) so a drop on a card resolves to
  // that card's column, not just a bare column id.
  const columnOfQuoteId: Record<string, string> = {};
  COLUMNS.forEach(col => {
    flattenColumn(columnQueries[col]).items.forEach((q: any) => { columnOfQuoteId[String(q.id)] = col; });
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveQuoteId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string | undefined;
    if (!overId) { setOverColumnId(null); return; }
    setOverColumnId(COLUMNS.includes(overId) ? overId : columnOfQuoteId[overId] ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveQuoteId(null);
    setOverColumnId(null);

    // Defense in depth — cards already have dragging disabled via useSortable
    // when blocked, but a status PATCH here would just 402 anyway.
    if (billingBlocked) return;
    if (!over) return;

    const quoteId = active.id as string;
    const overId = over.id as string;

    // Dropped directly on a column (its empty area) or on top of one of its
    // cards — either way, resolve to which column that lands in.
    const newStatus = COLUMNS.includes(overId) ? overId : columnOfQuoteId[overId];
    if (!newStatus) return;

    const oldColumn = columnOfQuoteId[quoteId];
    if (!oldColumn || oldColumn === newStatus) return;

    // No optimistic cache splice here — each column is its own paginated
    // query, so surgically moving a card between two independently-loaded
    // page sets (and adjusting both counts) isn't practical the way it was
    // when everything lived in one flat array. The card reappears in its
    // new column (and disappears from the old) once these refetch, which
    // the live WebSocket event above also triggers the moment the backend
    // confirms the change.
    statusMutation.mutate({ id: quoteId, status: newStatus }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['quotes-column', oldColumn] });
        queryClient.invalidateQueries({ queryKey: ['quotes-column', newStatus] });
        queryClient.invalidateQueries({ queryKey: ['quotes-column', null] });
      },
    });
  };

  const allLoadedBoardItems = COLUMNS.flatMap(col => flattenColumn(columnQueries[col]).items);
  const activeQuote = activeQuoteId ? allLoadedBoardItems.find((q: any) => String(q.id) === activeQuoteId) : null;

  // List view reuses a board column's query directly for a specific status,
  // or the separate "All" query (no status filter) for the All tab.
  const activeListQuery = statusFilter === 'ALL' ? allQ : columnQueries[statusFilter];
  const {
    items: listItems, hasNextPage: listHasNextPage, isLoading: listIsLoading,
    isFetchingNextPage: listIsFetchingNextPage, fetchNextPage: listFetchNextPage,
  } = flattenColumn(activeListQuery);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header — hidden when embedded in Bookings tabs */}
      {!embedded && (
        <div style={{ marginBottom: 24, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Operations</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Loads & Quotes</div>
              <LiveBadge />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-action" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} onClick={() => navigate('/bookings/quotes/new')}>
                + New quote
              </button>
              <button className="btn-action" onClick={() => navigate('/bookings/quotes/new')}>+ New load</button>
            </div>
          </div>
        </div>
      )}

      {/* Controls — hidden when embedded; the parent (Bookings tab nav) renders
          the search box and Board/List toggle inline with its tabs instead. */}
      {!embedded && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexShrink: 0 }}>
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
            <span>{totalQuotesCount} quotes</span>
          </div>
        </div>
      )}

      {billingBlocked && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: 14,
          borderRadius: 6, background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger)',
          flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-danger)', marginBottom: 2 }}>Quoting is blocked</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{subscriptionStatusDetail(authUser?.subscription_status)} Drag-and-drop status changes are disabled until then.</div>
          </div>
          <button onClick={() => navigate('/settings/billing')} className="btn-action" style={{ fontSize: 11, flexShrink: 0 }}>
            GO TO BILLING
          </button>
        </div>
      )}

      {/* Tabs */}
      {view === 'board' ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* Quotes Kanban — fills whatever height is left below the controls; each
              column scrolls its own card list instead of the whole page growing. */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>QUOTES PIPELINE — DRAG TO UPDATE STATUS</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{totalQuotesCount} quotes</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: '1fr', gap: 16, flex: 1, minHeight: 0 }}>
              {COLUMNS.map(col => {
                const { items: colItems, count: colCount, totalAmount: colTotal, hasNextPage, isLoading, isFetchingNextPage, fetchNextPage } = flattenColumn(columnQueries[col]);
                return (
                <div key={col} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, background: 'var(--bg-panel)', borderRadius: 6, padding: '8px 4px 8px 8px' }}>
                  <div style={{ borderTop: `2px solid ${STATUS_COLOR[col] || 'var(--border-subtle)'}`, paddingTop: 8, marginBottom: 10, marginRight: 4, flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[col] || 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{COLUMN_LABELS[col]}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-surface-hover)', padding: '2px 7px', borderRadius: 10 }}>{colCount}</span>
                    </div>
                    {colTotal > 0 && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', padding: '4px 2px 0' }}>{formatCurrency(colTotal)}</div>
                    )}
                  </div>
                  <div className="kanban-col-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
                    {isLoading ? (
                      <div style={{ padding: '28px 0', display: 'flex', justifyContent: 'center' }}><Loader size={22} /></div>
                    ) : (
                      <DroppableColumn columnId={col} items={colItems} isOver={overColumnId === col}>
                        {colItems.map((q: any) => (
                          <DraggableQuoteCard
                            key={q.id}
                            quote={q}
                            onClick={() => navigate(`/bookings/quotes/${q.id}`)}
                            onConvertToLoad={handleConvertToLoad}
                            onViewBooking={(e, load) => { e.stopPropagation(); navigate(`/bookings/${load.id}`); }}
                            convertedLoad={loadByQuoteId.get(String(q.id))}
                            dragDisabled={billingBlocked}
                          />
                        ))}
                        {colItems.length === 0 && (
                          <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 11, border: '1px dashed var(--border-subtle)', borderRadius: 2 }}>Drop here</div>
                        )}
                        {hasNextPage && (
                          <button
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                            style={{
                              width: '100%', padding: '8px', marginTop: 2, fontSize: 10, fontFamily: 'var(--font-mono)',
                              letterSpacing: '0.05em', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                              color: 'var(--text-secondary)', borderRadius: 2, cursor: isFetchingNextPage ? 'default' : 'pointer',
                              opacity: isFetchingNextPage ? 0.6 : 1,
                            }}
                          >
                            {isFetchingNextPage ? 'LOADING…' : `LOAD 10 MORE (${colCount - colItems.length} LEFT)`}
                          </button>
                        )}
                      </DroppableColumn>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
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
        /* List view — quotes table, backed by the same per-status paginated
           queries as the board (plus a 5th "All" query with no status
           filter) — switching tabs reuses whatever's already loaded. */
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Status filter tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexShrink: 0 }}>
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
                {status === 'ALL' ? 'All' : COLUMN_LABELS[status]} ({status === 'ALL' ? totalQuotesCount : flattenColumn(columnQueries[status]).count})
              </button>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-deep)', borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0, zIndex: 1 }}>
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
                {listItems.map((quote: any, idx: number) => (
                  <tr
                    key={quote.id}
                    onClick={() => navigate(`/bookings/quotes/${quote.id}`)}
                    style={{
                      borderBottom: idx < listItems.length - 1 ? '1px solid var(--border-subtle)' : 'none',
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
                      {quote.status === 'ACCEPTED' && loadByQuoteId.has(String(quote.id)) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/bookings/${loadByQuoteId.get(String(quote.id)).id}`); }}
                          style={{ background: WON_GREEN_BG, border: `1px solid ${WON_GREEN}`, color: WON_GREEN, padding: '4px 10px', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', borderRadius: 2, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          ✓ View booking
                        </button>
                      )}
                      {quote.status === 'ACCEPTED' && !loadByQuoteId.has(String(quote.id)) && (
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
            {listIsLoading && (
              <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Loader size={24} /></div>
            )}
            {!listIsLoading && listItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>No quotes found</div>
            )}
            {listHasNextPage && (
              <div style={{ padding: 12, display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => listFetchNextPage()}
                  disabled={listIsFetchingNextPage}
                  style={{
                    padding: '8px 20px', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
                    borderRadius: 2, cursor: listIsFetchingNextPage ? 'default' : 'pointer', opacity: listIsFetchingNextPage ? 0.6 : 1,
                  }}
                >
                  {listIsFetchingNextPage ? 'LOADING…' : 'LOAD 10 MORE'}
                </button>
              </div>
            )}
          </div>
        </div>
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
          vehicleType={pendingConvertQuote.vehicle_type}
          busy={convertToLoadMutation.isPending}
          onConfirm={(driverId, vehicleId) => convertToLoadMutation.mutate({ quote: pendingConvertQuote, driverId, vehicleId })}
          onCancel={() => setPendingConvertQuote(null)}
        />
      )}
    </div>
  );
}
