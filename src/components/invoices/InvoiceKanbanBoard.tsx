import { useState } from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, FileText, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface InvoiceKanbanItem {
  id: string;
  title: string;
  customer: string;
  amount: number;
  dueDate?: string;
  age?: number;
  bookingId?: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  bgColor: string;
  items: InvoiceKanbanItem[];
}

interface InvoiceKanbanBoardProps {
  columns: KanbanColumn[];
  onCardMove: (cardId: string, fromColumn: string, toColumn: string) => void;
}

function SortableInvoiceCard({ item }: { item: InvoiceKanbanItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-card border border-border rounded-lg p-4 cursor-grab active:cursor-grabbing hover:shadow-glow transition-smooth"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-caption font-mono text-muted-foreground">{item.id}</span>
          {item.age && (
            <span className={`text-caption px-2 py-0.5 rounded-full ${
              item.age > 30 ? 'bg-destructive/10 text-destructive' : 
              item.age > 15 ? 'bg-warning/10 text-warning' : 
              'bg-success/10 text-success'
            }`}>
              {item.age}d
            </span>
          )}
        </div>
        <div className="text-body font-body-medium text-foreground">
          {item.customer}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-body font-body-medium text-tabular text-foreground">
            {formatCurrency(item.amount)}
          </span>
          {item.bookingId && (
            <span className="text-caption text-muted-foreground">
              {item.bookingId}
            </span>
          )}
        </div>
        {item.dueDate && (
          <div className="text-caption text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Due {item.dueDate}
          </div>
        )}
      </div>
    </div>
  );
}

export function InvoiceKanbanBoard({ columns, onCardMove }: InvoiceKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [columnItems, setColumnItems] = useState<Record<string, InvoiceKanbanItem[]>>(() => {
    const initial: Record<string, InvoiceKanbanItem[]> = {};
    columns.forEach(col => {
      initial[col.id] = col.items;
    });
    return initial;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }
    
    const cardId = active.id as string;
    const targetColumnId = over.id as string;
    
    // Find which column the card is currently in
    let sourceColumnId: string | null = null;
    for (const [colId, items] of Object.entries(columnItems)) {
      if (items.some(item => item.id === cardId)) {
        sourceColumnId = colId;
        break;
      }
    }
    
    if (!sourceColumnId || sourceColumnId === targetColumnId) {
      setActiveId(null);
      return;
    }
    
    // Move the card
    const sourceItems = columnItems[sourceColumnId];
    const cardToMove = sourceItems.find(item => item.id === cardId);
    
    if (cardToMove) {
      setColumnItems(prev => ({
        ...prev,
        [sourceColumnId]: prev[sourceColumnId].filter(item => item.id !== cardId),
        [targetColumnId]: [...(prev[targetColumnId] || []), cardToMove]
      }));
      
      onCardMove(cardId, sourceColumnId, targetColumnId);
    }
    
    setActiveId(null);
  };

  const activeItem = activeId
    ? Object.values(columnItems).flat().find(item => item.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[600px]">
        {columns.map((column, index) => {
          const items = columnItems[column.id] || [];
          const totalValue = items.reduce((sum, item) => sum + item.amount, 0);
          
          return (
            <motion.div
              key={column.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="space-y-4"
            >
              <Card className={`border-border ${column.bgColor}`}>
                <CardHeader className="pb-3">
                  <div className="space-y-2">
                    <CardTitle className="text-caption text-muted-foreground font-body-medium flex items-center justify-between">
                      {column.title}
                      <span className="text-xs font-medium text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">
                        {items.length}
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
                    id={column.id}
                    items={items.map(item => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto">
                      {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[200px] text-center">
                          <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                            <FileText className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <p className="text-caption text-muted-foreground mb-1">
                            {column.id === "inbox" && "No loads ready"}
                            {column.id === "ready" && "No invoices ready"}
                            {column.id === "sent" && "No invoices sent"}
                            {column.id === "overdue" && "No overdue invoices"}
                            {column.id === "paid" && "No paid invoices"}
                          </p>
                          <p className="text-xs text-muted-foreground/60">
                            {column.id === "inbox" && "Completed loads appear here"}
                            {column.id === "ready" && "Draft invoices show here"}
                            {column.id === "sent" && "Awaiting payment"}
                            {column.id === "overdue" && "Past due invoices show here"}
                            {column.id === "paid" && "Paid invoices appear here"}
                          </p>
                        </div>
                      ) : (
                        items.map((item) => (
                          <SortableInvoiceCard key={item.id} item={item} />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="bg-card border border-border rounded-lg p-4 shadow-lg opacity-90">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-caption font-mono text-muted-foreground">{activeItem.id}</span>
                {activeItem.age && (
                  <span className={`text-caption px-2 py-0.5 rounded-full ${
                    activeItem.age > 30 ? 'bg-destructive/10 text-destructive' : 
                    activeItem.age > 15 ? 'bg-warning/10 text-warning' : 
                    'bg-success/10 text-success'
                  }`}>
                    {activeItem.age}d
                  </span>
                )}
              </div>
              <div className="text-body font-body-medium text-foreground">
                {activeItem.customer}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body font-body-medium text-tabular text-foreground">
                  {formatCurrency(activeItem.amount)}
                </span>
                {activeItem.bookingId && (
                  <span className="text-caption text-muted-foreground">
                    {activeItem.bookingId}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
