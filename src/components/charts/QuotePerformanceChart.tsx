import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Award } from 'lucide-react';

interface QuoteData {
  month: string;
  quoted: number;
  accepted: number;
  margin: number;
}

interface QuotePerformanceChartProps {
  data?: QuoteData[];
  className?: string;
}

export function QuotePerformanceChart({ data, className }: QuotePerformanceChartProps) {
  const defaultData: QuoteData[] = [
    { month: 'Jan', quoted: 2840000, accepted: 2100000, margin: 12.4 },
    { month: 'Feb', quoted: 3200000, accepted: 2450000, margin: 14.1 },
    { month: 'Mar', quoted: 2950000, accepted: 2200000, margin: 13.7 },
    { month: 'Apr', quoted: 3400000, accepted: 2680000, margin: 15.2 },
    { month: 'May', quoted: 3100000, accepted: 2380000, margin: 13.9 },
    { month: 'Jun', quoted: 3650000, accepted: 2920000, margin: 16.3 },
  ];

  const chartData = data || defaultData;
  
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
            <p className="text-caption text-brand-500">
              Quoted: {formatCurrency(data?.quoted)}
            </p>
            <p className="text-caption text-success">
              Accepted: {formatCurrency(data?.accepted)}
            </p>
            <p className="text-caption text-foreground font-body-medium">
              Margin: {data?.margin.toFixed(1)}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const totalQuoted = chartData.reduce((sum, item) => sum + item.quoted, 0);
  const totalAccepted = chartData.reduce((sum, item) => sum + item.accepted, 0);
  const avgMargin = chartData.reduce((sum, item) => sum + item.margin, 0) / chartData.length;

  return (
    <Card className="h-[420px] flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-muted-foreground">
          Quote performance trends
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="h-64 mb-4 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))"
                opacity={0.3}
              />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(value) => `R${(value / 1000000).toFixed(1)}M`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar 
                dataKey="quoted" 
                fill="hsl(var(--brand-300))" 
                name="Total Quoted"
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="accepted" 
                fill="hsl(var(--brand-500))" 
                name="Accepted"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-auto">
          <div className="text-center p-3 bg-brand-100/20 rounded-lg">
            <div className="text-body-medium font-body-medium text-brand-500">
              {formatCurrency(totalQuoted)}
            </div>
            <div className="text-caption text-muted-foreground">Total Quoted</div>
          </div>
          
          <div className="text-center p-3 bg-success-light/20 rounded-lg">
            <div className="text-body-medium font-body-medium text-success">
              {formatCurrency(totalAccepted)}
            </div>
            <div className="text-caption text-muted-foreground">Total Accepted</div>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-body-medium font-body-medium text-foreground">
              {avgMargin.toFixed(1)}%
            </div>
            <div className="text-caption text-muted-foreground">Avg Margin</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}