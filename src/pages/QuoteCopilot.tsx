import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Save, Send, FileText, Copy, Mic } from "lucide-react";
import { CentralQuoteCard } from "@/components/quotes/CentralQuoteCard";
import { PriceBandSlider } from "@/components/revenue/PriceBandSlider";
import { CostWaterfall } from "@/components/revenue/CostWaterfall";
import { WinCurve } from "@/components/revenue/WinCurve";
import { ScenarioCanvas } from "@/components/quotes/ScenarioCanvas";
import { QuoteContextChips } from "@/components/quotes/QuoteContextChips";
import { AgentCard } from "@/components/agent/AgentCard";

// Mock quote data - in real app would fetch from API
const mockQuote = {
  id: "Q-1001",
  customer: "Makana Foods", 
  origin: "JHB",
  destination: "CPT",
  vehicleClass: "Superlink-30t",
  weightTons: 30,
  slaHours: 48,
  price: 21500,
  marginPct: 12.4,
  guardrail: "Within" as const,
  expiresAt: "2025-09-08T17:00:00Z",
  confidence: 0.92
};

export function QuoteCopilot() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chatInput, setChatInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(mockQuote.price);
  const [currentMargin, setCurrentMargin] = useState(mockQuote.marginPct);

  const isNewQuote = id === 'new';
  const quoteId = isNewQuote ? 'New Quote' : id || '';

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      // TODO: implement chat message sending
      setChatInput("");
    }
  };

  const handleVoiceInput = () => {
    setIsListening(!isListening);
  };

  const handlePriceChange = (newPrice: number) => {
    setCurrentPrice(newPrice);
    // Calculate new margin based on price change
    const baseCost = mockQuote.price * (1 - mockQuote.marginPct / 100);
    const newMargin = ((newPrice - baseCost) / newPrice) * 100;
    setCurrentMargin(newMargin);
  };

  const getGuardrail = (marginPct: number) => {
    if (marginPct >= 15) return 'Within';
    if (marginPct >= 12) return 'Near';
    return 'Below';
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/quotes')}
            className="hover-lift"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-body-medium font-body-medium text-foreground">{quoteId}</h1>
            <p className="text-caption text-muted-foreground">
              {mockQuote.customer} • {mockQuote.origin} → {mockQuote.destination}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-caption">
            <Save className="w-3 h-3 mr-1.5" />
            Save
          </Button>
          <Button variant="outline" size="sm" className="text-caption">
            <FileText className="w-3 h-3 mr-1.5" />
            PDF
          </Button>
          <Button variant="outline" size="sm" className="text-caption">
            <Copy className="w-3 h-3 mr-1.5" />
            Copy
          </Button>
          <Button size="sm" className="text-caption">
            <Send className="w-3 h-3 mr-1.5" />
            Send
          </Button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Main Content */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-8 space-y-4"
        >
          
          {/* Central Quote Card */}
          <CentralQuoteCard
            quoteId={quoteId}
            customer={mockQuote.customer}
            lane={{ origin: mockQuote.origin, destination: mockQuote.destination }}
            slaHours={mockQuote.slaHours}
            price={currentPrice}
            marginPct={currentMargin}
            guardrail={getGuardrail(currentMargin)}
            expiresAt={mockQuote.expiresAt}
          />

          {/* Accordion Sections */}
          <Accordion type="multiple" defaultValue={["price-band", "win-curve"]} className="space-y-2">
            <AccordionItem value="price-band" className="border rounded-lg px-4 bg-card">
              <AccordionTrigger className="text-caption text-muted-foreground py-3 hover:no-underline">
                Price Band Optimiser
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <PriceBandSlider />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="cost-waterfall" className="border rounded-lg px-4 bg-card">
              <AccordionTrigger className="text-caption text-muted-foreground py-3 hover:no-underline">
                Cost Waterfall Analysis
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <CostWaterfall />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="scenario" className="border rounded-lg px-4 bg-card">
              <AccordionTrigger className="text-caption text-muted-foreground py-3 hover:no-underline">
                Scenario Planning
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <ScenarioCanvas />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="win-curve" className="border rounded-lg px-4 bg-card">
              <AccordionTrigger className="text-caption text-muted-foreground py-3 hover:no-underline">
                Win Probability Analysis
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <WinCurve />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.div>

        {/* Right Column - AI Assistant & Context */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-4 space-y-4"
        >
          
          {/* AI Assistant */}
          <div className="space-y-3">
            <h3 className="text-caption text-muted-foreground">AI Assistant</h3>
            <div className="flex gap-2">
              <Button
                variant={isListening ? "default" : "outline"}
                size="icon"
                onClick={handleVoiceInput}
                className={`w-8 h-8 ${isListening ? "bg-destructive animate-pulse" : ""}`}
              >
                <Mic className="w-3 h-3" />
              </Button>
              <Input
                placeholder="Ask about this quote..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 h-8 text-caption"
              />
              <Button size="icon" onClick={handleSendMessage} className="w-8 h-8">
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Parsed Context */}
          <div>
            <h3 className="text-caption text-muted-foreground mb-3">Context</h3>
            <QuoteContextChips quote={mockQuote} />
          </div>

          {/* Agent Feed */}
          <div className="space-y-3">
            <h3 className="text-caption text-muted-foreground">Agent Feed</h3>
            
            <div className="space-y-3">
              <AgentCard
                id="margin-analysis"
                title="Margin Analysis"
                what="Current margin at 12.4% is near policy floor. Fuel costs account for 22% of total cost base."
                impactZAR={2650}
                confidence={0.89}
                why={[
                  "Current margin at 12.4% is near policy floor",
                  "Fuel costs account for 22% of total cost base"
                ]}
                actions={[
                  { id: "evidence", label: "Evidence", type: "secondary" },
                  { id: "pricing", label: "Adjust", type: "primary" }
                ]}
                className="text-caption"
              />

              <AgentCard
                id="route-optimization"
                title="Route Optimisation"
                what="Route B shows +R550 profit delta via N1 bypass. 35min longer ETA but avoids peak traffic."
                impactZAR={550}
                confidence={0.74}
                why={[
                  "Route B shows +R550 profit delta via N1 bypass",
                  "35min longer ETA but avoids peak traffic"
                ]}
                actions={[
                  { id: "route", label: "Select", type: "primary" },
                  { id: "map", label: "Map", type: "secondary" }
                ]}
                className="text-caption"
              />

              <AgentCard
                id="vehicle-driver"
                title="Vehicle & Driver"
                what="V-04 + D-12 recommended pairing. Driver familiar with CPT route (8 trips YTD)."
                impactZAR={0}
                confidence={0.95}
                why={[
                  "V-04 + D-12 recommended pairing",
                  "Driver familiar with CPT route (8 trips YTD)"
                ]}
                actions={[
                  { id: "vehicle", label: "Assign", type: "primary" }
                ]}
                className="text-caption"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}