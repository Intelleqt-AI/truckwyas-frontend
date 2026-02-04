import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface MarginData {
  lane: string;
  revenue: number;
  costs: number;
  margin: number;
  marginPercent: number;
}

interface MarginByLaneChartProps {
  data?: MarginData[];
  className?: string;
}

export function MarginByLaneChart({ data, className }: MarginByLaneChartProps) {
  const defaultData: MarginData[] = [
    { lane: 'JHB-CT', revenue: 48500, costs: 38200, margin: 10300, marginPercent: 21.2 },
    { lane: 'CT-DBN', revenue: 42800, costs: 35600, margin: 7200, marginPercent: 16.8 },
    { lane: 'DBN-PE', revenue: 28900, costs: 24100, margin: 4800, marginPercent: 16.6 },
    { lane: 'JHB-DBN', revenue: 35400, costs: 29800, margin: 5600, marginPercent: 15.8 },
    { lane: 'CT-PE', revenue: 31200, costs: 26800, margin: 4400, marginPercent: 14.1 },
    { lane: 'JHB-EL', revenue: 22600, costs: 19800, margin: 2800, marginPercent: 12.4 },
    { lane: 'DBN-BFN', revenue: 26800, costs: 24200, margin: 2600, marginPercent: 9.7 },
    { lane: 'CT-UP', revenue: 19400, costs: 17800, margin: 1600, marginPercent: 8.2 },
    { lane: 'PE-EL', revenue: 18200, costs: 16900, margin: 1300, marginPercent: 7.1 },
    { lane: 'JHB-RUS', revenue: 15800, costs: 14900, margin: 900, marginPercent: 5.7 }
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
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-modal">
          <p className="text-body-medium font-body-medium text-popover-foreground mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-caption text-success">
              Revenue: {formatCurrency(payload[0]?.payload?.revenue)}
            </p>
            <p className="text-caption text-muted-foreground">
              Costs: {formatCurrency(payload[0]?.payload?.costs)}
            </p>
            <p className="text-caption text-brand-500 font-body-medium">
              Margin: {formatCurrency(payload[0]?.value)} ({payload[0]?.payload?.marginPercent.toFixed(1)}%)
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-[420px] flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-muted-foreground">
          Margin by lane - top 10
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))"
                opacity={0.3}
              />
              <XAxis 
                dataKey="lane" 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="costs" 
                stackId="lane"
                fill="hsl(var(--muted))"
                name="Costs"
                radius={[0, 0, 4, 4]}
              />
              <Bar 
                dataKey="margin" 
                stackId="lane"
                fill="hsl(var(--success))"
                name="Margin"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border flex-shrink-0">
          <div className="text-center">
            <div className="text-body-medium font-body-medium text-foreground">
              {formatCurrency(chartData.reduce((sum, item) => sum + item.revenue, 0))}
            </div>
            <div className="text-caption text-muted-foreground">Total Revenue</div>
          </div>
          <div className="text-center">
            <div className="text-body-medium font-body-medium text-success">
              {formatCurrency(chartData.reduce((sum, item) => sum + item.margin, 0))}
            </div>
            <div className="text-caption text-muted-foreground">Total Margin</div>
          </div>
          <div className="text-center">
            <div className="text-body-medium font-body-medium text-brand-500">
              {((chartData.reduce((sum, item) => sum + item.margin, 0) / 
                 chartData.reduce((sum, item) => sum + item.revenue, 0)) * 100).toFixed(1)}%
            </div>
            <div className="text-caption text-muted-foreground">Avg Margin</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}