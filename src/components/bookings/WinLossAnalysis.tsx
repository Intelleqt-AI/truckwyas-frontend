import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AnalysisFactor {
  reason: string;
  insight: string;
  actionLabel: string;
  actionRoute: string;
  percentage?: number;
}

export function WinLossAnalysis() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"winning" | "losing">("losing");

  const losingFactors: AnalysisFactor[] = [
    {
      reason: "Pricing",
      insight: "AI analysis shows your quotes for the CPT-PE lane were 14% higher than the lane's historical benchmark on deals you lost.",
      actionLabel: "Review CPT-PE Pricing",
      actionRoute: "/bookings/pipeline?lane=CPT-PE&status=lost",
      percentage: 42
    },
    {
      reason: "Response Time",
      insight: "Quotes sent after 4 hours have a 68% lower win rate. 8 recent losses had response times over 6 hours.",
      actionLabel: "View Delayed Quotes",
      actionRoute: "/bookings/pipeline?filter=slow-response",
      percentage: 28
    },
    {
      reason: "Capacity Concerns",
      insight: "3 customers cited vehicle availability issues in the past 14 days, representing R 156K in lost revenue.",
      actionLabel: "Review Fleet Utilization",
      actionRoute: "/fleet/scenarios",
      percentage: 18
    }
  ];

  const winningFactors: AnalysisFactor[] = [
    {
      reason: "Speed",
      insight: "You win 85% of deals with Makana Foods when you quote within 2 hours. Your average response time for them is 1.5 hours.",
      actionLabel: "View Makana Foods Quotes",
      actionRoute: "/bookings/pipeline?customer=Makana",
      percentage: 38
    },
    {
      reason: "Relationship Strength",
      insight: "Repeat customers have a 92% acceptance rate vs. 54% for new prospects. Tiger Brands accounts for 18% of wins.",
      actionLabel: "View Top Customers",
      actionRoute: "/bookings/pipeline?filter=repeat",
      percentage: 34
    },
    {
      reason: "Competitive Pricing",
      insight: "On JHB-DBN lane, your pricing is 8% below market average while maintaining 22% margin. This drives 67% win rate.",
      actionLabel: "Analyze JHB-DBN Lane",
      actionRoute: "/bookings/pipeline?lane=JHB-DBN&status=won",
      percentage: 28
    }
  ];

  const factors = activeTab === "losing" ? losingFactors : winningFactors;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-body-large">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Diagnostics: Why You're Winning & Losing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "winning" | "losing")}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="losing" className="gap-2">
              <TrendingDown className="h-4 w-4" />
              Losing Factors
            </TabsTrigger>
            <TabsTrigger value="winning" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Winning Factors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="losing" className="space-y-4 mt-0">
            {losingFactors.map((factor, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 hover:shadow-md transition-smooth"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-body font-body-medium text-foreground">
                        Primary Reason: {factor.reason}
                      </h4>
                      {factor.percentage && (
                        <span className="text-caption text-muted-foreground">
                          ({factor.percentage}% of losses)
                        </span>
                      )}
                    </div>
                    <p className="text-body text-muted-foreground leading-relaxed">
                      {factor.insight}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate(factor.actionRoute)}
                >
                  {factor.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="winning" className="space-y-4 mt-0">
            {winningFactors.map((factor, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 hover:shadow-md transition-smooth"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-body font-body-medium text-foreground">
                        Primary Reason: {factor.reason}
                      </h4>
                      {factor.percentage && (
                        <span className="text-caption text-muted-foreground">
                          ({factor.percentage}% of wins)
                        </span>
                      )}
                    </div>
                    <p className="text-body text-muted-foreground leading-relaxed">
                      {factor.insight}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate(factor.actionRoute)}
                >
                  {factor.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
