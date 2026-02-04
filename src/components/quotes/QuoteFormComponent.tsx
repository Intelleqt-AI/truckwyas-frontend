import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import useFetch from "@/hooks/useFetch";

interface QuoteFormData {
  quote_number: string;
  customer: string;
  pickup_location: string;
  delivery_location: string;
  cargo_description: string;
  weight: string;
  distance: string;
  base_rate: string;
  fuel_surcharge: string;
  additional_charges: string;
  total_amount: string;
  valid_until: string;
  status: string;
  notes: string;
  // UI helper fields
  vehicleType?: string;
  sla?: string;
}

interface QuoteFormComponentProps {
  onSubmit: (data: QuoteFormData) => void;
  initialData?: any;
}

export function QuoteFormComponent({ onSubmit, initialData }: QuoteFormComponentProps) {
  const [formData, setFormData] = useState<QuoteFormData>({
    quote_number: "",
    customer: "",
    pickup_location: "",
    delivery_location: "",
    cargo_description: "",
    weight: "",
    distance: "",
    base_rate: "",
    fuel_surcharge: "0",
    additional_charges: "0",
    total_amount: "",
    valid_until: "",
    status: "DRAFT",
    notes: "",
    vehicleType: "",
    sla: "48"
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        quote_number: initialData.quote_number || "",
        customer: String(initialData.customer || ""),
        pickup_location: initialData.pickup_location || "",
        delivery_location: initialData.delivery_location || "",
        cargo_description: initialData.cargo_description || "",
        weight: String(initialData.weight || ""),
        distance: String(initialData.distance || ""),
        base_rate: String(initialData.base_rate || ""),
        fuel_surcharge: String(initialData.fuel_surcharge || "0"),
        additional_charges: String(initialData.additional_charges || "0"),
        total_amount: String(initialData.total_amount || ""),
        valid_until: initialData.valid_until || "",
        status: initialData.status || "DRAFT",
        notes: initialData.notes || "",
        vehicleType: initialData.vehicleType || "",
        sla: String(initialData.sla_hours || "48")
      });
    }
  }, [initialData]);

  const { data: customersData, isLoading: customersLoading } = useFetch("api/customers");

  // Mock smart defaults (can be expanded)
  const applySmartDefaults = (customerId: string) => {
    // In a real app, fetch customer specific defaults or contracts
    console.log("Applying defaults for customer:", customerId);
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const calculateTotal = (base: string, fuel: string, additional: string) => {
    const b = parseFloat(base) || 0;
    const f = parseFloat(fuel) || 0;
    const a = parseFloat(additional) || 0;
    return (b + f + a).toFixed(2);
  };

  const handleFinancialChange = (field: keyof QuoteFormData, value: string) => {
    const newFormData = { ...formData, [field]: value };
    const total = calculateTotal(
      field === 'base_rate' ? value : newFormData.base_rate,
      field === 'fuel_surcharge' ? value : newFormData.fuel_surcharge,
      field === 'additional_charges' ? value : newFormData.additional_charges
    );
    setFormData({ ...newFormData, total_amount: total });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quote Details</CardTitle>
        <p className="text-muted-foreground">
          Fill in the quote details
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="quote_number">Quote Number</Label>
            <Input
              id="quote_number"
              placeholder="e.g. Q-1001"
              value={formData.quote_number}
              onChange={(e) => setFormData(prev => ({ ...prev, quote_number: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Select
              value={formData.customer}
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, customer: value }));
                applySmartDefaults(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customersData?.results?.map((customer: any) => (
                  <SelectItem key={customer.id} value={String(customer.id)}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valid_until">Valid Until</Label>
            <Input
              id="valid_until"
              type="date"
              value={formData.valid_until}
              onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickup_location">Pickup Location</Label>
            <Input
              id="pickup_location"
              placeholder="e.g. JHB"
              value={formData.pickup_location}
              onChange={(e) => setFormData(prev => ({ ...prev, pickup_location: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_location">Delivery Location</Label>
            <Input
              id="delivery_location"
              placeholder="e.g. CPT"
              value={formData.delivery_location}
              onChange={(e) => setFormData(prev => ({ ...prev, delivery_location: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">Weight (tons)</Label>
            <Input
              id="weight"
              type="number"
              placeholder="0.00"
              value={formData.weight}
              onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="distance">Distance (km)</Label>
            <Input
              id="distance"
              type="number"
              placeholder="0.00"
              value={formData.distance}
              onChange={(e) => setFormData(prev => ({ ...prev, distance: e.target.value }))}
            />
          </div>

          <div className="col-span-1 md:col-span-2 space-y-2">
            <Label htmlFor="cargo_description">Cargo Description</Label>
            <Textarea
              id="cargo_description"
              placeholder="Describe the cargo..."
              value={formData.cargo_description}
              onChange={(e) => setFormData(prev => ({ ...prev, cargo_description: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="base_rate">Base Rate</Label>
            <Input
              id="base_rate"
              type="number"
              placeholder="0.00"
              value={formData.base_rate}
              onChange={(e) => handleFinancialChange('base_rate', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fuel_surcharge">Fuel Surcharge</Label>
            <Input
              id="fuel_surcharge"
              type="number"
              placeholder="0.00"
              value={formData.fuel_surcharge}
              onChange={(e) => handleFinancialChange('fuel_surcharge', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="additional_charges">Additional Charges</Label>
            <Input
              id="additional_charges"
              type="number"
              placeholder="0.00"
              value={formData.additional_charges}
              onChange={(e) => handleFinancialChange('additional_charges', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="total_amount">Total Amount</Label>
            <Input
              id="total_amount"
              type="number"
              placeholder="0.00"
              value={formData.total_amount}
              readOnly
              className="bg-muted"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Internal Notes</Label>
          <Textarea
            id="notes"
            placeholder="Any internal notes..."
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          />
        </div>

        <Button
          onClick={handleSubmit}
          className="w-full"
          disabled={!formData.customer || !formData.pickup_location || !formData.delivery_location || !formData.quote_number}
        >
          {initialData ? "Update Quote" : "Create Quote"}
        </Button>
      </CardContent>
    </Card>
  );
}