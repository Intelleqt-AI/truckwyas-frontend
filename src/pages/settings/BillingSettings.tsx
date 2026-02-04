import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Download, Receipt, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export function BillingSettings() {
  const [currentPlan] = useState({
    name: "Professional",
    price: 2499,
    billing: "monthly",
    users: 15,
    maxUsers: 25,
    features: [
      "AI-powered quote optimization",
      "Advanced analytics & reporting",
      "Fleet management",
      "API integrations",
      "Priority support"
    ]
  });

  const invoices = [
    {
      id: "INV-2024-003",
      date: "2024-09-01",
      amount: 2499,
      status: "paid",
      downloadUrl: "#"
    },
    {
      id: "INV-2024-002", 
      date: "2024-08-01",
      amount: 2499,
      status: "paid",
      downloadUrl: "#"
    },
    {
      id: "INV-2024-001",
      date: "2024-07-01", 
      amount: 2499,
      status: "paid",
      downloadUrl: "#"
    }
  ];

  const handleDownloadInvoice = (invoiceId: string) => {
    toast.success(`Downloading ${invoiceId}`);
  };

  const handleUpdatePayment = () => {
    toast.success("Payment method updated");
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-heading text-foreground">Billing & Subscription</h1>
        <p className="text-caption text-muted-foreground">
          Manage your subscription, payment methods, and billing history
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Current Plan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-body-medium">
              <span>Current Plan</span>
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                <CheckCircle className="w-3 h-3 mr-1" />
                Active
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-body-medium">{currentPlan.name} Plan</h3>
                <p className="text-caption text-muted-foreground">
                  R{currentPlan.price.toLocaleString()}/{currentPlan.billing}
                </p>
              </div>
              <div className="text-right">
                <p className="text-caption text-muted-foreground">Next billing</p>
                <p className="text-body">Oct 1, 2024</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-caption">
                <span>Users ({currentPlan.users}/{currentPlan.maxUsers})</span>
                <span>{Math.round((currentPlan.users / currentPlan.maxUsers) * 100)}%</span>
              </div>
              <Progress value={(currentPlan.users / currentPlan.maxUsers) * 100} className="h-2" />
            </div>

            <div className="space-y-1">
              <p className="text-body">Plan Features:</p>
              <ul className="space-y-0.5">
                {currentPlan.features.slice(0, 3).map((feature, index) => (
                  <li key={index} className="text-caption text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-success" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm">Change Plan</Button>
              <Button variant="outline" size="sm">Cancel</Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method & Usage */}
        <div className="space-y-4">
          {/* Payment Method */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-body-medium">
                <CreditCard className="w-4 h-4" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">VISA</span>
                  </div>
                  <div>
                    <p className="text-body">•••• 4242</p>
                    <p className="text-caption text-muted-foreground">Expires 12/26</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleUpdatePayment}>
                  Update
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Usage & Limits */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-body-medium">Usage & Limits</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-caption">API Calls</span>
                  <span className="text-caption text-muted-foreground text-tabular">8,234 / 10,000</span>
                </div>
                <Progress value={82.34} className="h-1.5" />
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-caption">Data Storage</span>
                  <span className="text-caption text-muted-foreground text-tabular">15.2 GB / 25 GB</span>
                </div>
                <Progress value={60.8} className="h-1.5" />
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-caption">Integrations</span>
                  <span className="text-caption text-muted-foreground text-tabular">3 / 5</span>
                </div>
                <Progress value={60} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Billing History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-body-medium">
            <Receipt className="w-4 h-4" />
            Billing History
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {invoices.slice(0, 3).map((invoice, index) => (
              <div key={invoice.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-body">{invoice.id}</p>
                      <Badge 
                        variant="outline" 
                        className="bg-success/10 text-success border-success/20"
                      >
                        Paid
                      </Badge>
                    </div>
                    <p className="text-caption text-muted-foreground">
                      {new Date(invoice.date).toLocaleDateString('en-ZA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-body text-tabular">
                      R{invoice.amount.toLocaleString()}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownloadInvoice(invoice.id)}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </div>
                </div>
                {index < 2 && <Separator className="mt-2" />}
              </div>
            ))}
          </div>
          
          <div className="flex items-start gap-2 text-caption text-muted-foreground mt-3 pt-2 border-t border-border">
            <AlertCircle className="w-3 h-3 mt-0.5" />
            <span>
              Need help? Contact <strong>billing@truckwys.com</strong> or <strong>+27 11 123 4567</strong>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}