import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, List, FileText, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import { InvoicesTable } from "@/components/tables/InvoicesTable";
import { InvoiceKanbanBoard } from "@/components/invoices/InvoiceKanbanBoard";
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

export default function Invoices() {
  const [view, setView] = useState<"pipeline" | "list">("list");

  // Mock KPI data
  const kpiData = [
    {
      title: "Outstanding",
      value: formatCurrency(1875000),
      subtitle: "28.5 days DSO",
      icon: FileText,
      color: "text-brand-500"
    },
    {
      title: "Overdue",
      value: formatCurrency(285000),
      subtitle: "15.2% of total",
      icon: AlertCircle,
      color: "text-destructive"
    },
    {
      title: "Sent This Week",
      value: "24",
      subtitle: formatCurrency(487500),
      icon: Send,
      color: "text-warning"
    },
    {
      title: "Paid This Week",
      value: "18",
      subtitle: formatCurrency(356200),
      icon: CheckCircle2,
      color: "text-success"
    }
  ];

  // Mock Kanban data
  const kanbanColumns = [
    {
      id: "inbox",
      title: "Ready to Invoice",
      bgColor: "bg-muted/20",
      items: [
        { id: "INV-801", title: "INV-801", customer: "Makana Foods", amount: 21500, bookingId: "BK-2401" },
        { id: "INV-802", title: "INV-802", customer: "Shoprite", amount: 14200, bookingId: "BK-2402" }
      ] as InvoiceKanbanItem[]
    },
    {
      id: "ready",
      title: "Ready to Send",
      bgColor: "bg-primary/5",
      items: [
        { id: "INV-790", title: "INV-790", customer: "Pick n Pay", amount: 19500, bookingId: "BK-2385" },
        { id: "INV-791", title: "INV-791", customer: "Sasol", amount: 26800, bookingId: "BK-2386" }
      ] as InvoiceKanbanItem[]
    },
    {
      id: "sent",
      title: "Sent & Awaiting",
      bgColor: "bg-warning/5",
      items: [
        { id: "INV-772", title: "INV-772", customer: "Kudu Steel", amount: 17800, dueDate: "2024-02-15", age: 12 },
        { id: "INV-773", title: "INV-773", customer: "Woolworths", amount: 22400, dueDate: "2024-02-20", age: 7 }
      ] as InvoiceKanbanItem[]
    },
    {
      id: "overdue",
      title: "Overdue",
      bgColor: "bg-destructive/5",
      items: [
        { id: "INV-750", title: "INV-750", customer: "Massmart", amount: 18900, dueDate: "2024-01-25", age: 32 },
        { id: "INV-751", title: "INV-751", customer: "Spar", amount: 15600, dueDate: "2024-01-28", age: 29 }
      ] as InvoiceKanbanItem[]
    },
    {
      id: "paid",
      title: "Paid",
      bgColor: "bg-success/5",
      items: [
        { id: "INV-775", title: "INV-775", customer: "Tiger Brands", amount: 24300 },
        { id: "INV-776", title: "INV-776", customer: "AVI Ltd", amount: 19700 }
      ] as InvoiceKanbanItem[]
    }
  ];

  const handleCardMove = (cardId: string, fromColumn: string, toColumn: string) => {
    // TODO: implement card move logic
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-body-medium font-body-medium text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Invoices
          </h1>
          <p className="text-caption text-muted-foreground">
            Invoice-to-cash workflow and receivables ledger
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as "pipeline" | "list")}>
            <TabsList>
              <TabsTrigger value="pipeline" className="gap-2">
                <LayoutGrid className="w-4 h-4" />
                Board
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="w-4 h-4" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button>
            <FileText className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, index) => (
          <Card 
            key={index} 
            className="bg-card border-border hover:shadow-glow transition-smooth"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-caption text-muted-foreground">
                {kpi.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-body font-body-medium text-foreground text-tabular">
                {kpi.value}
              </div>
              <p className="text-caption text-muted-foreground mt-1">{kpi.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content - Toggle between Pipeline and List */}
      {view === "pipeline" ? (
        <InvoiceKanbanBoard 
          columns={kanbanColumns}
          onCardMove={handleCardMove}
        />
      ) : (
        <InvoicesTable maxRows={50} />
      )}
    </div>
  );
}
