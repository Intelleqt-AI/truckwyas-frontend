import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, FileText, Sparkles, List, LayoutGrid } from "lucide-react";
import { formatCurrency, formatRelativeTime } from "@/lib/formatters";
import { useNavigate } from "react-router-dom";
import { AIInsightsModal } from "@/components/quotes/AIInsightsModal";
import { KanbanBoard } from "@/components/quotes/KanbanBoard";
import { QuoteDetailsModal } from "@/components/quotes/QuoteDetailsModal";
import useFetch from "@/hooks/useFetch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patchData } from "@/lib/Api";
import { toast } from "sonner";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Draft": return { variant: "subtle" as const, className: "bg-muted/50 text-muted-foreground border-0" };
    case "Sent": return { variant: "outline" as const, className: "bg-primary/5 text-primary border-primary/20" };
    case "Accepted": return { variant: "outline" as const, className: "bg-success/5 text-success border-success/20" };
    case "Expired": return { variant: "outline" as const, className: "bg-destructive/5 text-destructive border-destructive/20" };
    default: return { variant: "subtle" as const, className: "bg-muted/50 text-muted-foreground border-0" };
  }
};

const getConfidenceBadge = (confidence: string) => {
  switch (confidence) {
    case "High": return { variant: "outline" as const, className: "bg-success/5 text-success border-success/20" };
    case "Medium": return { variant: "outline" as const, className: "bg-warning/5 text-warning border-warning/20" };
    case "Low": return { variant: "outline" as const, className: "bg-destructive/5 text-destructive border-destructive/20" };
    default: return { variant: "subtle" as const, className: "bg-muted/50 text-muted-foreground border-0" };
  }
};

const getMarginColor = (marginPct: number) => {
  if (marginPct >= 15) return "text-success";
  if (marginPct >= 12) return "text-warning";
  return "text-destructive";
};

