import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Eye, FileText, ArrowUpDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Quote {
  id: string;
  customer: string;
  origin: string;
  destination: string;
  price: number;
  marginPct: number;
  winProb: number;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected';
  createdAt: Date;
}

interface QuotesTableProps {
  data?: Quote[];
  maxRows?: number;
  className?: string;
}

export function QuotesTable({ data, maxRows = 10, className }: QuotesTableProps) {
  const [sortField, setSortField] = useState<keyof Quote>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Mock data from quotes.json shape
  const defaultData: Quote[] = [
    { id: "Q-1001", customer: "Makana Foods", origin: "JHB", destination: "CPT", price: 21500, marginPct: 12.4, winProb: 0.62, status: "Draft", createdAt: new Date('2024-01-15') },
    { id: "Q-1002", customer: "Kudu Steel", origin: "DBN", destination: "JHB", price: 17800, marginPct: 9.8, winProb: 0.54, status: "Sent", createdAt: new Date('2024-01-14') },
    { id: "Q-1003", customer: "Shoprite", origin: "CPT", destination: "PE", price: 14200, marginPct: 15.2, winProb: 0.78, status: "Accepted", createdAt: new Date('2024-01-13') },
    { id: "Q-1004", customer: "Pick n Pay", origin: "JHB", destination: "DBN", price: 19500, marginPct: 11.6, winProb: 0.45, status: "Sent", createdAt: new Date('2024-01-12') },
    { id: "Q-1005", customer: "Sasol", origin: "DBN", destination: "CPT", price: 26800, marginPct: 18.3, winProb: 0.85, status: "Draft", createdAt: new Date('2024-01-11') },
  ];

  const quotes = (data || defaultData).slice(0, maxRows);

  const handleSort = (field: keyof Quote) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedQuotes = [...quotes].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    const aStr = String(aValue);
    const bStr = String(bValue);
    return sortDirection === 'asc' 
      ? aStr.localeCompare(bStr) 
      : bStr.localeCompare(aStr);
  });

  const getStatusColor = (status: Quote['status']) => {
    switch (status) {
      case 'Draft': return 'bg-muted text-muted-foreground';
      case 'Sent': return 'bg-brand-100 text-brand-700';
      case 'Accepted': return 'bg-success-light text-success';
      case 'Rejected': return 'bg-danger/10 text-danger';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getWinProbColor = (prob: number) => {
    if (prob >= 0.7) return 'text-success';
    if (prob >= 0.5) return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground">
          Recent quotes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('id')}>
                  <div className="flex items-center gap-1">
                    Quote ID
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('customer')}>
                  <div className="flex items-center gap-1">
                    Customer
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead>Route</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('price')}>
                  <div className="flex items-center justify-end gap-1">
                    Price
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('marginPct')}>
                  <div className="flex items-center justify-end gap-1">
                    Margin
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-center" onClick={() => handleSort('winProb')}>
                  <div className="flex items-center justify-center gap-1">
                    Win Prob
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedQuotes.map((quote) => (
                <TableRow key={quote.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-body">{quote.id}</TableCell>
                  <TableCell className="text-body font-body-medium">{quote.customer}</TableCell>
                  <TableCell className="text-body text-muted-foreground">
                    {quote.origin} → {quote.destination}
                  </TableCell>
                  <TableCell className="text-right text-body font-body-medium text-tabular">
                    {formatCurrency(quote.price)}
                  </TableCell>
                  <TableCell className="text-right text-body text-tabular">
                    {quote.marginPct.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-body font-body-medium text-tabular ${getWinProbColor(quote.winProb)}`}>
                      {(quote.winProb * 100).toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-xs ${getStatusColor(quote.status)}`}>
                      {quote.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <Eye className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}