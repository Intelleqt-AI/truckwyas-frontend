import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck } from 'lucide-react';

interface UtilizationData {
  name: string;
  value: number;
  color: string;
}

interface FleetUtilizationChartProps {
  data?: UtilizationData[];
  className?: string;
}

export function FleetUtilizationChart({ data, className }: FleetUtilizationChartProps) {
  const defaultData: UtilizationData[] = [
    { name: 'En Route', value: 142, color: 'hsl(var(--success))' },
    { name: 'Idle', value: 8, color: 'hsl(var(--warning))' },
    { name: 'Maintenance', value: 6, color: 'hsl(var(--muted-foreground))' },
  ];

  const chartData = data || defaultData;
  const totalVehicles = chartData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      const percentage = ((data?.value / totalVehicles) * 100).toFixed(1);
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-modal">
          <p className="text-body-medium font-body-medium text-popover-foreground">{data?.name}</p>
          <p className="text-caption text-muted-foreground">
            {data?.value} vehicles ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground">
          Fleet utilization breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {chartData.map((item, index) => {
            const percentage = ((item.value / totalVehicles) * 100).toFixed(1);
            return (
              <div key={index} className="text-center p-3 rounded-lg bg-muted/20">
                <div className="text-body-medium font-body-medium text-foreground">
                  {item.value}
                </div>
                <div className="text-caption text-muted-foreground">
                  {item.name} ({percentage}%)
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}