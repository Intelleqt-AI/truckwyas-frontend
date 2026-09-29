import './bookings-typography.css';
import { TableSkeleton } from '@/components/fleet-detail/ContentSkeleton';
import './table-heading-roles.css';
import './bookings-section.css';
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { fetchData, patchData, postData } from "@/lib/Api";
import { formatCurrency, formatDate, formatDateShort, formatMoneyWhole } from "@/lib/formatters";
import { Loader } from "@/components/Loader";
import { toast } from "@/lib/toast";
import { Fuel, Columns3, List as ListIcon } from "lucide-react";
import { boardStage } from "@/components/overview/today";
import { useAllQuotes } from "@/components/overview/ledger";
import { useIsMobile } from "@/hooks/useIsMobile";
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
import LoadError, { loadFailed } from '@/components/data/LoadError';
import QuoteSendPreview from '@/components/QuoteSendPreview';
import { rowLink } from '@/lib/rowLink';
import { StatusChip, statusTone } from '@/components/ui/StatusChip';
import { Segmented } from '@/components/ui/Segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


// Pipeline stage -> dot/chip tone. Colour only ever sits next to its text label.
const COLUMN_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  SENT: 'warning',
  ACCEPTED: 'success',
  DECLINED: 'danger',
};

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
// The board shows one more column, Expired: derived from the date rule, not
// a status, so nothing can be dropped on it.
const BOARD_COLUMNS = [...COLUMNS, 'EXPIRED'];
const COLUMN_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  // Draft or Sent past its valid-until date (boardStage, R8): not live work.
  EXPIRED: 'Expired',
  // Not board columns — kept only so a quote from before this change still
  // renders a readable label in the list view instead of the raw code.
  IT: 'In transit',
  COMPLETED: 'Completed',
};

const QUOTE_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  SENT: 'warning',
  ACCEPTED: 'success',
  DECLINED: 'danger',
  IT: 'info',
  COMPLETED: 'success',
};

// Card body shared by the board card and its drag overlay.
function QuoteCardBody({ quote }: { quote: any }) {
  return (
    <>
      <div className="bk-qcard__top">
        <span className="bk-qcard__id">{quote.quote_number}</span>
        <span className="bk-qcard__flags">
          {quote.fuel_alert && (
            <span title={`Fuel price +${quote.fuel_delta_pct}% since quote created`} aria-label={`Fuel price up ${quote.fuel_delta_pct}% since quote created`} style={{ display: 'inline-flex', color: 'var(--status-warning-text)' }}><Fuel size={16} aria-hidden="true" /></span>
          )}
          {/* The recorded answer, when the column does not already say it.
              Neutral text: the column is the status. */}
          {quote.outcome === 'accepted' && quote.status !== 'ACCEPTED' && <span className="bk-qcard__meta">Marked won</span>}
          {quote.outcome === 'rejected' && quote.status !== 'DECLINED' && <span className="bk-qcard__meta">Marked lost</span>}
        </span>
      </div>
      <div className="bk-qcard__customer" title={quote.customer_name || ''}>{quote.customer_name || '—'}</div>
      <div className="bk-qcard__route" title={routeOf(quote)}>{routeOf(quote)}</div>
      <div className="bk-qcard__foot">
        <span className="bk-qcard__amount" title={formatCurrency(parseFloat(quote.total_amount || '0'))}>{formatMoneyWhole(parseFloat(quote.total_amount || '0'))}</span>
        {/* Only a low price confidence is worth a word on the card; otherwise the date it was made. */}
        {boardStage(quote) === 'EXPIRED' && quote.valid_until
          ? <span className="bk-qcard__meta" title={`${String(quote.status).toUpperCase() === 'SENT' ? 'Sent' : 'Draft'}, valid until ${formatDate(quote.valid_until)}`}>Expired {formatDateShort(quote.valid_until)}</span>
          : String(quote.confidence).toUpperCase() === 'LOW'
          ? <span className="bk-qcard__meta">Low confidence</span>
          : quote.created_at ? <span className="bk-qcard__meta">{formatDateShort(quote.created_at)}</span> : null}
      </div>
    </>
  );
}

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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: dragDisabled ? 'pointer' : (isDragging ? 'grabbing' : 'grab'),
  };

  return (
    <div
      ref={setNodeRef}
      className="bk-qcard"
      style={style}
      {...attributes}
      {...(dragDisabled ? {} : listeners)}
      onClick={onClick}
    >
      <QuoteCardBody quote={quote} />
      {quote.status === 'ACCEPTED' && convertedLoad && (
        <button
          type="button"
          className="bk-btn bk-btn--secondary bk-btn--block bk-qcard__action"
          onClick={(e) => onViewBooking?.(e, convertedLoad)}
          style={{ pointerEvents: 'auto' }}
        >
          View booking
        </button>
      )}
      {quote.status === 'ACCEPTED' && !convertedLoad && onConvertToLoad && (
        <button
          type="button"
          className="bk-btn bk-btn--secondary bk-btn--block bk-qcard__action"
          onClick={(e) => onConvertToLoad(e, quote)}
          style={{ pointerEvents: 'auto' }}
        >
          Convert to booking
        </button>
      )}
    </div>
  );
}

