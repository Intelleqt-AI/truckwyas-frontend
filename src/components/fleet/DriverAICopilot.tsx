import { useState } from "react";
import { MessageSquare, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function DriverAICopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");

  const handleAsk = () => {
    // Mock AI responses
    const responses: Record<string, string> = {
      "most profitable": "Mike Johnson is your most profitable driver with an average margin of R24,100 per trip and an ROI score of 94.",
      "coaching": "Focus on Lisa Brown (ROI: 58) - reducing idle time at border crossings could save R4,800/month.",
      "fuel": "Mike Johnson saved R4,500 in fuel costs this month through consistent eco-driving patterns.",
      "top performer": "Mike Johnson leads with 98.1% on-time delivery, 97 safety score, and 95 fuel efficiency score.",
    };

    const lowerQuery = query.toLowerCase();
    const matchedKey = Object.keys(responses).find((key) => lowerQuery.includes(key));
    
    setResponse(
      matchedKey
        ? responses[matchedKey]
        : "Based on current performance data, your top 3 drivers generate 32% of fleet profit. Consider reassigning underperforming drivers to less complex routes for optimization."
    );
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg bg-brand-500 hover:bg-brand-700 z-50"
        size="icon"
      >
        <MessageSquare className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 shadow-modal border-brand-500/20 z-50 animate-scale-in">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-brand-500" />
            <h3 className="text-body font-body-medium text-foreground">Ask AI About Drivers</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setIsOpen(false);
              setQuery("");
              setResponse("");
            }}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <Textarea
            placeholder="Ask anything about your drivers:
• Who is my most profitable driver?
• Which driver needs coaching most?
• Who saved the most on fuel?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[100px] resize-none text-caption"
          />

          <Button
            onClick={handleAsk}
            disabled={!query.trim()}
            className="w-full bg-brand-500 hover:bg-brand-700"
          >
            <Send className="w-4 h-4 mr-2" />
            Ask AI
          </Button>
        </div>

        {response && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-brand-500/10 to-brand-300/10 border border-brand-500/20 animate-fade-in">
            <p className="text-caption text-foreground">{response}</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Quick questions:</p>
          <div className="flex flex-wrap gap-2">
            {[
              "Who is the top performer?",
              "Which driver needs coaching?",
              "Who saved the most on fuel?",
            ].map((q) => (
              <Button
                key={q}
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery(q);
                  setResponse("");
                }}
                className="text-xs"
              >
                {q}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
