import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, MoreVertical, Send, CheckCircle2, Download, XCircle, Clock, DollarSign } from "lucide-react";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { CurrencyDisplay } from "@/components/finance/CurrencyDisplay";
import { InvoicePreview } from "@/components/finance/InvoicePreview";
import useFetch from "@/hooks/useFetch";
import { usePost } from "@/hooks/usePost";

interface InvoiceDetail {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_address?: string;
  customer_city?: string;
  customer_postal_code?: string;
  total_amount: number;
  subtotal: number;
  vat_amount: number;
  status: string;
  due_date: string;
  invoice_date: string;
  payment_terms?: string;
  notes?: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  payments?: Array<{
    id: number;
    amount: number;
    date: string;
    payment_method?: string;
  }>;
  early_pay_eligible?: boolean;
  early_pay_amount?: number;
  early_pay_fee_percent?: number;
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mutate: updateInvoice } = usePost();

  const { data: invoice, isLoading, error, refetch } = useFetch<InvoiceDetail>(`/api/invoices/${id}/`);

  const handleStatusAction = (action: string) => {
    if (!invoice) return;

    let newStatus = invoice.status;
    if (action === "send") newStatus = "SENT";
    if (action === "mark_paid") newStatus = "PAID";
    if (action === "cancel") newStatus = "CANCELLED";

    updateInvoice(
      { url: `/api/invoices/${id}/`, data: { status: newStatus }, config: { method: 'PATCH' } },
      {
        onSuccess: () => {
          refetch();
        },
      }
    );
  };

  const handleDownloadPDF = () => {
    console.log("Download PDF for invoice:", id);
    // Implement PDF download logic
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-[#64748B]">Loading invoice details...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-[#EF4444] mb-4">Error loading invoice details.</p>
          <Button onClick={() => navigate('/finance/invoices')}>Back to Invoices</Button>
        </div>
      </div>
    );
  }

  // Generate status timeline
  const statusTimeline = [
    { status: "Created", date: invoice.invoice_date, completed: true },
    { status: "Sent", date: invoice.status !== "DRAFT" ? invoice.invoice_date : undefined, completed: invoice.status !== "DRAFT" },
    { status: "Paid", date: invoice.status === "PAID" ? invoice.payments?.[0]?.date : undefined, completed: invoice.status === "PAID" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/finance/invoices')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Invoices
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-[#0F172A]">
                {invoice.invoice_number || `INV-${invoice.id}`}
              </h1>
              <StatusBadge status={invoice.status} />
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <MoreVertical className="w-4 h-4 mr-2" />
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {invoice.status === "DRAFT" && (
              <DropdownMenuItem onClick={() => handleStatusAction("send")}>
                <Send className="w-4 h-4 mr-2" />
                Send Invoice
              </DropdownMenuItem>
            )}
            {(invoice.status === "SENT" || invoice.status === "OVERDUE") && (
              <DropdownMenuItem onClick={() => handleStatusAction("mark_paid")}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark as Paid
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleDownloadPDF}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </DropdownMenuItem>
            {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
              <DropdownMenuItem onClick={() => handleStatusAction("cancel")} className="text-[#EF4444]">
                <XCircle className="w-4 h-4 mr-2" />
                Cancel Invoice
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Invoice Preview (2/3) */}
        <div className="lg:col-span-2">
          <InvoicePreview
            invoiceNumber={invoice.invoice_number || `INV-${invoice.id}`}
            invoiceDate={new Date(invoice.invoice_date).toLocaleDateString('en-ZA')}
            dueDate={new Date(invoice.due_date).toLocaleDateString('en-ZA')}
            customer={{
              name: invoice.customer_name,
              address: invoice.customer_address,
              city: invoice.customer_city,
              postalCode: invoice.customer_postal_code,
            }}
            lineItems={invoice.line_items || []}
            subtotal={invoice.subtotal}
            vat={invoice.vat_amount}
            total={invoice.total_amount}
            paymentTerms={invoice.payment_terms}
            notes={invoice.notes}
          />
        </div>

        {/* Right Column - Status & Info (1/3) */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Status Timeline</h3>
            <div className="space-y-4">
              {statusTimeline.map((step, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      step.completed ? "bg-[#10B981]" : "bg-[#E2E8F0]"
                    }`}
                  />
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        step.completed ? "text-[#0F172A]" : "text-[#94A3B8]"
                      }`}
                    >
                      {step.status}
                    </p>
                    {step.date && (
                      <p className="text-xs text-[#64748B] mt-0.5">
                        {new Date(step.date).toLocaleDateString('en-ZA')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Payment History</h3>
              <div className="space-y-3">
                {invoice.payments.map((payment) => (
                  <div key={payment.id} className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">
                        <CurrencyDisplay amount={payment.amount} />
                      </p>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        {new Date(payment.date).toLocaleDateString('en-ZA')}
                      </p>
                    </div>
                    {payment.payment_method && (
                      <span className="text-xs text-[#64748B]">{payment.payment_method}</span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Early Pay Eligibility */}
          {invoice.early_pay_eligible && invoice.early_pay_amount && (
            <Card className="p-6 bg-gradient-to-br from-[#EFF6FF] to-white border border-[#2563EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-[#0F172A]">Early Pay Available</h3>
                  <p className="text-xs text-[#64748B] mt-1">Get paid in 2 business days</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">You receive</span>
                  <span className="font-mono font-medium text-[#0F172A]">
                    <CurrencyDisplay amount={invoice.early_pay_amount} />
                  </span>
                </div>
                {invoice.early_pay_fee_percent && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Fee ({invoice.early_pay_fee_percent}%)</span>
                    <span className="font-mono text-[#64748B]">
                      <CurrencyDisplay amount={invoice.total_amount - invoice.early_pay_amount} />
                    </span>
                  </div>
                )}
              </div>
              <Button className="w-full mt-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
                Request Early Payment
              </Button>
            </Card>
          )}

          {/* Customer Info */}
          <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Customer Info</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[#64748B]">Customer</p>
                <p className="text-sm font-medium text-[#0F172A] mt-1">{invoice.customer_name}</p>
              </div>
              {invoice.payment_terms && (
                <div>
                  <p className="text-xs text-[#64748B]">Payment Terms</p>
                  <p className="text-sm text-[#0F172A] mt-1">{invoice.payment_terms}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-[#64748B]">Due Date</p>
                <p className="text-sm text-[#0F172A] mt-1">
                  {new Date(invoice.due_date).toLocaleDateString('en-ZA')}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
