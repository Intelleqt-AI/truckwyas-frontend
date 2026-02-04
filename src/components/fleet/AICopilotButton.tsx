import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sparkles, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function AICopilotButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");

  const handleAsk = () => {
    // Mock AI response
    setResponse(
      "Based on your fleet data, TRK-023 cost you the most this month at R 18,500 due to high fuel consumption and maintenance. I recommend reviewing the driver's performance and scheduling a maintenance check."
    );
  };

  const suggestedQuestions = [
    "Which vehicle cost me the most this month?",
    "Who is the most profitable driver?",
    "Which routes have the best margins?",
    "What vehicles need maintenance soon?",
  ];

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg bg-brand-500 hover:bg-brand-700 text-white z-50"
        size="icon"
      >
        <Sparkles className="w-5 h-5" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-500" />
              Ask Truckwys AI
            </DialogTitle>
            <DialogDescription>
              Ask anything about your fleet performance, profitability, or operations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Suggested Questions */}
            {!response && (
              <div className="space-y-2">
                <p className="text-caption text-muted-foreground">Suggested questions:</p>
                <div className="space-y-2">
                  {suggestedQuestions.map((q, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-2 px-3"
                      onClick={() => {
                        setQuestion(q);
                        handleAsk();
                      }}
                    >
                      <span className="text-body text-foreground">{q}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Response */}
            {response && (
              <Card className="bg-gradient-to-r from-brand-500/5 to-brand-300/5 border-brand-500/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-brand-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-body text-foreground mb-2 font-body-medium">Answer:</p>
                      <p className="text-body text-muted-foreground">{response}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Type your question..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && question.trim()) {
                    handleAsk();
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={handleAsk}
                disabled={!question.trim()}
                className="bg-brand-500 hover:bg-brand-700 text-white"
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
