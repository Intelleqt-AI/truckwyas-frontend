import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown, Target } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface EmptyKmData {
  date: string;
  emptyKm: number;
  totalKm: number;
  percentage: number;
  baseline: number;
}

interface EmptyKmTrendChartProps {
  data?: EmptyKmData[];
  days?: number;
  className?: string;
}

export function EmptyKmTrendChart({ data, days = 30, className }: EmptyKmTrendChartProps) {
  // Generate mock trend data showing improvement over time
  const generateEmptyKmData = (): EmptyKmData[] => {
    const result: EmptyKmData[] = [];
    const baseline = 32.5; // Industry baseline percentage
    
    for (let i = days - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'MMM dd');
      
      // Simulate improvement trend with some noise
      const progress = (days - i) / days;
      const improvement = 8.5 * progress; // Max 8.5% improvement
      const noise = (Math.random() - 0.5) * 2; // ±1% random variation
      
      const percentage = Math.max(15, baseline - improvement + noise);
      const totalKm = Math.random() * 5000 + 15000; // 15-20k km per day
      const emptyKm = (percentage / 100) * totalKm;
      
      result.push({
        date,
        emptyKm: Math.round(emptyKm),
        totalKm: Math.round(totalKm),
        percentage: Math.round(percentage * 10) / 10,
        baseline
      });
    }
    
    return result;
  };

  const chartData = data || generateEmptyKmData();
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-modal">
          <p className="text-body-medium font-body-medium text-popover-foreground mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-caption text-muted-foreground">
              Empty KM: {data?.emptyKm.toLocaleString()} km
            </p>
            <p className="text-caption text-muted-foreground">
              Total KM: {data?.totalKm.toLocaleString()} km
            </p>
            <p className="text-caption text-brand-500 font-body-medium">
              Empty Rate: {data?.percentage}%
            </p>
            <p className="text-caption text-warning">
              Baseline: {data?.baseline}%
            </p>
            <p className={`text-caption font-body-medium ${
              data?.percentage < data?.baseline ? 'text-success' : 'text-destructive'
            }`}>
              vs Baseline: {data?.percentage < data?.baseline ? '-' : '+'}
              {Math.abs(data?.percentage - data?.baseline).toFixed(1)}pp
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const currentPercentage = chartData[chartData.length - 1]?.percentage || 0;
  const baseline = chartData[0]?.baseline || 32.5;
  const improvement = baseline - currentPercentage;
  const avgEmptyKm = chartData.reduce((sum, item) => sum + item.emptyKm, 0) / chartData.length;
  const totalKmSaved = chartData.reduce((sum, item) => sum + (item.totalKm * (baseline - item.percentage) / 100), 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground">
          Empty kilometres trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                tickFormatter={(value) => `${value}%`}
                domain={['dataMin - 2', 'dataMax + 2']}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Baseline reference line */}
              <ReferenceLine 
                y={baseline} 
                stroke="hsl(var(--warning))" 
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{
                  value: "Industry Baseline",
                  position: "insideTopRight",
                  style: { 
                    fontSize: 11, 
                    fill: 'hsl(var(--warning))' 
                  }
                }}
              />
              
              {/* Actual trend line */}
              <Line 
                type="monotone"
                dataKey="percentage"
                stroke="hsl(var(--brand-500))"
                strokeWidth={3}
                dot={{ 
                  fill: "hsl(var(--brand-500))", 
                  strokeWidth: 0,
                  r: 4
                }}
                activeDot={{ 
                  r: 6, 
                  fill: "hsl(var(--brand-500))",
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2
                }}
                name="Empty KM %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-success-light/20 rounded-lg">
            <div className="text-body-medium font-body-medium text-success flex items-center justify-center gap-1">
              <Target className="w-4 h-4" />
              {currentPercentage.toFixed(1)}%
            </div>
            <div className="text-caption text-muted-foreground">Current Rate</div>
          </div>
          
          <div className="text-center p-3 bg-brand-100/50 rounded-lg">
            <div className="text-body-medium font-body-medium text-success">
              -{improvement.toFixed(1)}pp
            </div>
            <div className="text-caption text-muted-foreground">vs Baseline</div>
          </div>
          
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-body-medium font-body-medium text-foreground">
              {avgEmptyKm.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-caption text-muted-foreground">Avg Daily Empty KM</div>
          </div>
          
          <div className="text-center p-3 bg-success-light/20 rounded-lg">
            <div className="text-body-medium font-body-medium text-success">
              {totalKmSaved.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-caption text-muted-foreground">Total KM Saved</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}