import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { QuoteCopilot } from "./QuoteCopilot";
import { SelectionCardGroup } from "@/components/quotes/SelectionCardGroup";
import { AIQuoteAssistant } from "@/components/quotes/AIQuoteAssistant";
import { QuoteFormComponent } from "@/components/quotes/QuoteFormComponent";
import { ImportFileComponent } from "@/components/quotes/ImportFileComponent";
import { formatCurrency } from "@/lib/formatters";
import { usePost } from "@/hooks/usePost";
import { toast } from "sonner";
import useFetch from "@/hooks/useFetch";
import { patchData } from "@/lib/Api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ParsedQuote {
  quote_number: string;
  customer: string;
  pickup_location: string;
  delivery_location: string;
  cargo_description: string;
  weight: number;
  distance: number;
  base_rate: number;
  fuel_surcharge: number;
  additional_charges: number;
  total_amount: number;
  valid_until: string;
  status: string;
  notes?: string;
  // UI helpers
  vehicleType?: string;
  sla?: number;
  date?: string;
}

export default function NewQuote() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [selectedMethod, setSelectedMethod] = useState("ai");
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedQuote, setParsedQuote] = useState<ParsedQuote | null>(null);
  const [showCopilot, setShowCopilot] = useState(false);
  const queryClient = useQueryClient();

  const { data: existingQuote, isLoading: isLoadingQuote } = useFetch(id ? `api/quotes/${id}` : null, { enabled: !!id });

  useEffect(() => {
    if (existingQuote) {
      setSelectedMethod("form");
    }
  }, [existingQuote]);

  // Mock AI parsing function for chat
  const parseNaturalLanguage = async (text: string): Promise<ParsedQuote> => {
    setIsProcessing(true);

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock parsing result
    const parsed: ParsedQuote = {
      quote_number: "Q-AI-GEN",
      customer: "Makana Foods",
      pickup_location: "JHB",
      delivery_location: "CPT",
      cargo_description: "General Goods",
      weight: 30,
      distance: 1400,
      base_rate: 18000,
      fuel_surcharge: 2000,
      additional_charges: 500,
      total_amount: 20500,
      valid_until: "2025-12-31",
      status: "DRAFT",
      vehicleType: "Superlink 30t",
      sla: 48,
      date: "tomorrow",
      notes: text
    };

    setIsProcessing(false);
    return parsed;
  };

  const handleAISubmit = async (input: string) => {
    try {
      const parsed = await parseNaturalLanguage(input);
      setParsedQuote(parsed);
    } catch (error) {
      console.error("Failed to parse quote:", error);
    }
  };

  const { mutate: updateQuote, isPending: isUpdating } = useMutation<any, Error, any>({
    mutationFn: (data) => patchData({ url: `api/quotes/${id}/`, data }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['api/quotes'] });
      navigate('/bookings/pipeline');
      toast('Quote Updated');
    },
    onError: () => {
      toast('Error! Try again');
    },
  });

  const { mutate: sendQuote, isPending: isSendingQuote } = usePost({
    onSuccess: () => {
      toast.success(id ? 'Quote updated successfully' : 'Quote sent successfully');
      queryClient.refetchQueries({ queryKey: ['api/quotes'] });
      navigate('/bookings/pipeline');
    },
    onError: () => {
      toast.error(id ? 'Failed to update quote' : 'Failed to send quote');
    },
  });

  const handleFormSubmit = (data: any) => {
    const parsed: ParsedQuote = {
      quote_number: data.quote_number,
      customer: data.customer,
      pickup_location: data.pickup_location,
      delivery_location: data.delivery_location,
      cargo_description: data.cargo_description,
      weight: parseFloat(data.weight) || 0,
      distance: parseFloat(data.distance) || 0,
      base_rate: parseFloat(data.base_rate) || 0,
      fuel_surcharge: parseFloat(data.fuel_surcharge) || 0,
      additional_charges: parseFloat(data.additional_charges) || 0,
      total_amount: parseFloat(data.total_amount) || 0,
      valid_until: data.valid_until,
      status: data.status,
      notes: data.notes,
      // UI helpers
      vehicleType: data.vehicleType,
      sla: parseInt(data.sla) || 0,
      date: data.date
    };
    setParsedQuote(parsed);

    // If we have an ID, we are updating, otherwise creating
    if (id) {
      updateQuote(parsed);
    } else {
      sendQuote({ url: "api/quotes/", data: parsed });
    }
  };

  const handleImportSubmit = async (data: { file?: File; text?: string }) => {
    setIsProcessing(true);

    // Simulate AI import processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock parsing imported data
    const parsed: ParsedQuote = {
      quote_number: "Q-IMPORT-001",
      customer: "Tiger Brands",
      pickup_location: "DUR",
      delivery_location: "JHB",
      cargo_description: "Imported Cargo",
      weight: 25,
      distance: 600,
      base_rate: 12000,
      fuel_surcharge: 1500,
      additional_charges: 0,
      total_amount: 13500,
      valid_until: "2025-12-31",
      status: "DRAFT",
      vehicleType: "Rigid 12t",
      sla: 24,
      date: "2025-09-07",
      notes: data.file ? `Imported from ${data.file.name}` : "Imported from text"
    };

    setParsedQuote(parsed);
    setIsProcessing(false);
  };

  const handleConfirmQuote = () => {
    setShowCopilot(true);
  };

  if (showCopilot) {
    return <QuoteCopilot />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/bookings')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-display-1 font-display-semibold text-foreground">
              {id ? `Edit Quote ${id}` : "New Quote"}
            </h1>
            <p className="text-body text-muted-foreground">Create a quote using chat, form, or import</p>
          </div>
        </div>
      </motion.div>

      {/* Selection Card Group */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <SelectionCardGroup
          selectedMethod={selectedMethod}
          onMethodChange={setSelectedMethod}
        />
      </motion.div>

      {/* Dynamic Content Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <AnimatePresence mode="wait">
          {selectedMethod === 'ai' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AIQuoteAssistant
                onSubmit={handleAISubmit}
                isProcessing={isProcessing}
              />
            </motion.div>
          )}

          {selectedMethod === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <QuoteFormComponent
                onSubmit={handleFormSubmit}
                initialData={existingQuote}
              />
            </motion.div>
          )}

          {selectedMethod === 'import' && (
            <motion.div
              key="import"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ImportFileComponent
                onSubmit={handleImportSubmit}
                isProcessing={isProcessing}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Quote Confirmation */}
      {parsedQuote && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          <Card className="border-success/20 bg-success/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                Quote Parsed Successfully
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Quote #</p>
                  <p className="font-medium">{parsedQuote.quote_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{parsedQuote.customer}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Route</p>
                  <p className="font-medium">{parsedQuote.pickup_location} → {parsedQuote.delivery_location}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-medium text-success">{formatCurrency(parsedQuote.total_amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Load</p>
                  <p className="font-medium">{parsedQuote.weight}t {parsedQuote.vehicleType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="outline">{parsedQuote.status}</Badge>
                </div>
              </div>

              {parsedQuote.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm bg-muted/30 rounded p-2 mt-1">{parsedQuote.notes}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button onClick={handleConfirmQuote} className="flex-1">
                  Open Co-Pilot Canvas
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setParsedQuote(null)}
                >
                  Edit Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}