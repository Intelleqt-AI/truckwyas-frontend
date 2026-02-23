import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, X, CheckCircle2 } from "lucide-react";
import { CurrencyDisplay } from "@/components/finance/CurrencyDisplay";
import { InvoicePreview } from "@/components/finance/InvoicePreview";
import useFetch from "@/hooks/useFetch";
import { usePost } from "@/hooks/usePost";

interface Trip {
  id: number;
  trip_number: string;
  customer_name: string;
  route: string;
  completion_date: string;
  amount: number;
  has_invoice: boolean;
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function CreateInvoice() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedTrips, setSelectedTrips] = useState<number[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [customLineItems, setCustomLineItems] = useState<LineItem[]>([]);
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");

  const { data: tripsData, isLoading } = useFetch<{ results: Trip[] }>("/api/trips/?has_invoice=false&status=completed");
  const { mutate: createInvoice, isPending } = usePost();

  const completedTrips = tripsData?.results || [];

  const handleTripSelect = (tripId: number) => {
    setSelectedTrips(prev =>
      prev.includes(tripId) ? prev.filter(id => id !== tripId) : [...prev, tripId]
    );
  };

  const handleNextToReview = () => {
    // Generate line items from selected trips
    const items: LineItem[] = selectedTrips.map(tripId => {
      const trip = completedTrips.find(t => t.id === tripId);
      return {
        description: `${trip?.trip_number || ''} - ${trip?.route || ''}`,
        quantity: 1,
        unitPrice: trip?.amount || 0,
        total: trip?.amount || 0,
      };
    });
    setLineItems(items);

    // Set default due date to 30 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    setDueDate(futureDate.toISOString().split('T')[0]);

    setStep(2);
  };

  const handleAddCustomLineItem = () => {
    setCustomLineItems([...customLineItems, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const handleUpdateCustomLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...customLineItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "quantity" || field === "unitPrice") {
      updated[index].total = updated[index].quantity * updated[index].unitPrice;
    }

    setCustomLineItems(updated);
  };

  const handleRemoveCustomLineItem = (index: number) => {
    setCustomLineItems(customLineItems.filter((_, i) => i !== index));
  };

  const allLineItems = [...lineItems, ...customLineItems];
  const subtotal = allLineItems.reduce((sum, item) => sum + item.total, 0);
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  const handleCreateInvoice = (saveAndSend: boolean) => {
    const customerName = completedTrips.find(t => selectedTrips.includes(t.id))?.customer_name || "";

    const invoiceData = {
      customer_name: customerName,
      total_amount: total,
      subtotal: subtotal,
      vat_amount: vat,
      status: saveAndSend ? "SENT" : "DRAFT",
      due_date: dueDate,
      invoice_date: new Date().toISOString().split('T')[0],
      payment_terms: paymentTerms,
      notes: notes,
      line_items: allLineItems,
      trip_ids: selectedTrips,
    };

    createInvoice(
      { url: "/api/invoices/", data: invoiceData },
      {
        onSuccess: (data: any) => {
          navigate(`/finance/invoices/${data.id}`);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-[#64748B]">Loading trips...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/finance/invoices')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Create Invoice</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Step {step} of 3: {step === 1 ? "Select Trips" : step === 2 ? "Review & Edit" : "Confirm"}
          </p>
        </div>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex-1 h-1 rounded ${
              s <= step ? "bg-[#2563EB]" : "bg-[#E2E8F0]"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Select Trips */}
      {step === 1 && (
        <Card className="bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="p-6 border-b border-[#F1F5F9]">
            <h2 className="text-lg font-semibold text-[#0F172A]">Select Completed Trips</h2>
            <p className="text-sm text-[#64748B] mt-1">
              Choose one or more completed trips to include in this invoice
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9]">
                  <th className="w-12 py-4 px-6"></th>
                  <th className="text-left py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Trip ID
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Customer
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Route
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Date
                  </th>
                  <th className="text-right py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {completedTrips.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#64748B]">
                      No completed trips available for invoicing.
                    </td>
                  </tr>
                ) : (
                  completedTrips.map((trip) => (
                    <tr
                      key={trip.id}
                      className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      onClick={() => handleTripSelect(trip.id)}
                    >
                      <td className="py-4 px-6">
                        <input
                          type="checkbox"
                          checked={selectedTrips.includes(trip.id)}
                          onChange={() => handleTripSelect(trip.id)}
                          className="w-4 h-4 text-[#2563EB] rounded border-[#E2E8F0]"
                        />
                      </td>
                      <td className="py-4 px-6 text-sm font-medium text-[#0F172A]">
                        {trip.trip_number || `TRIP-${trip.id}`}
                      </td>
                      <td className="py-4 px-6 text-sm text-[#0F172A]">{trip.customer_name}</td>
                      <td className="py-4 px-6 text-sm text-[#0F172A]">{trip.route}</td>
                      <td className="py-4 px-6 text-sm text-[#0F172A]">
                        {new Date(trip.completion_date).toLocaleDateString('en-ZA')}
                      </td>
                      <td className="py-4 px-6 text-sm text-right">
                        <CurrencyDisplay amount={trip.amount} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-6 border-t border-[#F1F5F9] flex justify-end">
            <Button
              onClick={handleNextToReview}
              disabled={selectedTrips.length === 0}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
            >
              Continue to Review
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Review & Edit */}
      {step === 2 && (
        <div className="space-y-6">
          <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h2 className="text-lg font-semibold text-[#0F172A] mb-4">Line Items</h2>

            {/* Trip Line Items */}
            <div className="space-y-2 mb-4">
              {lineItems.map((item, index) => (
                <div key={index} className="flex items-center gap-4 p-3 bg-[#F8FAFC] rounded">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#0F172A]">{item.description}</p>
                  </div>
                  <div className="text-sm font-mono text-[#0F172A]">
                    <CurrencyDisplay amount={item.total} />
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Line Items */}
            {customLineItems.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-3 mb-3">
                <div className="col-span-5">
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => handleUpdateCustomLineItem(index, "description", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleUpdateCustomLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    placeholder="Unit Price"
                    value={item.unitPrice}
                    onChange={(e) => handleUpdateCustomLineItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2">
                  <Input value={item.total.toFixed(2)} disabled />
                </div>
                <div className="col-span-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCustomLineItem(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={handleAddCustomLineItem} className="mt-2">
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Line Item
            </Button>

            {/* Invoice Details */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger id="paymentTerms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Net 30">Net 30</SelectItem>
                    <SelectItem value="Net 60">Net 60</SelectItem>
                    <SelectItem value="Net 90">Net 90</SelectItem>
                    <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes or terms..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Totals */}
            <div className="mt-6 flex justify-end">
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
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
              Continue to Preview
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Confirm */}
      {step === 3 && (
        <div className="space-y-6">
          <InvoicePreview
            invoiceNumber="DRAFT"
            invoiceDate={new Date().toLocaleDateString('en-ZA')}
            dueDate={new Date(dueDate).toLocaleDateString('en-ZA')}
            customer={{
              name: completedTrips.find(t => selectedTrips.includes(t.id))?.customer_name || "",
            }}
            lineItems={allLineItems}
            subtotal={subtotal}
            vat={vat}
            total={total}
            paymentTerms={paymentTerms}
            notes={notes}
          />

          <Card className="p-6 bg-[#EFF6FF] border border-[#2563EB]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#2563EB] mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[#0F172A]">Ready to create invoice?</h3>
                <p className="text-sm text-[#64748B] mt-1">
                  You can save this as a draft or save and send it immediately to the customer.
                </p>
              </div>
            </div>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              variant="outline"
              onClick={() => handleCreateInvoice(false)}
              disabled={isPending}
            >
              Save as Draft
            </Button>
            <Button
              onClick={() => handleCreateInvoice(true)}
              disabled={isPending}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
            >
              {isPending ? "Creating..." : "Save & Send"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