export function QuotesList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "board">("board");
  const [openInsightsId, setOpenInsightsId] = useState<string | null>(null);
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: quotesData, isLoading, error, refetch } = useFetch("api/quotes");
  const { data: pipelineData, isLoading: pipelineLoading, error: pipelineError } = useFetch("api/bookings/pipeline/");

  // useEffect(() => {
  //   refetch?.();
  // }, []);

  const quotes = quotesData?.results || [];

  // Map API data to component structure
  const mappedQuotes = quotes.map((quote: any) => ({
    id: `Q-${quote.quote_number}`,
    originalId: quote.id, // Keep original ID for API calls
    customer: quote.customer_name,
    origin: quote.pickup_location,
    destination: quote.delivery_location,
    slaHours: 48, // Default as not in API
    price: parseFloat(quote.total_amount),
    marginPct: 12.5, // Default/Mock as not in API
    confidence: "High", // Default/Mock as not in API
    status: quote.status.charAt(0).toUpperCase() + quote.status.slice(1).toLowerCase(), // Capitalize
    updatedAt: quote.updated_at,
    expiresAt: quote.valid_until,
    vehicle: "Curtain Side 34t", // Mock
    weightTons: parseFloat(quote.weight) || 0,
    distanceKm: parseFloat(quote.distance) || 0,
    estimatedFuelL: (parseFloat(quote.distance) || 0) * 0.4, // Rough estimate
    tollsZar: 0 // Mock
  }));

  // Mock AI insights data
  const mockInsights = {
    recommendation: {
      scenario: "Route B",
      uplift: 750,
      reason: "lower fuel, higher ETA"
    },
    confidence: {
      level: "High",
      percentage: 92,
      estimatedUplift: 550
    }
  };

  const filteredQuotes = mappedQuotes.filter((quote: any) => {
    const matchesSearch = quote.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${quote.origin} → ${quote.destination}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCustomer = selectedCustomer === "all" || quote.customer === selectedCustomer;
    const matchesStatus = viewMode === "board" || selectedStatus === "all" || quote.status === selectedStatus;

    return matchesSearch && matchesCustomer && matchesStatus;
  });

  const handleRowClick = (quoteId: string) => {
    setExpandedQuoteId(expandedQuoteId === quoteId ? null : quoteId);
  };

  const handleAIClick = (e: React.MouseEvent, quoteId: string) => {
    e.stopPropagation(); // Prevent row click navigation
    setOpenInsightsId(quoteId);
    // Update URL with query parameter
    const url = new URL(window.location.href);
    url.searchParams.set('insight', quoteId);
    window.history.pushState({}, '', url.toString());
  };

  const handleCloseInsights = () => {
    setOpenInsightsId(null);
    // Remove query parameter from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('insight');
    window.history.pushState({}, '', url.toString());
  };

  const handleApplyChanges = (quoteId: string, patch: { price?: number; marginPct?: number; planId?: 'A' | 'B' | 'C' }) => {
    // TODO: update the quote data and show a success animation
  };

  const handleOpenCanvas = (quoteId: string) => {
    navigate(`/quotes/${quoteId}`);
  };

  const handleSaveQuote = (updatedQuote: any) => {
    // TODO: update the quote data via API
    setExpandedQuoteId(null);
    setSelectedQuoteId(null);
    refetch?.();
  };

  const { mutate: updateQuoteStatus } = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      patchData({ url: `api/quotes/${id}/`, data: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api/quotes"] });
      toast.success("Quote status updated");
    },
    onError: () => {
      toast.error("Failed to update quote status");
      refetch?.(); // Revert UI on error
    }
  });

  const handleStatusChange = (quoteId: string, newStatus: string) => {
    const quote = mappedQuotes.find((q: any) => q.id === quoteId);
    if (quote) {
      // Map UI status back to backend format (e.g., "In-Transit" -> "IN_TRANSIT", "Draft" -> "DRAFT")
      const backendStatus = newStatus.toUpperCase().replace("-", "_");
      updateQuoteStatus({
        id: quote.originalId,
        status: backendStatus
      });
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading quotes...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Streamlined Control Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        {/* Left: Search and Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 w-full lg:max-w-3xl">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer or lane..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64 lg:w-80"
            />
          </div>
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="All Customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {Array.from(new Set(mappedQuotes.map((q: any) => q.customer))).map((customer: any) => (
                <SelectItem key={customer} value={customer}>{customer}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {viewMode === "list" && (
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Sent">Sent</SelectItem>
                <SelectItem value="Accepted">Accepted</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Right: View Toggle and New Quote */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center justify-center gap-2 bg-muted/30 rounded-lg p-1 w-full sm:w-auto">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="flex-1 sm:flex-none gap-2 h-8 px-3"
            >
              <List className="w-4 h-4" />
              List
            </Button>
            <Button
              variant={viewMode === "board" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("board")}
              className="flex-1 sm:flex-none gap-2 h-8 px-3"
            >
              <LayoutGrid className="w-4 h-4" />
              Board
            </Button>
          </div>
          <Button onClick={() => navigate('/quotes/new')} className="gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            New Quote
          </Button>
        </div>
      </motion.div>

      {/* Content Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {viewMode === "list" ? (
          <Card className="bg-card border-border hover:shadow-glow transition-smooth">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-caption text-muted-foreground">Quote ID</TableHead>
                    <TableHead className="text-caption text-muted-foreground">Customer</TableHead>
                    <TableHead className="text-caption text-muted-foreground">Lane</TableHead>
                    <TableHead className="text-caption text-muted-foreground">SLA</TableHead>
                    <TableHead className="text-caption text-muted-foreground">Price</TableHead>
                    <TableHead className="text-caption text-muted-foreground">Margin %</TableHead>
                    <TableHead className="text-caption text-muted-foreground">Confidence</TableHead>
                    <TableHead className="text-caption text-muted-foreground">Status</TableHead>
                    <TableHead className="text-caption text-muted-foreground">Updated</TableHead>
                    <TableHead className="text-caption text-muted-foreground w-12">AI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map((quote: any, index: number) => {
                    const statusBadge = getStatusBadge(quote.status);
                    const confidenceBadge = getConfidenceBadge(quote.confidence);
                    const marginColor = getMarginColor(quote.marginPct);
                    const isExpanded = expandedQuoteId === quote.id;

                    return (
                      <>
                        <motion.tr
                          key={quote.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 + index * 0.05 }}
                          className={`cursor-pointer hover:bg-accent/50 transition-smooth border-border ${isExpanded ? 'bg-accent/20' : ''}`}
                          onClick={() => setSelectedQuoteId(quote.id)}
                        >
                          <TableCell className="text-body-medium text-foreground">{quote.id}</TableCell>
                          <TableCell className="text-body text-foreground">{quote.customer}</TableCell>
                          <TableCell className="text-body text-foreground">
                            {quote.origin} → {quote.destination}
                          </TableCell>
                          <TableCell className="text-body text-foreground">{quote.slaHours}h</TableCell>
                          <TableCell className="text-body-medium text-foreground text-tabular">
                            {formatCurrency(quote.price)}
                          </TableCell>
                          <TableCell className={`text-body-medium text-tabular ${marginColor}`}>
                            {quote.marginPct.toFixed(1)}%
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={confidenceBadge.variant}
                              className={confidenceBadge.className}
                            >
                              {quote.confidence}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={statusBadge.variant}
                              className={statusBadge.className}
                            >
                              {quote.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-caption text-muted-foreground">
                            {formatRelativeTime(quote.updatedAt)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 transition-all hover:bg-primary/10 text-muted-foreground hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAIClick(e, quote.id);
                              }}
                            >
                              <Sparkles className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </motion.tr>
                      </>
                    );
                  })}
                </TableBody>
              </Table>

              {filteredQuotes.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-center py-12"
                >
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-body text-muted-foreground mb-4">No quotes found</p>
                  <Button onClick={() => navigate('/quotes/new')} variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Create your first quote
                  </Button>
                </motion.div>
              )}
            </CardContent>
          </Card>
        ) : (
          <KanbanBoard
            quotes={filteredQuotes}
            onQuoteClick={(quoteId) => setSelectedQuoteId(quoteId)}
            onAIClick={(e, quoteId) => handleAIClick(e, quoteId)}
            onStatusChange={handleStatusChange}
          />
        )}
      </motion.div>

      {/* Modals */}
      {openInsightsId && (
        <AIInsightsModal
          isOpen={!!openInsightsId}
          onClose={handleCloseInsights}
          quote={mappedQuotes.find((q: any) => q.id === openInsightsId)!}
          insights={mockInsights}
          onApply={(patch) => handleApplyChanges(openInsightsId, patch)}
          onOpenCanvas={() => handleOpenCanvas(openInsightsId)}
        />
      )}

      {selectedQuoteId && (
        <QuoteDetailsModal
          isOpen={!!selectedQuoteId}
          onClose={() => {
            setSelectedQuoteId(null);
            refetch?.();
          }}
          quote={mappedQuotes.find((q: any) => q.id === selectedQuoteId)!}
          onSave={handleSaveQuote}
        />
      )}
    </div>
  );
}