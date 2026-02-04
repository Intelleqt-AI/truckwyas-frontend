import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Brain, TrendingUp, DollarSign, Search, FileText } from "lucide-react";

export function AIAssistantButton() {
  const [isOpen, setIsOpen] = useState(false);

  const options = [
    { icon: TrendingUp, label: "Improve cash flow", color: "text-brand-500" },
    { icon: DollarSign, label: "Reduce costs", color: "text-success" },
    { icon: Search, label: "Find hidden money", color: "text-warning" },
    { icon: FileText, label: "Generate board report", color: "text-foreground" }
  ];

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="lg"
        className="fixed bottom-6 right-6 rounded-full h-14 px-6 shadow-glow z-50"
      >
        <Brain className="w-5 h-5 mr-2" />
        AI Assistant
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-brand-500" />
              What would you like to optimize today?
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 py-4">
            {options.map((option, i) => (
              <Button
                key={i}
                variant="outline"
                className="justify-start h-auto py-4 px-4"
                onClick={() => {
                  // Handle option selection
                  setIsOpen(false);
                }}
              >
                <option.icon className={`w-5 h-5 mr-3 ${option.color}`} />
                <span className="text-body">{option.label}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
