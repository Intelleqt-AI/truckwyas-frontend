import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, ExternalLink, TrendingUp } from "lucide-react";
import { CompactWinCurve } from "./CompactWinCurve";
import { CompactCostWaterfallChart } from "./CompactCostWaterfallChart";
import { CompactScenarioPlanner } from "./CompactScenarioPlanner";
import { formatCurrency } from "@/lib/formatters";

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

interface AIInsightTrayProps {
  quote: Quote;
  isOpen: boolean;
  onClose: () => void;
}

const processingSteps = [
  "Analysing lane history...",
  "Calculating toll costs...", 
  "Factoring border delays...",
  "Generating insights..."
];

export function AIInsightTray({ quote, isOpen, onClose }: AIInsightTrayProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState("A");
  const [hoveredScenario, setHoveredScenario] = useState<string | null>(null);

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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.td 
          colSpan={10}
          className="p-0 border-0 align-top"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="px-6 py-4 bg-muted/20">
            {isProcessing ? (
              // AI Processing State
              <motion.div 
                className="flex items-center justify-center py-6 space-x-4"
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
                  <BrainCircuit className="w-8 h-8 text-primary" />
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
                className="space-y-5"
              >
                {/* AI Personality Banner */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3" style={{ transform: "none" }}>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <BrainCircuit className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium text-foreground">AI recommends:</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-foreground">Route B</span>
                      <Badge variant="outline" className="bg-success/5 text-success border-success/20 px-2 py-0.5">
                        +{formatCurrency(750)}
                      </Badge>
                      <span className="text-muted-foreground">lower fuel, higher ETA</span>
                    </div>
                  </div>
                </div>

                {/* Top Row - Two Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Top Left - Cost Waterfall */}
                  <Card className="bg-card/50 border-border min-h-[200px]">
                    <CardHeader className="pb-3 px-4 pt-4">
                      <CardTitle className="text-sm text-muted-foreground font-medium">Cost Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 overflow-hidden h-64">
                      <CompactCostWaterfallChart quote={quote} />
                    </CardContent>
                  </Card>

                  {/* Top Right - Win Probability */}
                  <Card className="bg-card/50 border-border min-h-[200px]">
                    <CardHeader className="pb-3 px-4 pt-4">
                      <CardTitle className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                        Win Probability
                        {hoveredScenario && (
                          <Badge variant="outline" className="text-xs animate-pulse bg-primary/5 text-primary border-primary/20">
                            Scenario {hoveredScenario}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 overflow-hidden h-64">
                      <CompactWinCurve quote={quote} selectedScenario={selectedScenario} />
                    </CardContent>
                  </Card>
                </div>

                {/* Bottom - Full Width Scenario Planner */}
                <Card className="bg-card/50 border-border">
                  <CardHeader className="pb-3 px-4 pt-4">
                    <CardTitle className="text-sm text-muted-foreground font-medium">Route & Resource Optimization</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <CompactScenarioPlanner 
                      quote={quote}
                      selectedScenario={selectedScenario}
                      onScenarioChange={setSelectedScenario}
                      onScenarioHover={setHoveredScenario}
                    />
                    
                    {/* Confidence Info - White Container */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mt-6 border border-border rounded-md p-3 bg-card"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-success" />
                            <span className="text-sm font-medium text-foreground">Confidence: High (92%)</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Estimated uplift {formatCurrency(550)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button variant="outline" size="sm" className="gap-2">
                            <ExternalLink className="w-4 h-4" />
                            Open Full Canvas
                          </Button>
                          <Button size="sm" className="gap-2">
                            Apply Decision
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : null}
          </div>
        </motion.td>
      )}
    </AnimatePresence>
  );
}