// An expired quote's card: opens the quote (where "Edit quote" is the next
// step); it is not dragged, since its column is a date rule, not a status.
function StaticQuoteCard({ quote, onClick }: { quote: any; onClick: () => void }) {
  return (
    <div
      className="bk-qcard"
      role="button"
      tabIndex={0}
      aria-label={`Quote ${quote.quote_number}, expired`}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      <QuoteCardBody quote={quote} />
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
      minHeight: 80, padding: 2, borderRadius: 'var(--radius-nested, 8px)',
      background: isOver ? 'var(--bg-surface-hover)' : 'transparent',
      outline: isOver ? '1px dashed var(--accent-primary)' : '1px solid transparent',
      transition: 'background 0.15s ease',
    }}>
      <SortableContext items={items.map(q => String(q.id))} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}

// The loads list behind "View booking". Quote detail reads the same cached
// query, so the board card and the detail page always agree.
export const loadsQuery = {
  queryKey: ['loads'],
  queryFn: () => fetchData('api/v1/loads/'),
  retry: 1,
};

// A quote converts to at most one load (convert_to_load blocks a second
// conversion) — map quote id -> its load so the "Convert to booking"
// button can be swapped for a "View booking" link once that's happened.
export function mapLoadsByQuoteId(loadsData: any): Map<string, any> {
  const loads: any[] = loadsData?.results || loadsData || [];
  const byQuote = new Map<string, any>();
  loads.forEach(l => {
    if (l.quote != null) byQuote.set(String(l.quote), l);
  });
  return byQuote;
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

/**
 * A status filter: the segmented control on wider screens; on phones, when
 * there are more than four options, a compact select (R4 phone rule). Both
 * stay mounted and CSS picks one, so nothing shifts when the width changes.
 */
export { idTail, RecordNo, RecordId } from './recordNo';
import { RecordNo } from './recordNo';

export function StatusFilter<V extends string>({ label, value, onChange, options, className, compactOnPhone }: {
  label: string; value: V; onChange: (v: V) => void;
  options: { value: V; label: string; count?: number }[]; className?: string;
  /** Use the phone select even with four options, so the count fits beside it. */
  compactOnPhone?: boolean;
}) {
  const compact = compactOnPhone || options.length > 4;
  const current = options.find(o => o.value === value) ?? options[0];
  const text = (o: { label: string; count?: number }) => (o.count != null ? `${o.label} (${o.count})` : o.label);
  return (
    <div className={`bk-filter${compact ? ' bk-filter--compact' : ''}${className ? ` ${className}` : ''}`}>
      <Segmented<V> label={label} value={value} onChange={onChange} options={options} className="bk-filter__seg" />
      {compact && (
        <Select value={value} onValueChange={v => onChange(v as V)}>
          <SelectTrigger aria-label={label} className="bk-filter__select">
            <SelectValue>{current ? text(current) : ''}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map(o => <SelectItem key={o.value} value={o.value}>{text(o)}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export function QuotesList({ embedded = false, search: searchProp, onSearchChange, view: viewProp, onViewChange }: QuotesListProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const billingBlocked = isSubscriptionBlocked(authUser?.subscription_status);
  const [internalSearch, setInternalSearch] = useState('');
  const [internalView, setInternalView] = useState<'board' | 'list'>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches ? 'list' : 'board');
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
  // Dragging a card into Sent emails the customer (the server sends on the
  // status change), so it is previewed and confirmed first.
  const [pendingSend, setPendingSend] = useState<{ quote: any; oldColumn: string } | null>(null);

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

  const { data: loadsData } = useQuery(loadsQuery);
  const loadByQuoteId = mapLoadsByQuoteId(loadsData);

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
  const totalQuotesCountRaw = COLUMNS.reduce((sum, col) => sum + flattenColumn(columnQueries[col]).count, 0);
  // A sent quote whose answer was recorded as lost belongs with the declined
  // ones: the board shows it there (with "Marked lost"), and both column
  // counts and totals move with it, so the board never says "Declined 0"
  // while a lost quote sits under Sent. Only loaded cards can move.
  // One stage definition everywhere (R5): the board's, shared with Home.
  const isMarkedLost = (q: any) => String(q.status).toUpperCase() === 'SENT' && boardStage(q) === 'DECLINED';
  const movedLost = flattenColumn(sentQ).items.filter(isMarkedLost);
  const amountOf = (q: any) => parseFloat(q.total_amount || '0') || 0;
  const movedLostTotal = movedLost.reduce((n: number, q: any) => n + amountOf(q), 0);
  // R8: a Draft or Sent quote past its valid-until date is Expired (the same
  // boardStage rule as Home's pipeline). Without a search the exact set comes
  // from the full quotes list Home already fetches (same cache); with a search
  // only the loaded cards can be placed.
  const allQuotesQ = useAllQuotes();
  const allRows: any[] | null = !debouncedSearch && allQuotesQ.data?.complete ? allQuotesQ.data.rows : null;
  // Until that list arrives, Draft, Sent and Expired wait together, so cards
  // don't jump between columns as it lands.
  const expiryPending = !debouncedSearch && allQuotesQ.isLoading;
  const isExpired = (q: any) => boardStage(q) === 'EXPIRED';
  const expiredRows: any[] = allRows
    ? allRows.filter(isExpired)
    : [...flattenColumn(draftQ).items, ...flattenColumn(sentQ).items].filter(isExpired);
  const expiredIn = (st: string) => expiredRows.filter((q: any) => String(q.status).toUpperCase() === st);
  // Quotes whose backend status is already EXPIRED are on no status query.
  const extraExpired = expiredIn('EXPIRED').length;
  const boardColumn = (col: string) => {
    if (col === 'EXPIRED') {
      const failed = loadFailed(draftQ) || loadFailed(sentQ);
      return {
        items: expiredRows, count: expiredRows.length,
        totalAmount: expiredRows.reduce((n: number, q: any) => n + amountOf(q), 0),
        hasNextPage: false, isLoading: (expiryPending || (!allRows && (draftQ.isLoading || sentQ.isLoading))) && !failed,
        isFetchingNextPage: false, fetchNextPage: () => undefined,
      };
    }
    const f = flattenColumn(columnQueries[col as keyof typeof columnQueries]);
    const lapsed = col === 'DRAFT' || col === 'SENT' ? expiredIn(col) : [];
    const lapsedTotal = lapsed.reduce((n: number, q: any) => n + amountOf(q), 0);
    const live = (items: any[]) => items.filter((q: any) => !isExpired(q) && !(col === 'SENT' && isMarkedLost(q)));
    if (col === 'DRAFT' || col === 'SENT') {
      const lost = col === 'SENT' ? movedLost : [];
      const items = live(f.items);
      const count = Math.max(0, f.count - lapsed.length - lost.length);
      return {
        ...f, items, count, isLoading: f.isLoading || expiryPending,
        totalAmount: f.totalAmount - lapsedTotal - (col === 'SENT' ? movedLostTotal : 0),
        // Every live card may already be loaded even though the backend has
        // more rows in this status (the rest are expired).
        hasNextPage: f.hasNextPage && items.length < count,
      };
    }
    if (col === 'DECLINED' && movedLost.length) return { ...f, items: [...f.items, ...movedLost], count: f.count + movedLost.length, totalAmount: f.totalAmount + movedLostTotal };
    return f;
  };
  // A failed column must never read as "No quotes" (and its 0 must not be counted).
  const failedColumns = COLUMNS.filter(col => loadFailed(columnQueries[col]));
  const totalQuotesCount = totalQuotesCountRaw + extraExpired;
  const retryFailedColumns = () => failedColumns.forEach(col => columnQueries[col].refetch());

  // Live update: refetch every column when the backend pushes any quote
  // event over WebSocket — prefix match invalidates all of them (and the
  // "All" list query) regardless of their search term.
  useEffect(() => {
    const handler = (e: Event) => {
      const { detail } = (e as CustomEvent);
      if (typeof detail?.event === 'string' && detail.event.startsWith('quote.')) {
        queryClient.invalidateQueries({ queryKey: ['quotes-column'] });
        queryClient.invalidateQueries({ queryKey: ['insights-source', 'quotes'] });
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
    boardColumn(col).items.forEach((q: any) => { columnOfQuoteId[String(q.id)] = col; });
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
    if (newStatus === 'SENT') {
      const quote = allLoadedBoardItems.find((q: any) => String(q.id) === quoteId);
      if (quote) { setPendingSend({ quote, oldColumn }); return; }
    }
    moveQuote(quoteId, oldColumn, newStatus);
  };

  const moveQuote = (quoteId: string, oldColumn: string, newStatus: string, onDone?: () => void) => {
    statusMutation.mutate({ id: quoteId, status: newStatus }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['quotes-column', oldColumn] });
        queryClient.invalidateQueries({ queryKey: ['quotes-column', newStatus] });
        queryClient.invalidateQueries({ queryKey: ['quotes-column', null] });
        queryClient.invalidateQueries({ queryKey: ['insights-source', 'quotes'] });
      },
      onSettled: () => onDone?.(),
    });
  };

  const allLoadedBoardItems = COLUMNS.flatMap(col => flattenColumn(columnQueries[col]).items);
  const activeQuote = activeQuoteId ? allLoadedBoardItems.find((q: any) => String(q.id) === activeQuoteId) : null;

  // List view reuses a board column's query directly for a specific status,
  // or the separate "All" query (no status filter) for the All tab.
  const activeListQuery = statusFilter === 'ALL' ? allQ : statusFilter === 'EXPIRED' ? draftQ : columnQueries[statusFilter as keyof typeof columnQueries];
  const {
    hasNextPage: listHasNextPage, isLoading: listIsLoading,
    isFetchingNextPage: listIsFetchingNextPage, fetchNextPage: listFetchNextPage,
  } = statusFilter === 'ALL' ? flattenColumn(allQ) : boardColumn(statusFilter);
  // The list's per-status rows and counts are the board's columns, so a
  // quote marked lost is under Declined in both views (R5: "Sent 2" twice).
  const listItems = statusFilter === 'ALL' ? flattenColumn(allQ).items : boardColumn(statusFilter).items;
  const statusOptions = ['ALL', ...BOARD_COLUMNS].map(status => ({
    value: status,
    label: status === 'ALL' ? 'All' : COLUMN_LABELS[status],
    count: (status === 'ALL' ? failedColumns.length === 0 : status === 'EXPIRED' ? !failedColumns.includes('DRAFT') && !failedColumns.includes('SENT') : !failedColumns.includes(status))
      ? (status === 'ALL' ? totalQuotesCount : boardColumn(status).count)
      : undefined,
  }));
  // Phones: one toolbar row (search, status select, view toggle) so the
  // first quote starts high on the screen.
  const isPhone = useIsMobile(767);
  const statusText = (o: { label: string; count?: number }) => (o.count != null ? `${o.label} (${o.count})` : o.label);
  const currentStatus = statusOptions.find(o => o.value === statusFilter) ?? statusOptions[0];

  return (
    <div className="bookings-typography bk-qlist-fill" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header — hidden when embedded in Bookings tabs */}
      {!embedded && (
        <div style={{ marginBottom: 24, flexShrink: 0 }}>
          <div style={{ fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-sans)', color: 'var(--text-tertiary)', marginBottom: 4 }}>Operations</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)' }}>Loads & quotes</div>
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

      {/* Toolbar — search, Board/List toggle and count sit on their own row
          under the shared Bookings header, so the tab row keeps one geometry. */}
      <div className="bk-toolbar">
        <input
          type="search"
          className="bk-search"
          aria-label="Search quotes"
          placeholder={isPhone ? 'Search quotes' : 'Search quotes, customers, routes'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {isPhone ? (
          <>
            {view === 'list' && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger aria-label="Filter quotes by status" className="bk-toolbar__status">
                  <SelectValue>{statusText(currentStatus)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{statusText(o)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <button
              type="button"
              className="bk-view-toggle"
              aria-label={view === 'list' ? 'Show as board' : 'Show as list'}
              title={view === 'list' ? 'Show as board' : 'Show as list'}
              onClick={() => setView(view === 'list' ? 'board' : 'list')}
            >
              {view === 'list' ? <Columns3 size={18} aria-hidden="true" /> : <ListIcon size={18} aria-hidden="true" />}
            </button>
          </>
        ) : (
          <Segmented
            label="Quote view"
            value={view}
            onChange={setView}
            options={[{ value: 'board', label: 'Board' }, { value: 'list', label: 'List' }]}
          />
        )}
        <span className="bk-toolbar__end">
          {view === 'board' && !billingBlocked ? 'Drag a card to change its status' : ''}
          {failedColumns.length === 0 && <>{view === 'board' && !billingBlocked ? ' · ' : ''}{totalQuotesCount} {totalQuotesCount === 1 ? 'quote' : 'quotes'}</>}
        </span>
        {/* List view (R6): the status filter shares the search row, as on
            Orders and History, so the table starts at the same height. */}
        {!isPhone && view === 'list' && (
          <StatusFilter
            label="Filter quotes by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
          />
        )}
      </div>

      {billingBlocked && (
        <div className="bk-notice bk-notice--danger" role="status" style={{ flexShrink: 0, marginBottom: 16 }}>
          <div>
            <p className="bk-notice__text">Quoting is blocked</p>
            <p className="bk-notice__sub">{subscriptionStatusDetail(authUser?.subscription_status)} Drag-and-drop status changes are disabled until then.</p>
          </div>
          <button type="button" onClick={() => navigate('/settings/billing')} className="bk-btn bk-btn--primary">
            Go to billing
          </button>
        </div>
      )}

      {/* Tabs */}
      {view === 'board' && failedColumns.length === COLUMNS.length ? (
        <LoadError
          what="quotes"
          error={columnQueries.DRAFT.error ?? columnQueries.DRAFT.failureReason}
          busy={COLUMNS.some(col => columnQueries[col].isFetching)}
          onRetry={retryFailedColumns}
        />
      ) : view === 'board' ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* Quotes Kanban — fills whatever height is left below the controls; each
              column scrolls its own card list instead of the whole page growing. */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div className="bk-kanban">
              {BOARD_COLUMNS.map(col => {
                const { items: colItems, count: colCount, totalAmount: colTotal, hasNextPage, isLoading: colLoading, isFetchingNextPage, fetchNextPage } = boardColumn(col);
                const isExpiredCol = col === 'EXPIRED';
                const colFailed = isExpiredCol ? failedColumns.includes('DRAFT') && failedColumns.includes('SENT') : failedColumns.includes(col);
                const isLoading = colLoading && !colFailed;
                const colQuery = isExpiredCol ? draftQ : columnQueries[col as keyof typeof columnQueries];
                return (
                <section key={col} className="bk-col" aria-label={`${COLUMN_LABELS[col]} quotes`}>
                  <div className="bk-col__head">
                    <span className="bk-col__title">
                      <span className={`bk-dot bk-dot--${statusTone(col)}`} aria-hidden="true" />
                      {COLUMN_LABELS[col]}
                      {!colFailed && <span className="bk-col__count">{colCount}</span>}
                    </span>
                    {colTotal > 0 && <span className="bk-col__total" title={formatCurrency(colTotal)}>{formatMoneyWhole(colTotal)}</span>}
                  </div>
                  <div className="kanban-col-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
                    {colFailed ? (
                      <LoadError
                        compact
                        what={`${COLUMN_LABELS[col].toLowerCase()} quotes`}
                        error={colQuery.error ?? colQuery.failureReason}
                        busy={colQuery.isFetching}
                        onRetry={() => colQuery.refetch()}
                      />
                    ) : isLoading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="ops-skel" style={{ height: 84, borderRadius: 8 }} />)}</div>
                    ) : isExpiredCol ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 2 }}>
                        {colItems.map((q: any) => (
                          <StaticQuoteCard key={q.id} quote={q} onClick={() => navigate(`/bookings/quotes/${q.id}`)} />
                        ))}
                        {colItems.length === 0 && <div className="bk-col__empty">No expired quotes</div>}
                      </div>
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
                          <div className="bk-col__empty">{billingBlocked ? 'No quotes' : 'No quotes. Drag a card here to move it.'}</div>
                        )}
                        {hasNextPage && (
                          <button
                            type="button"
                            className="bk-btn bk-btn--quiet bk-btn--block"
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                          >
                            {isFetchingNextPage ? 'Loading…' : `Load 10 more (${colCount - colItems.length} left)`}
                          </button>
                        )}
                      </DroppableColumn>
                    )}
                  </div>
                </section>
                );
              })}
            </div>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeQuote ? (
              <div className="bk-qcard" style={{ borderColor: 'var(--border-active)', cursor: 'grabbing' }}>
                <QuoteCardBody quote={activeQuote} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* List view — quotes table, backed by the same per-status paginated
           queries as the board (plus a 5th "All" query with no status
           filter) — switching tabs reuses whatever's already loaded. */
        <div className="bk-qlist-fill" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {loadFailed(activeListQuery) ? (
            <LoadError
              what="quotes"
              error={activeListQuery.error ?? activeListQuery.failureReason}
              busy={activeListQuery.isFetching}
              onRetry={() => activeListQuery.refetch()}
            />
          ) : (
          (() => {
          // Columns with nothing in them on any row step aside (R9).
          const anyOutcome = listItems.some((q: any) => q.outcome === 'accepted' || q.outcome === 'rejected');
          const anyAction = listItems.some((q: any) => q.status === 'ACCEPTED');
          return (
          <div className="bk-table-wrap bk-qlist-fill" style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table className="table-heading-roles bk-table">
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <th scope="col" className="bk-col-load">Quote #</th>
                  <th scope="col">Customer</th>
                  <th scope="col" className="bk-col-route">Route</th>
                  <th scope="col">Status</th>
                  {anyOutcome && <th scope="col" className="bk-col-phone">Outcome</th>}
                  <th scope="col" className="bk-col-phone">Created</th>
                  <th scope="col" className="is-num">Amount</th>
                  {anyAction && <th scope="col" className="is-num bk-col-action"><span className="sr-only">Action</span></th>}
                </tr>
              </thead>
              <tbody>
                {listItems.map((quote: any) => (
                  <tr
                    key={quote.id}
                    className="is-clickable"
                    {...rowLink(() => navigate(`/bookings/quotes/${quote.id}`))}
                    onClick={() => navigate(`/bookings/quotes/${quote.id}`)}
                  >
                    <td className="is-id bk-col-load">
                      {quote.quote_number}
                      {quote.fuel_alert && (
                        <span title={`Fuel price +${quote.fuel_delta_pct}% since quote created`} aria-label={`Fuel price up ${quote.fuel_delta_pct}% since quote created`} style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 6, color: 'var(--status-warning-text)' }}><Fuel size={16} aria-hidden="true" /></span>
                      )}
                    </td>
                    <td className="is-primary bk-col-customer" title={quote.customer_name || ''}>
                      {quote.customer_name || '—'}
                      {/* Phones: the quote number rides under the customer (its column folds away). */}
                      <RecordNo value={quote.quote_number} />
                    </td>
                    <td className="is-truncate bk-col-route" title={routeOf(quote)}>{routeOf(quote)}</td>
                    <td>
                      {/* The board's stage: a sent quote marked lost reads Declined here too. */}
                      {(() => {
                        const stage = boardStage(quote);
                        return stage
                          ? <StatusChip status={stage} label={COLUMN_LABELS[stage]} size="sm" />
                          : <StatusChip status={quote.status === 'IT' ? 'IN_TRANSIT' : quote.status} label={COLUMN_LABELS[quote.status]} size="sm" />;
                      })()}
                    </td>
                    {anyOutcome && <td className="bk-col-phone">
                      {quote.outcome === 'accepted' && <StatusChip status="WON" size="sm" />}
                      {quote.outcome === 'rejected' && <StatusChip status="LOST" size="sm" />}
                      {(!quote.outcome || quote.outcome === 'pending') && <span>—</span>}
                    </td>}
                    <td className="is-date bk-col-phone">
                      {quote.created_at ? formatDate(quote.created_at) : '—'}
                    </td>
                    <td className="is-money" title={formatCurrency(parseFloat(quote.total_amount || '0'))}>
                      {/* Lists show whole rands; the quote itself carries the cents (R7). */}
                      {formatMoneyWhole(parseFloat(quote.total_amount || '0'))}
                    </td>
                    {anyAction && <td className="is-num bk-col-action" onClick={(e) => e.stopPropagation()}>
                      {quote.status === 'ACCEPTED' && loadByQuoteId.has(String(quote.id)) && (
                        <button
                          type="button"
                          className="bk-btn bk-btn--secondary bk-btn--sm"
                          onClick={(e) => { e.stopPropagation(); navigate(`/bookings/${loadByQuoteId.get(String(quote.id)).id}`); }}
                        >
                          View booking
                        </button>
                      )}
                      {quote.status === 'ACCEPTED' && !loadByQuoteId.has(String(quote.id)) && (
                        <button
                          type="button"
                          className="bk-btn bk-btn--secondary bk-btn--sm"
                          onClick={(e) => handleConvertToLoad(e, quote)}
                        >
                          Convert to booking
                        </button>
                      )}
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {listIsLoading && !loadFailed(activeListQuery) && (
              <TableSkeleton rows={6} cols={5} label="Loading quotes" />
            )}
            {!listIsLoading && listItems.length === 0 && (
              <div className="bk-empty"><p className="bk-empty__text">{search ? 'No quotes match your search.' : statusFilter === 'ALL' ? 'No quotes yet.' : `No ${COLUMN_LABELS[statusFilter].toLowerCase()} quotes.`}</p></div>
            )}
            {listHasNextPage && (
              <div style={{ padding: 12, display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="bk-btn bk-btn--secondary"
                  onClick={() => listFetchNextPage()}
                  disabled={listIsFetchingNextPage}
                >
                  {listIsFetchingNextPage ? 'Loading…' : 'Load 10 more'}
                </button>
              </div>
            )}
          </div>
          );
          })()
          )}
        </div>
      )}

      {pendingSend && (
        <QuoteSendPreview
          quote={pendingSend.quote}
          sending={statusMutation.isPending}
          onCancel={() => setPendingSend(null)}
          onConfirm={() => {
            const { quote, oldColumn } = pendingSend;
            moveQuote(String(quote.id), oldColumn, 'SENT', () => setPendingSend(null));
          }}
        />
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
