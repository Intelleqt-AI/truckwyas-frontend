import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Calendar, TrendingUp, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

// Mock data for next 7 days cash flow
const mockCashFlowData = [
  { 
    day: 'Mon', 
    dayFull: 'Monday',
    inflow: 485000, 
    outflow: 320000, 
    predictedEndingBalance: 2450000 
  },
  { 
    day: 'Tue', 
    dayFull: 'Tuesday',
    inflow: 520000, 
    outflow: 380000, 
    predictedEndingBalance: 2590000 
  },
  { 
    day: 'Wed', 
    dayFull: 'Wednesday',
    inflow: 390000, 
    outflow: 290000, 
    predictedEndingBalance: 2690000 
  },
  { 
    day: 'Thu', 
    dayFull: 'Thursday',
    inflow: 580000, 
    outflow: 420000, 
    predictedEndingBalance: 2850000 
  },
  { 
    day: 'Fri', 
    dayFull: 'Friday',
    inflow: 620000, 
    outflow: 480000, 
    predictedEndingBalance: 2990000 
  },
  { 
    day: 'Sat', 
    dayFull: 'Saturday',
    inflow: 280000, 
    outflow: 180000, 
    predictedEndingBalance: 3090000 
  },
  { 
    day: 'Sun', 
    dayFull: 'Sunday',
    inflow: 150000, 
    outflow: 120000, 
    predictedEndingBalance: 3120000 
  }
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-surface border border-border rounded-lg p-3 shadow-lg">
        <p className="text-caption text-muted-foreground mb-2">{data.dayFull}</p>
        <div className="space-y-1">
          <p className="text-caption text-success">
            Inflow: {new Intl.NumberFormat('en-ZA', { 
              style: 'currency', 
              currency: 'ZAR',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(data.inflow)}
          </p>
          <p className="text-caption text-danger">
            Outflow: {new Intl.NumberFormat('en-ZA', { 
              style: 'currency', 
              currency: 'ZAR',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(data.outflow)}
          </p>
          <p className="text-caption text-foreground">
            Balance: {new Intl.NumberFormat('en-ZA', { 
              style: 'currency', 
              currency: 'ZAR',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(data.predictedEndingBalance)}
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function NextSevenDaysForecast() {
  // Calculate totals
  const totalInflow = mockCashFlowData.reduce((sum, day) => sum + day.inflow, 0);
  const totalOutflow = mockCashFlowData.reduce((sum, day) => sum + day.outflow, 0);
  const netFlow = totalInflow - totalOutflow;

  return (
    <Card className="bg-card border border-border shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
        <CardTitle className="text-muted-foreground">
          Next 7 Days Cash Flow
        </CardTitle>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-500" />
            <span className="text-caption text-muted-foreground">Mini Timeline</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          {/* Mini Cash Flow Timeline Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={mockCashFlowData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <XAxis 
                  dataKey="day" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `${(value / 1000)}k`}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Stacked Bars */}
                <Bar
                  yAxisId="left"
                  dataKey="inflow"
                  stackId="cashflow"
                  fill="hsl(var(--success))"
                  opacity={0.8}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="outflow"
                  stackId="outflow"
                  fill="hsl(var(--danger))"
                  opacity={0.8}
                  radius={[2, 2, 0, 0]}
                />
                
                {/* Balance Line */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="predictedEndingBalance"
                  stroke="hsl(var(--brand-500))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--brand-500))', strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 4, fill: 'hsl(var(--brand-500))' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          
          {/* Summary Totals */}
          <div className="grid grid-cols-3 gap-6 pt-4 border-t border-border">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="w-3 h-3 text-success" />
                <span className="text-caption text-muted-foreground">Total Inflow</span>
              </div>
              <div className="text-display-1 font-display-semibold text-success text-tabular">
                {new Intl.NumberFormat('en-ZA', { 
                  style: 'currency', 
                  currency: 'ZAR',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(totalInflow)}
              </div>
              <div className="text-caption text-success">
                7-day total
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-3 h-3 text-danger" />
                <span className="text-caption text-muted-foreground">Total Outflow</span>
              </div>
              <div className="text-display-1 font-display-semibold text-danger text-tabular">
                {new Intl.NumberFormat('en-ZA', { 
                  style: 'currency', 
                  currency: 'ZAR',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(totalOutflow)}
              </div>
              <div className="text-caption text-danger">
                7-day total
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-brand-500" />
                <span className="text-caption text-muted-foreground">Net Flow</span>
              </div>
              <div className={`text-display-1 font-display-semibold text-tabular ${netFlow >= 0 ? 'text-success' : 'text-danger'}`}>
                {new Intl.NumberFormat('en-ZA', { 
                  style: 'currency', 
                  currency: 'ZAR',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(netFlow)}
              </div>
              <div className={`text-caption ${netFlow >= 0 ? 'text-success' : 'text-danger'}`}>
                Expected gain
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}