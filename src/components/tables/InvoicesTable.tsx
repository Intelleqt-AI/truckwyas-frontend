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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditCard, ArrowUpDown, MoreHorizontal, Sparkles, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";

interface Invoice {
  invoiceId: string;
  customer: string;
  amount: number;
  podVerified: boolean;
  dsoDays: number;
  advanceScore: number;
  status: 'Eligible' | 'Pending' | 'Funded' | 'Paid';
  createdAt: Date;
}

interface InvoicesTableProps {
  data?: Invoice[];
  maxRows?: number;
  className?: string;
}

export function InvoicesTable({ data, maxRows = 10, className }: InvoicesTableProps) {
  const [sortField, setSortField] = useState<keyof Invoice>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [invoiceStatuses, setInvoiceStatuses] = useState<Record<string, Invoice['status']>>({});
  const { toast } = useToast();

  // Mock data from invoices.json shape
  const defaultData: Invoice[] = [
    { invoiceId: "INV-771", customer: "Makana Foods", amount: 21500, podVerified: true, dsoDays: 43, advanceScore: 0.82, status: "Eligible", createdAt: new Date('2024-01-15') },
    { invoiceId: "INV-772", customer: "Kudu Steel", amount: 17800, podVerified: true, dsoDays: 28, advanceScore: 0.75, status: "Funded", createdAt: new Date('2024-01-14') },
    { invoiceId: "INV-773", customer: "Shoprite", amount: 14200, podVerified: false, dsoDays: 15, advanceScore: 0.65, status: "Pending", createdAt: new Date('2024-01-13') },
    { invoiceId: "INV-774", customer: "Pick n Pay", amount: 19500, podVerified: true, dsoDays: 52, advanceScore: 0.88, status: "Eligible", createdAt: new Date('2024-01-12') },
    { invoiceId: "INV-775", customer: "Sasol", amount: 26800, podVerified: true, dsoDays: 67, advanceScore: 0.45, status: "Paid", createdAt: new Date('2024-01-11') },
  ];

  const invoices = (data || defaultData).slice(0, maxRows);

  const handleSort = (field: keyof Invoice) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedInvoices = [...invoices].sort((a, b) => {
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

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'Pending': return 'bg-muted/50 text-muted-foreground border-0';
      case 'Funded': return 'bg-primary/5 text-primary border-primary/20';
      case 'Paid': return 'bg-success/5 text-success border-success/20';
      default: return 'bg-muted/50 text-muted-foreground border-0';
    }
  };

  const handleOpenAdvanceModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setAgreedToTerms(false);
    setIsModalOpen(true);
  };

  const handleConfirmAdvance = () => {
    if (!selectedInvoice || !agreedToTerms) return;

    // Update status optimistically
    setInvoiceStatuses(prev => ({
      ...prev,
      [selectedInvoice.invoiceId]: 'Funded'
    }));

    // Show success toast
    toast({
      title: "Advance Approved",
      description: `Your advance for ${selectedInvoice.invoiceId} has been approved and is being processed.`,
    });

    // Close modal
    setIsModalOpen(false);
    setSelectedInvoice(null);
  };

  const getInvoiceStatus = (invoice: Invoice): Invoice['status'] => {
    return invoiceStatuses[invoice.invoiceId] || invoice.status;
  };

  const calculateAdvanceDetails = (amount: number) => {
    const feePercentage = 0.025; // 2.5%
    const fee = amount * feePercentage;
    const netPayout = amount - fee;
    return { fee, netPayout };
  };

  const getAdvanceScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-success';
    if (score >= 0.6) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getDSOColor = (days: number) => {
    if (days <= 30) return 'text-success';
    if (days <= 45) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground">
          Invoice pipeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('invoiceId')}>
                  <div className="flex items-center gap-1">
                    Invoice ID
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('customer')}>
                  <div className="flex items-center gap-1">
                    Customer
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('amount')}>
                  <div className="flex items-center justify-end gap-1">
                    Amount
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="text-center">POD</TableHead>
                <TableHead className="cursor-pointer text-center" onClick={() => handleSort('dsoDays')}>
                  <div className="flex items-center justify-center gap-1">
                    DSO Days
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-center" onClick={() => handleSort('advanceScore')}>
                  <div className="flex items-center justify-center gap-1">
                    Advance Score
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedInvoices.map((invoice) => {
                const currentStatus = getInvoiceStatus(invoice);
                return (
                  <TableRow key={invoice.invoiceId} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-body">{invoice.invoiceId}</TableCell>
                    <TableCell className="text-body font-body-medium">{invoice.customer}</TableCell>
                    <TableCell className="text-right text-body font-body-medium text-tabular">
                      {formatCurrency(invoice.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={invoice.podVerified ? "default" : "secondary"} className="text-xs">
                        {invoice.podVerified ? "✓" : "✗"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-body font-body-medium text-tabular ${getDSOColor(invoice.dsoDays)}`}>
                        {invoice.dsoDays}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-body font-body-medium text-tabular ${getAdvanceScoreColor(invoice.advanceScore)}`}>
                        {(invoice.advanceScore * 100).toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {currentStatus === 'Eligible' ? (
                        <Button 
                          size="sm" 
                          className="h-8 gap-1.5"
                          onClick={() => handleOpenAdvanceModal(invoice)}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Get Instant Pay
                        </Button>
                      ) : (
                        <Badge variant="outline" className={`text-xs ${getStatusColor(currentStatus)}`}>
                          {currentStatus}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {currentStatus === 'Eligible' && (
                            <DropdownMenuItem 
                              className="gap-2 font-medium text-primary"
                              onClick={() => handleOpenAdvanceModal(invoice)}
                            >
                              <Sparkles className="h-4 w-4" />
                              Request Instant Advance
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="gap-2">
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            Download Invoice
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Advance Offer Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-primary/10 p-2">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-body-medium font-body-medium">
                Instant Advance for Invoice {selectedInvoice?.invoiceId}
              </DialogTitle>
            </div>
            <DialogDescription className="text-caption text-muted-foreground">
              Get paid instantly with transparent pricing
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6">
              {/* Financial Breakdown */}
              <Card className="bg-muted/30 border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-caption text-muted-foreground">Invoice Amount</span>
                    <span className="text-body font-body-medium text-tabular">
                      {formatCurrency(selectedInvoice.amount)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-caption text-muted-foreground">Partner's Fee (2.5%)</span>
                    <span className="text-caption font-body-medium text-destructive text-tabular">
                      -{formatCurrency(calculateAdvanceDetails(selectedInvoice.amount).fee)}
                    </span>
                  </div>

                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-body font-body-medium">Net Payout Amount</span>
                      <span className="text-display-small font-display-small text-success text-tabular">
                        {formatCurrency(calculateAdvanceDetails(selectedInvoice.amount).netPayout)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <Checkbox 
                  id="terms" 
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                  className="mt-0.5"
                />
                <label
                  htmlFor="terms"
                  className="text-caption leading-relaxed cursor-pointer flex-1"
                >
                  I agree to the{" "}
                  <a href="#" className="text-primary underline-offset-4 hover:underline">
                    Terms & Conditions
                  </a>
                </label>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAdvance}
              disabled={!agreedToTerms}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Confirm & Receive Funds
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}