import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Mic, Send, Clock, MapPin, Package, Truck } from "lucide-react";
import { PriceBandSlider } from "@/components/revenue/PriceBandSlider";
import { CostWaterfall } from "@/components/revenue/CostWaterfall";
import { WinCurve } from "@/components/revenue/WinCurve";
import { ScenarioCanvas } from "@/components/quotes/ScenarioCanvas";
import { QuoteContextChips } from "@/components/quotes/QuoteContextChips";
import { QuoteHistory } from "@/components/quotes/QuoteHistory";
import { formatCurrency, formatPercentage } from "@/lib/formatters";

// Mock quote data
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
  expiresAt: "2025-09-08T17:00:00Z",
  confidence: 0.92
};

export function Quotes() {
  const [chatInput, setChatInput] = useState("");
  const [isListening, setIsListening] = useState(false);

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      // TODO: implement chat message sending
      setChatInput("");
    }
  };

  const handleVoiceInput = () => {
    setIsListening(!isListening);
    // Mock voice input functionality
  };

  const getGuardrailBadge = (marginPct: number) => {
    if (marginPct >= 15) return { label: "Within Policy", variant: "default" as const, color: "text-success" };
    if (marginPct >= 12) return { label: "Near Floor", variant: "secondary" as const, color: "text-warning" };
    return { label: "Below Floor", variant: "destructive" as const, color: "text-destructive" };
  };

  const guardrail = getGuardrailBadge(mockQuote.marginPct);
  const expiryDate = new Date(mockQuote.expiresAt);
  const timeToExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60));

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-display-h1 font-display-bold text-brand-900">Quotes Co-Pilot</h1>
        <p className="text-body text-muted-foreground">AI-powered quoting with guardrails and scenario planning</p>
        
        {/* Action Bar */}
        <div className="flex items-center gap-3 pt-4">
          <Button variant="outline">Save Draft</Button>
          <Button variant="outline">Generate PDF</Button>
          <Button variant="outline">Copy Link</Button>
          <Button>Send Quote</Button>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Rail - Voice/Chat & Context */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-3 space-y-6"
        >
          
          {/* Voice + Chat Input */}
          <Card className="bg-card border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-caption text-muted-foreground">AI Assistant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={isListening ? "default" : "outline"}
                  size="icon"
                  onClick={handleVoiceInput}
                  className={isListening ? "bg-destructive animate-pulse" : ""}
                >
                  <Mic className="w-4 h-4" />
                </Button>
                <Input
                  placeholder="Ask AI about routes, pricing, risks..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                />
                <Button size="icon" onClick={handleSendMessage}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Parsed Context Chips */}
          <QuoteContextChips quote={mockQuote} />
          
          {/* Quote History for Customer */}
          <QuoteHistory customerId="makana_foods" />
        </motion.div>

        {/* Center - Main Quote Card & Scenario Canvas */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-9 space-y-6"
        >
          
          {/* Central Quote Card */}
          <Card className="bg-card border border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="font-body-medium text-foreground">
                      {mockQuote.origin} → {mockQuote.destination}
                    </span>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {mockQuote.slaHours}h SLA
                  </Badge>
                  <Badge variant={guardrail.variant} className={guardrail.color}>
                    {guardrail.label}
                  </Badge>
                </div>
                
                <div className="text-right">
                  <div className="text-caption text-muted-foreground">Expires in</div>
                  <div className="text-body-medium font-body-medium text-warning">
                    {timeToExpiry}h
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Price & Margin Display */}
              <div className="text-center space-y-2">
                <div className="text-display-h2 font-display-bold text-foreground text-tabular">
                  {formatCurrency(mockQuote.price)}
                </div>
                <div className="text-body font-body-medium text-success">
                  {formatPercentage(mockQuote.marginPct / 100)} margin
                </div>
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Price Band Slider */}
                <PriceBandSlider />

                {/* Cost Waterfall */}
                <CostWaterfall />
              </div>

              {/* Win Curve Sparkline */}
              <div className="p-4 bg-muted/20 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-caption text-muted-foreground">Win Probability Curve</span>
                  <span className="text-body-medium font-body-medium text-primary">
                    {Math.round((mockQuote.confidence || 0.6) * 100)}%
                  </span>
                </div>
                <WinCurve />
              </div>
            </CardContent>
          </Card>

          {/* Scenario Canvas */}
          <ScenarioCanvas />
        </motion.div>
      </div>
    </div>
  );
}