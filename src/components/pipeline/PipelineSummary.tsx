import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/formatters";

interface PipelineStage {
  name: string;
  count: number;
  value: number;
  color: string;
}

export function PipelineSummary() {
  const navigate = useNavigate();
  
  const pipelineStages: PipelineStage[] = [
    { name: "Draft", count: 3, value: 125400, color: "bg-neutral-600" },
    { name: "Sent", count: 8, value: 342800, color: "bg-brand-500" },
    { name: "Quoted", count: 12, value: 567200, color: "bg-brand-300" },
    { name: "Accepted", count: 5, value: 289500, color: "bg-success-500" },
    { name: "Expired", count: 2, value: 45300, color: "bg-neutral-200" }
  ];

  const totalDeals = pipelineStages.reduce((acc, stage) => acc + stage.count, 0);
  const totalValue = pipelineStages.reduce((acc, stage) => acc + stage.value, 0);

  const handleStageClick = (stageName: string) => {
    navigate('/bookings/pipeline', { state: { filterStage: stageName.toLowerCase() } });
  };

  const handleViewFullPipeline = () => {
    navigate('/bookings/pipeline');
  };

  return (
    <Card className="h-[420px] flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-muted-foreground">
          Live Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <Button 
          onClick={handleViewFullPipeline}
          className="w-full mb-4 bg-brand-500 hover:bg-brand-700 text-white flex-shrink-0"
        >
          View Full Pipeline
        </Button>
        
        <div className="space-y-3 flex-1 overflow-y-auto">
          {pipelineStages.map((stage) => {
          const widthPercent = (stage.count / Math.max(...pipelineStages.map(s => s.count))) * 100;
          
          return (
            <div
              key={stage.name}
              onClick={() => handleStageClick(stage.name)}
              className="relative p-3 rounded-lg bg-muted/20 hover:bg-muted/40 cursor-pointer transition-smooth group"
            >
              {/* Background bar */}
              <div 
                className={`absolute left-0 top-0 bottom-0 ${stage.color} opacity-10 rounded-lg transition-all duration-300 group-hover:opacity-20`}
                style={{ width: `${Math.max(widthPercent, 15)}%` }}
              />
              
              {/* Content */}
              <div className="relative flex justify-between items-center">
                <span className="text-caption text-foreground font-body-medium">
                  {stage.name} ({stage.count})
                </span>
                <div className="text-right">
                  <div className="text-caption font-body-medium text-foreground text-tabular">
                    {formatCurrency(stage.value)}
                  </div>
                </div>
              </div>
            </div>
          );
          })}
          
          {/* Footer totals */}
          <div className="pt-3 mt-4 border-t border-border flex-shrink-0">
            <div className="flex justify-between items-center">
              <span className="text-caption text-muted-foreground font-body-medium">
                Total Pipeline ({totalDeals})
              </span>
              <div className="text-right">
                <div className="text-caption font-body-medium text-foreground text-tabular">
                  {formatCurrency(totalValue)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}