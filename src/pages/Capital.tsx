import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Banknote, Sparkles, TrendingUp, AlertCircle, ArrowRight, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useNavigate } from "react-router-dom";
import invoicesData from "@/mocks/invoices.json";

export default function Capital() {
  const navigate = useNavigate();
  
  // Count eligible invoices
  const eligibleInvoices = invoicesData.filter(inv => inv.status === "Eligible");
  const totalEligibleAmount = eligibleInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Mock advance history data
  const advanceHistory = [
    { id: "ADV-024", invoiceId: "INV-751", customer: "Tiger Brands", amount: 22400, status: "Settled", date: "2025-10-12" },
    { id: "ADV-023", invoiceId: "INV-748", customer: "Woolworths", amount: 16800, status: "Approved", date: "2025-10-10" },
    { id: "ADV-022", invoiceId: "INV-745", customer: "Shoprite", amount: 19200, status: "Approved", date: "2025-10-08" },
    { id: "ADV-021", invoiceId: "INV-742", customer: "Pick n Pay", amount: 15600, status: "Settled", date: "2025-10-05" },
    { id: "ADV-020", invoiceId: "INV-739", customer: "SPAR Group", amount: 18900, status: "Settled", date: "2025-10-03" },
    { id: "ADV-019", invoiceId: "INV-736", customer: "Makana Foods", amount: 21500, status: "Pending", date: "2025-10-01" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-success/5 text-success border-success/20';
      case 'Pending': return 'bg-muted/50 text-muted-foreground border-0';
      case 'Settled': return 'bg-primary/5 text-primary border-primary/20';
      default: return 'bg-muted/50 text-muted-foreground border-0';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-body-medium font-body-medium text-foreground flex items-center gap-2">
          <Banknote className="h-4 w-4 text-muted-foreground" />
          Capital
        </h1>
        <p className="text-caption text-muted-foreground">
          Working capital management and advance funding
        </p>
      </div>

      {/* Smart CTA - Eligible Invoices Alert */}
      {eligibleInvoices.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="rounded-full bg-primary/10 p-2.5">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-body font-body-medium text-foreground">
                    You have {eligibleInvoices.length} eligible invoices ready for instant payment
                  </h3>
                  <p className="text-caption text-muted-foreground">
                    Total value: {formatCurrency(totalEligibleAmount)} • Get paid instantly with transparent 2.5% fee
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => navigate('/finance/invoices')}
                className="gap-2 shrink-0"
              >
                View & Fund Invoices
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-card border-border hover:shadow-glow transition-smooth">
          <CardHeader className="pb-3">
            <CardTitle className="text-caption text-muted-foreground">
              Available Capital
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-display-small font-display-small text-foreground text-tabular">
              {formatCurrency(500000)}
            </div>
            <p className="text-caption text-muted-foreground mt-1">
              Total credit facility
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:shadow-glow transition-smooth">
          <CardHeader className="pb-3">
            <CardTitle className="text-caption text-muted-foreground">
              Outstanding Advances
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-display-small font-display-small text-foreground text-tabular">
              {formatCurrency(156000)}
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-caption">
                <span className="text-muted-foreground">Active Advances</span>
                <span className="font-body-medium text-foreground text-tabular">12</span>
              </div>
              <div className="flex justify-between text-caption">
                <span className="text-muted-foreground">Avg. Term</span>
                <span className="font-body-medium text-foreground text-tabular">45 days</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:shadow-glow transition-smooth">
          <CardHeader className="pb-3">
            <CardTitle className="text-caption text-muted-foreground">
              Utilisation Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-display-small font-display-small text-foreground text-tabular">
              31.2%
            </div>
            <p className="text-caption text-muted-foreground mt-1">
              Of available capital
            </p>
            <div className="mt-4">
              <Progress value={31.2} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advance History Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground">Advance History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Advance ID</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advanceHistory.map((advance) => (
                  <TableRow key={advance.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-body">{advance.id}</TableCell>
                    <TableCell>
                      <Button
                        variant="link"
                        className="h-auto p-0 font-mono text-primary"
                        onClick={() => navigate('/finance/invoices')}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        {advance.invoiceId}
                      </Button>
                    </TableCell>
                    <TableCell className="text-body font-body-medium">{advance.customer}</TableCell>
                    <TableCell className="text-right text-body font-body-medium text-tabular">
                      {formatCurrency(advance.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-xs ${getStatusColor(advance.status)}`}>
                        {advance.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-caption text-muted-foreground">
                      {formatDate(advance.date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}