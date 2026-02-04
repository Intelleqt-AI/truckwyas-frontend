import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Dot } from "recharts";
import { Target, TrendingUp } from "lucide-react";

const winCurveData = [
  { margin: 8, winRate: 95, revenue: 3800 },
  { margin: 10, winRate: 88, revenue: 4400 },
  { margin: 12, winRate: 78, revenue: 4680 },
  { margin: 14, winRate: 65, revenue: 4550 },
  { margin: 16, winRate: 52, revenue: 4160 },
  { margin: 18, winRate: 38, revenue: 3420 },
  { margin: 20, winRate: 25, revenue: 2500 },
  { margin: 22, winRate: 15, revenue: 1650 },
  { margin: 24, winRate: 8, revenue: 960 },
];

export function WinCurve() {
  const optimalPoint = winCurveData.reduce((max, current) => 
    current.revenue > max.revenue ? current : max
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-caption text-muted-foreground flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          Win rate vs margin analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={winCurveData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="margin" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                label={{ value: 'Margin %', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fontSize: 12, fill: 'hsl(var(--muted-foreground))' } }}
              />
              <YAxis 
                yAxisId="winRate"
                orientation="left"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                label={{ value: 'Win Rate %', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 12, fill: 'hsl(var(--muted-foreground))' } }}
              />
              <YAxis 
                yAxisId="revenue"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                hide
              />
              
              {/* Win Rate Line */}
              <Line
                yAxisId="winRate"
                type="monotone"
                dataKey="winRate"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
              />
              
              {/* Revenue Line */}
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--success))" }}
              />

              {/* Optimal Point Marker */}
              <Line
                yAxisId="winRate"
                type="monotone"
                dataKey={(entry) => entry.margin === optimalPoint.margin ? entry.winRate : null}
                stroke="hsl(var(--warning))"
                strokeWidth={0}
                dot={(props) => {
                  if (props.payload.margin === optimalPoint.margin) {
                    return <Dot {...props} r={6} fill="hsl(var(--warning))" stroke="hsl(var(--background))" strokeWidth={2} />;
                  }
                  return null;
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend & Insights */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-caption">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-primary" />
                <span className="text-muted-foreground">Win Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-success border-dashed" style={{ borderTop: '1px dashed' }} />
                <span className="text-muted-foreground">Expected Revenue</span>
              </div>
            </div>
          </div>
          
          <div className="p-3 bg-warning/5 rounded-lg border border-warning/20">
            <div className="flex items-center gap-2 text-warning mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-caption font-body-medium">Optimal Margin Point</span>
            </div>
            <p className="text-caption text-muted-foreground">
              {optimalPoint.margin}% margin yields {optimalPoint.winRate}% win rate with maximum expected revenue
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}