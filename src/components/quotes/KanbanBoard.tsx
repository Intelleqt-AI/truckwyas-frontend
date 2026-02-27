import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
} from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, Truck, MapPin, Quote } from "lucide-react";
import { QuoteCard } from "./QuoteCard";
import { formatCurrency } from "@/lib/formatters";

interface Quote {
  id: string;
  customer: string;
  origin: string;
  destination: string;
  slaHours: number;
  price: number;
  marginPct: number;
  confidence: string;
  status: string;
  updatedAt: string;
  expiresAt: string;
  vehicle: string;
  weightTons: number;
  distanceKm: number;
  estimatedFuelL: number;
  tollsZar: number;
}

interface KanbanBoardProps {
  quotes: Quote[];
  onQuoteClick: (quoteId: string) => void;
  onAIClick: (e: React.MouseEvent, quoteId: string) => void;
  onStatusChange?: (quoteId: string, newStatus: string) => void;
}

const COLUMNS = [
  { id: "Draft", title: "Drafts", bgColor: "bg-muted/20" },
  { id: "Sent", title: "Quoted", bgColor: "bg-primary/5" },
  { id: "Accepted", title: "Accepted", bgColor: "bg-success/5" },
  { id: "In-Transit", title: "In-Transit", bgColor: "bg-warning/5" },
  { id: "Completed", title: "Completed", bgColor: "bg-neutral-100" },
];

function DroppableColumn({
  column,
  columnQuotes,
  onQuoteClick,
  onAIClick,
  index
}: {
  column: typeof COLUMNS[0];
  columnQuotes: Quote[];
  onQuoteClick: (id: string) => void;
  onAIClick: (e: React.MouseEvent, id: string) => void;
  index: number;
}) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const totalValue = columnQuotes.reduce((sum, quote) => sum + quote.price, 0);

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="space-y-4 h-full"
    >
      <Card className={`border-border h-full ${column.bgColor}`}>
        <CardHeader className="pb-3">
          <div className="space-y-2">
            <CardTitle className="text-caption text-muted-foreground font-body-medium flex items-center justify-between">
              {column.title}
              <span className="text-xs font-medium text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">
                {columnQuotes.length}
              </span>
            </CardTitle>
            {totalValue > 0 && (
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-tabular font-medium text-muted-foreground">
                  {formatCurrency(totalValue)}
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <SortableContext
            items={columnQuotes.map(q => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto">
              {columnQuotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-center">
                  <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                    {column.id === "Draft" && <Plus className="w-6 h-6 text-muted-foreground" />}
                    {column.id === "Sent" && <TrendingUp className="w-6 h-6 text-muted-foreground" />}
                    {column.id === "Accepted" && <Truck className="w-6 h-6 text-muted-foreground" />}
                    {column.id === "In-Transit" && <MapPin className="w-6 h-6 text-muted-foreground" />}
                    {column.id === "Completed" && <TrendingUp className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <p className="text-caption text-muted-foreground mb-1">
                    {column.id === "Draft" && "No drafts yet"}
                    {column.id === "Sent" && "No quotes sent"}
                    {column.id === "Accepted" && "No accepted quotes"}
                    {column.id === "In-Transit" && "No loads in transit"}
                    {column.id === "Completed" && "No completed deliveries"}
                  </p>
                </div>
              ) : (
                columnQuotes.map((quote) => (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    onCardClick={onQuoteClick}
                    onAIClick={onAIClick}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function KanbanBoard({ quotes, onQuoteClick, onAIClick, onStatusChange }: KanbanBoardProps) {
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [quoteStatuses, setQuoteStatuses] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    quotes.forEach(quote => {
      initial[quote.id] = quote.status;
    });
    return initial;
  });

  useEffect(() => {
    const initial: Record<string, string> = {};
    quotes.forEach(quote => {
      initial[quote.id] = quote.status;
    });
    setQuoteStatuses(initial);
  }, [quotes]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getQuotesForColumn = (columnId: string) => {
    return quotes.filter(quote => (quoteStatuses[quote.id] || quote.status) === columnId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveQuoteId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const quoteId = active.id as string;
    let newStatus = over.id as string;

    // If dropped on another quote, find that quote's column
    if (!COLUMNS.some(col => col.id === newStatus)) {
      const targetQuote = quotes.find(q => q.id === newStatus);
      if (targetQuote) {
        newStatus = quoteStatuses[targetQuote.id] || targetQuote.status;
      }
    }

    // Check if the status actually changed
    const currentStatus = quoteStatuses[quoteId] || quotes.find(q => q.id === quoteId)?.status;

    if (COLUMNS.some(col => col.id === newStatus) && newStatus !== currentStatus) {
      setQuoteStatuses(prev => ({
        ...prev,
        [quoteId]: newStatus
      }));

      onStatusChange?.(quoteId, newStatus);
    }

    setActiveQuoteId(null);
  };

  const activeQuote = activeQuoteId ? quotes.find(q => q.id === activeQuoteId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[600px]">
        {COLUMNS.map((column, index) => (
          <DroppableColumn
            key={column.id}
            column={column}
            columnQuotes={getQuotesForColumn(column.id)}
            onQuoteClick={onQuoteClick}
            onAIClick={onAIClick}
            index={index}
          />
        ))}
      </div>

      <DragOverlay>
        {activeQuote ? (
          <QuoteCard
            quote={activeQuote}
            onCardClick={() => { }}
            onAIClick={(e, quoteId) => { }}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}