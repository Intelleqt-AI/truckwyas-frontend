import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface CashFlowData {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;
}

interface CashCalendarChartProps {
  data?: CashFlowData[];
  days?: number;
  className?: string;
}

export function CashCalendarChart({ data, days = 30, className }: CashCalendarChartProps) {
  // Generate mock 30-day forecast data
  const generateCashData = (): CashFlowData[] => {
    const result: CashFlowData[] = [];
    let cumulative = 125000; // Starting cash balance
    
    for (let i = 0; i < days; i++) {
      const date = format(addDays(new Date(), i), 'MMM dd');
      
      // Mock inflow patterns (higher on weekdays, invoices paid)
      const isWeekend = (i + new Date().getDay()) % 7 === 0 || (i + new Date().getDay()) % 7 === 6;
      const inflow = isWeekend ? 
        Math.random() * 8000 + 2000 : // Weekend: 2-10k
        Math.random() * 25000 + 15000; // Weekday: 15-40k
      
      // Mock outflow patterns (fuel, salaries, maintenance)
      const outflow = Math.random() * 18000 + 12000; // 12-30k daily
      
      const net = inflow - outflow;
      cumulative += net;
      
      result.push({
        date,
        inflow: Math.round(inflow),
        outflow: Math.round(outflow),
        net: Math.round(net),
        cumulative: Math.round(cumulative)
      });
    }
    
    return result;
  };

  const chartData = data || generateCashData();
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-modal">
          <p className="text-body-medium font-body-medium text-popover-foreground mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-caption text-success flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Inflow: {formatCurrency(data?.inflow)}
            </p>
            <p className="text-caption text-destructive flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              Outflow: {formatCurrency(data?.outflow)}
            </p>
            <p className={`text-caption font-body-medium ${data?.net >= 0 ? 'text-success' : 'text-destructive'}`}>
              Net: {formatCurrency(data?.net)}
            </p>
            <p className="text-caption text-brand-500 font-body-medium border-t border-border pt-1">
              Balance: {formatCurrency(data?.cumulative)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const totalInflow = chartData.reduce((sum, item) => sum + item.inflow, 0);
  const totalOutflow = chartData.reduce((sum, item) => sum + item.outflow, 0);
  const netFlow = totalInflow - totalOutflow;
  const endingBalance = chartData[chartData.length - 1]?.cumulative || 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-muted-foreground">
          30-Day Cash Flow Forecast
        </CardTitle>
        <p className="text-caption text-muted-foreground">
          AI-based forecast adjusted daily based on invoice collections, expense timing, and seasonal trends
        </p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="h-64 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))"
                opacity={0.3}
              />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Shaded region for projected future (from today onwards) */}
              <defs>
                <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--brand-500))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--brand-500))" stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--brand-300))" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(var(--brand-300))" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              
              <Area 
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(var(--brand-500))"
                strokeWidth={2}
                strokeDasharray="3 3"
                fill="url(#projectedGradient)"
                name="Projected Balance"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
          <div className="text-center p-2.5 bg-success/10 rounded-lg border border-success/20">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-success" />
              <div className="text-body font-body-medium text-success">
                {formatCurrency(totalInflow)}
              </div>
            </div>
            <div className="text-caption text-muted-foreground">Total Inflow</div>
          </div>
          
          <div className="text-center p-2.5 bg-destructive/10 rounded-lg border border-destructive/20">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-destructive" />
              <div className="text-body font-body-medium text-destructive">
                {formatCurrency(totalOutflow)}
              </div>
            </div>
            <div className="text-caption text-muted-foreground">Total Outflow</div>
          </div>
          
          <div className={`text-center p-2.5 rounded-lg border ${
            netFlow >= 0 
              ? 'bg-success/10 border-success/20' 
              : 'bg-destructive/10 border-destructive/20'
          }`}>
            <div className={`text-body font-body-medium mb-1 ${
              netFlow >= 0 ? 'text-success' : 'text-destructive'
            }`}>
              {formatCurrency(netFlow)}
            </div>
            <div className="text-caption text-muted-foreground">Net Flow</div>
          </div>
          
          <div className="text-center p-2.5 bg-brand-500/10 rounded-lg border border-brand-500/20">
            <div className="text-body font-body-medium text-brand-500 mb-1">
              {formatCurrency(endingBalance)}
            </div>
            <div className="text-caption text-muted-foreground">Ending Balance</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}