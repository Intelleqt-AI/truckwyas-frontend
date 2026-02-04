import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subDays } from 'date-fns';
import { formatCurrency } from "@/lib/formatters";

interface HeatmapDay {
  date: string;
  net: number;
}

export function CashflowHeatmap() {
  // Generate 90 days of cashflow data
  const generateHeatmapData = (): HeatmapDay[] => {
    const result: HeatmapDay[] = [];
    for (let i = 89; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      // Simulate net flow with some seasonality and randomness
      const dayOfWeek = subDays(new Date(), i).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      const net = isWeekend
        ? (Math.random() - 0.6) * 15000 // Weekends usually negative
        : (Math.random() - 0.3) * 25000; // Weekdays more positive
      
      result.push({ date, net: Math.round(net) });
    }
    return result;
  };

  const data = generateHeatmapData();

  const getColor = (value: number) => {
    if (value > 10000) return 'bg-success/80 hover:bg-success';
    if (value > 5000) return 'bg-success/50 hover:bg-success/70';
    if (value > 0) return 'bg-success/20 hover:bg-success/40';
    if (value > -5000) return 'bg-destructive/20 hover:bg-destructive/40';
    if (value > -10000) return 'bg-destructive/50 hover:bg-destructive/70';
    return 'bg-destructive/80 hover:bg-destructive';
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-body font-body-medium text-foreground">90-Day Cashflow Pattern</CardTitle>
            <p className="text-caption text-muted-foreground mt-0.5">
              Liquidity cycles and seasonal trends
            </p>
          </div>
          {/* Compact Legend */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-success/80" />
              <span className="text-xs text-muted-foreground">High</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-success/20" />
              <span className="text-xs text-muted-foreground">Positive</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-destructive/20" />
              <span className="text-xs text-muted-foreground">Negative</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-destructive/80" />
              <span className="text-xs text-muted-foreground">Low</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="w-full">
          {/* 3 rows of 30 days each across full width */}
          <div className="grid grid-cols-30 gap-1 w-full">
            {data.map((day, idx) => (
              <div
                key={idx}
                className={`aspect-square rounded-[2px] transition-all cursor-pointer group relative ${getColor(day.net)}`}
                title={`${format(new Date(day.date), 'MMM dd')}: ${formatCurrency(day.net)}`}
              >
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="bg-popover border border-border rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap shadow-lg -translate-y-8">
                    <div className="font-medium">{format(new Date(day.date), 'MMM dd')}</div>
                    <div className={day.net >= 0 ? 'text-success' : 'text-destructive'}>
                      {formatCurrency(day.net)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
