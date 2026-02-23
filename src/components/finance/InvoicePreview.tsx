import { Card } from "@/components/ui/card";
import { CurrencyDisplay } from "./CurrencyDisplay";

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoicePreviewProps {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customer: {
    name: string;
    address?: string;
    city?: string;
    postalCode?: string;
  };
  lineItems: InvoiceLineItem[];
  subtotal: number;
  vat: number;
  total: number;
  paymentTerms?: string;
  notes?: string;
}

export function InvoicePreview({
  invoiceNumber,
  invoiceDate,
  dueDate,
  customer,
  lineItems,
  subtotal,
  vat,
  total,
  paymentTerms,
  notes,
}: InvoicePreviewProps) {
  return (
    <Card className="p-8 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">INVOICE</h1>
            <p className="text-sm text-[#64748B] mt-1">{invoiceNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#0F172A]">TruckWys</p>
            <p className="text-xs text-[#64748B] mt-1">Logistics & Transport</p>
          </div>
        </div>

        {/* Dates and Customer Info */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-xs font-medium text-[#64748B] uppercase tracking-wide mb-2">Bill To</h3>
            <p className="text-sm font-medium text-[#0F172A]">{customer.name}</p>
            {customer.address && <p className="text-sm text-[#64748B]">{customer.address}</p>}
            {(customer.city || customer.postalCode) && (
              <p className="text-sm text-[#64748B]">
                {customer.city} {customer.postalCode}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="mb-3">
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Invoice Date</p>
              <p className="text-sm text-[#0F172A] mt-1">{invoiceDate}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Due Date</p>
              <p className="text-sm text-[#0F172A] mt-1">{dueDate}</p>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#F8FAFC]">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Description
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Qty
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Unit Price
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={index} className="border-t border-[#E2E8F0]">
                  <td className="py-3 px-4 text-sm text-[#0F172A]">{item.description}</td>
                  <td className="py-3 px-4 text-sm font-mono text-[#0F172A] text-right">
                    {item.quantity}
                  </td>
                  <td className="py-3 px-4 text-sm text-right">
                    <CurrencyDisplay amount={item.unitPrice} />
                  </td>
                  <td className="py-3 px-4 text-sm text-right">
                    <CurrencyDisplay amount={item.total} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#64748B]">Subtotal</span>
              <CurrencyDisplay amount={subtotal} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#64748B]">VAT (15%)</span>
              <CurrencyDisplay amount={vat} />
            </div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-[#E2E8F0]">
              <span className="text-[#0F172A]">Total</span>
              <CurrencyDisplay amount={total} className="text-[#0F172A]" />
            </div>
          </div>
        </div>

        {/* Payment Terms and Notes */}
        {(paymentTerms || notes) && (
          <div className="space-y-3 pt-4 border-t border-[#E2E8F0]">
            {paymentTerms && (
              <div>
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Payment Terms</p>
                <p className="text-sm text-[#0F172A] mt-1">{paymentTerms}</p>
              </div>
            )}
            {notes && (
              <div>
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Notes</p>
                <p className="text-sm text-[#0F172A] mt-1">{notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
