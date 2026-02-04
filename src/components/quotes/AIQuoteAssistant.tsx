import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Mic, MicOff, Send } from "lucide-react";

interface AIQuoteAssistantProps {
  onSubmit: (input: string) => void;
  isProcessing?: boolean;
}

export function AIQuoteAssistant({ onSubmit, isProcessing }: AIQuoteAssistantProps) {
  const [chatInput, setChatInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [animatedText, setAnimatedText] = useState("");

  // Animated typing effect for the example text
  const exampleText = "Quote for Makana Foods, JHB → CPT, 30t superlink, tomorrow, 48h SLA";
  
  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index <= exampleText.length) {
        setAnimatedText(exampleText.slice(0, index));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 50);

    return () => clearInterval(timer);
  }, []);

  const handleSubmit = () => {
    if (!chatInput.trim()) return;
    onSubmit(chatInput);
  };

  const handleVoiceToggle = () => {
    if (!isListening) {
      // Start voice recognition
      if ('webkitSpeechRecognition' in window) {
        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setChatInput(transcript);
        };
        
        recognition.start();
      }
    } else {
      setIsListening(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Let's build your quote</h2>
        <p className="text-muted-foreground">
          Type or speak your quote requirements naturally
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-500" />
            AI Quote Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-2">Example:</p>
            <p className="text-sm italic font-mono">
              "{animatedText}"
              <span className="animate-pulse">|</span>
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              onClick={handleVoiceToggle}
              className={isListening ? "animate-pulse" : ""}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Input
              placeholder="Describe your quote requirements..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              className="flex-1"
              disabled={isProcessing}
            />
            <Button 
              onClick={handleSubmit} 
              disabled={!chatInput.trim() || isProcessing}
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          {isListening && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              Listening...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}