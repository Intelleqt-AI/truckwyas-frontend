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
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>INVOICE</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{invoiceNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>TruckWys</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Logistics & Transport</p>
          </div>
        </div>

        {/* Dates and Customer Info */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>Bill To</h3>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{customer.name}</p>
            {customer.address && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{customer.address}</p>}
            {(customer.city || customer.postalCode) && (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {customer.city} {customer.postalCode}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="mb-3">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Invoice Date</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>{invoiceDate}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Due Date</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>{dueDate}</p>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
          <table className="w-full">
            <thead style={{ background: 'var(--bg-surface-hover)' }}>
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Description
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Qty
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Unit Price
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={index} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-primary)' }}>{item.description}</td>
                  <td className="py-3 px-4 text-sm font-mono text-right" style={{ color: 'var(--text-primary)' }}>
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
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
              <CurrencyDisplay amount={subtotal} />
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>VAT (15%)</span>
              <CurrencyDisplay amount={vat} />
            </div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-primary)' }}>Total</span>
              <CurrencyDisplay amount={total} />
            </div>
          </div>
        </div>

        {/* Payment Terms and Notes */}
        {(paymentTerms || notes) && (
          <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            {paymentTerms && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Payment Terms</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>{paymentTerms}</p>
              </div>
            )}
            {notes && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Notes</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>{notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
