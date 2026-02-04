import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Eye, Filter, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import quotesData from "@/mocks/quotes.json";

// Status columns for pipeline view
const statusColumns = [
  { status: "Draft", label: "Drafts", count: 12 },
  { status: "Sent", label: "Sent", count: 8 },
  { status: "Negotiation", label: "In Negotiation", count: 3 },
  { status: "Accepted", label: "Accepted", count: 15 },
  { status: "Expired", label: "Expired", count: 4 },
];

export function QuoteLibrary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // Filter quotes based on search and status
  const filteredQuotes = quotesData.filter((quote) => {
    const matchesSearch = quote.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         `${quote.origin} → ${quote.destination}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !selectedStatus || quote.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Draft": return { variant: "secondary" as const, color: "text-muted-foreground" };
      case "Sent": return { variant: "default" as const, color: "text-primary" };
      case "Accepted": return { variant: "default" as const, color: "text-success" };
      case "Expired": return { variant: "destructive" as const, color: "text-destructive" };
      default: return { variant: "outline" as const, color: "text-muted-foreground" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-display-h1 font-display-bold text-brand-900">Quote Library</h1>
          <p className="text-body text-muted-foreground">Pipeline overview and quote management</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          New Quote
        </Button>
      </motion.div>

      {/* Pipeline Status Columns */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-5 gap-4"
      >
        {statusColumns.map((column) => (
          <Card 
            key={column.status}
            className={`cursor-pointer transition-colors ${
              selectedStatus === column.status ? "border-primary bg-primary/5" : "hover:bg-muted/30"
            }`}
            onClick={() => setSelectedStatus(selectedStatus === column.status ? null : column.status)}
          >
            <CardContent className="p-4 text-center">
              <div className="text-display-h3 font-display-bold text-foreground text-tabular">{column.count}</div>
              <p className="text-caption text-muted-foreground">{column.label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer or lane..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="w-4 h-4" />
        </Button>
      </motion.div>

      {/* Quotes Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-4 text-left text-caption text-muted-foreground font-body-medium">Customer</th>
                    <th className="p-4 text-left text-caption text-muted-foreground font-body-medium">Lane</th>
                    <th className="p-4 text-right text-caption text-muted-foreground font-body-medium">Price</th>
                    <th className="p-4 text-right text-caption text-muted-foreground font-body-medium">Margin %</th>
                    <th className="p-4 text-center text-caption text-muted-foreground font-body-medium">Status</th>
                    <th className="p-4 text-left text-caption text-muted-foreground font-body-medium">Updated</th>
                    <th className="p-4 text-center text-caption text-muted-foreground font-body-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((quote) => {
                    const statusBadge = getStatusBadge(quote.status);
                    const ageInDays = Math.floor((new Date().getTime() - new Date(quote.updatedAt).getTime()) / (1000 * 3600 * 24));
                    
                    return (
                      <tr key={quote.id} className="border-b border-border hover:bg-muted/30 cursor-pointer">
                        <td className="p-4">
                          <div className="text-body font-body-medium text-foreground">{quote.customer}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-body text-foreground">{quote.origin} → {quote.destination}</div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="text-body-medium font-body-medium text-foreground text-tabular">
                            {formatCurrency(quote.price)}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className={`text-body-medium font-body-medium text-tabular ${
                            quote.marginPct >= 15 ? 'text-success' : 
                            quote.marginPct >= 12 ? 'text-warning' : 
                            'text-destructive'
                          }`}>
                            {quote.marginPct.toFixed(1)}%
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <Badge variant={statusBadge.variant} className={statusBadge.color}>
                            {quote.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="text-body text-muted-foreground">{ageInDays}d ago</div>
                        </td>
                        <td className="p-4 text-center">
                          <Button variant="ghost" size="sm" onClick={() => window.location.href = `/quotes/${quote.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {filteredQuotes.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No quotes found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}