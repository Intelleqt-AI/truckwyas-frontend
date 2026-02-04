import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";
import { QuoteSummaryHeader } from "./QuoteSummaryHeader";
import { AIInsightsGrid } from "./AIInsightsGrid";

interface Quote {
  id: string;
  customer: string;
  origin: string;
  destination: string;
  slaHours: number;
  price: number;
  marginPct: number;
  confidence: string;
  status: string;
}

interface AIInsights {
  recommendation: {
    scenario: string;
    uplift: number;
    reason: string;
  };
  confidence: {
    level: string;
    percentage: number;
    estimatedUplift: number;
  };
}

interface AIInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quote;
  insights: AIInsights;
  onApply: (patch: { price?: number; marginPct?: number; planId?: 'A'|'B'|'C' }) => void;
  onOpenCanvas: () => void;
}

const processingSteps = [
  "Analysing lane history...",
  "Calculating toll costs...", 
  "Factoring border delays...",
  "Generating insights..."
];

export function AIInsightsModal({ 
  isOpen, 
  onClose, 
  quote, 
  insights, 
  onApply, 
  onOpenCanvas 
}: AIInsightsModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsProcessing(true);
      setShowContent(false);
      setProcessingStep(0);

      // Animate through processing steps
      const stepInterval = setInterval(() => {
        setProcessingStep((prev) => {
          if (prev < processingSteps.length - 1) {
            return prev + 1;
          } else {
            clearInterval(stepInterval);
            setTimeout(() => {
              setIsProcessing(false);
              setShowContent(true);
            }, 300);
            return prev;
          }
        });
      }, 400);

      return () => clearInterval(stepInterval);
    } else {
      setIsProcessing(false);
      setShowContent(false);
    }
  }, [isOpen]);

  // Mock extended quote data for summary header
  const summaryQuote = {
    id: quote.id,
    customer: quote.customer,
    lane: {
      origin: quote.origin,
      destination: quote.destination
    },
    slaHours: quote.slaHours,
    expiresAt: new Date(Date.now() + 59 * 60 * 60 * 1000).toISOString(), // 59 hours from now
    price: quote.price,
    marginPct: quote.marginPct,
    vehicle: "Curtain Side 34t",
    weightTons: 28,
    distanceKm: 1400,
    estimatedFuelL: 560,
    tollsZar: 450
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[900px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 shrink-0">
          <DialogTitle className="text-muted-foreground">
            AI Quote Analysis
          </DialogTitle>
        </DialogHeader>

        {isProcessing ? (
          // AI Processing State
          <motion.div 
            className="flex items-center justify-center py-12 space-x-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 180, 360]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Sparkles className="w-8 h-8 text-primary" />
            </motion.div>
            <motion.div
              key={processingStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-body text-muted-foreground"
            >
              {processingSteps[processingStep]}
            </motion.div>
          </motion.div>
        ) : showContent ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Sticky Quote Summary Header (contained card) */}
            <div className="sticky top-0 z-20 mb-4">
              <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4">
                <QuoteSummaryHeader quote={summaryQuote} />
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-1">
              <AIInsightsGrid
                quoteId={quote.id}
                insights={insights}
                onApply={onApply}
                onOpenCanvas={onOpenCanvas}
              />
            </div>
          </motion.div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}