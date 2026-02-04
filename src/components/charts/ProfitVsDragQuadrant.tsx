import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine, Label, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import { useState } from 'react';
import { Star, TrendingUp, Gem, AlertTriangle } from 'lucide-react';

export interface VehiclePerformanceData {
  id: string;
  name: string;
  revenue: number;
  margin: number;
}

interface ProfitVsDragQuadrantProps {
  data: VehiclePerformanceData[];
  avgRevenue: number;
  avgMargin: number;
  viewType?: 'vehicles' | 'drivers';
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-background border-2 border-brand-500 rounded-xl p-4 shadow-lg">
        <p className="font-semibold text-sm mb-3 text-foreground">{data.id}: {data.name}</p>
        <div className="space-y-2">
          <div className="flex justify-between gap-4">
            <span className="text-xs text-muted-foreground">Revenue:</span>
            <span className="text-xs font-semibold text-foreground">{formatCurrency(data.revenue, { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-xs text-muted-foreground">Net Margin:</span>
            <span className="text-xs font-semibold text-success-500">{formatPercentage(data.margin)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function ProfitVsDragQuadrant({ data, avgRevenue, avgMargin, viewType = 'vehicles' }: ProfitVsDragQuadrantProps) {
  const navigate = useNavigate();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleDotClick = (data: VehiclePerformanceData) => {
    navigate(`/fleet/vehicles/${data.id}`);
  };

  // Calculate chart boundaries with padding
  const maxRevenue = Math.max(...data.map(d => d.revenue)) * 1.1;
  const maxMargin = Math.max(...data.map(d => d.margin)) * 1.1;

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h3 className="text-body-large font-body-medium text-foreground">Profit vs. Drag Quadrant</h3>
        <p className="text-caption text-muted-foreground mt-0.5">
          Fleet performance by revenue generation and net margin (Last 90 Days)
        </p>
      </div>
      
      <ResponsiveContainer width="100%" height={480}>
        <ScatterChart margin={{ top: 20, right: 60, bottom: 60, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--grid-line))" opacity={0.5} />
          
          {/* Quadrant backgrounds */}
          <ReferenceArea
            x1={avgRevenue}
            x2={maxRevenue}
            y1={avgMargin}
            y2={maxMargin}
            fill="hsl(142 76% 36% / 0.1)"
            strokeOpacity={0}
          />
          <ReferenceArea
            x1={avgRevenue}
            x2={maxRevenue}
            y1={0}
            y2={avgMargin}
            fill="hsl(221 83% 53% / 0.1)"
            strokeOpacity={0}
          />
          <ReferenceArea
            x1={0}
            x2={avgRevenue}
            y1={avgMargin}
            y2={maxMargin}
            fill="hsl(262 52% 47% / 0.1)"
            strokeOpacity={0}
          />
          <ReferenceArea
            x1={0}
            x2={avgRevenue}
            y1={0}
            y2={avgMargin}
            fill="hsl(0 84% 60% / 0.1)"
            strokeOpacity={0}
          />

          {/* Dividing lines */}
          <ReferenceLine
            x={avgRevenue}
            stroke="hsl(var(--border))"
            strokeDasharray="5 5"
            strokeWidth={2}
          />
          <ReferenceLine
            y={avgMargin}
            stroke="hsl(var(--border))"
            strokeDasharray="5 5"
            strokeWidth={2}
          />

          <XAxis
            type="number"
            dataKey="revenue"
            name="Revenue"
            domain={[0, maxRevenue]}
            tickFormatter={(value) => formatCurrency(value / 1000, { maximumFractionDigits: 0 }) + 'k'}
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          >
            <Label
              value="Revenue Generated (Last 90 Days)"
              position="bottom"
              offset={40}
              style={{ fill: 'hsl(var(--foreground))', fontSize: '14px', fontWeight: 500 }}
            />
          </XAxis>
          
          <YAxis
            type="number"
            dataKey="margin"
            name="Margin"
            domain={[0, maxMargin]}
            tickFormatter={(value) => formatPercentage(value, 0)}
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          >
            <Label
              value="Net Margin %"
              angle={-90}
              position="left"
              offset={40}
              style={{ fill: 'hsl(var(--foreground))', fontSize: '14px', fontWeight: 500 }}
            />
          </YAxis>

          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />

          <Scatter
            data={data}
            fill="hsl(var(--brand-500))"
            onMouseEnter={(_, index) => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill="hsl(var(--brand-500))"
                opacity={hoveredIndex === index ? 1 : 0.8}
                r={hoveredIndex === index ? 12 : 8}
                cursor="pointer"
                onClick={() => handleDotClick(entry)}
                stroke={hoveredIndex === index ? "hsl(var(--brand-300))" : "hsl(var(--brand-700))"}
                strokeWidth={hoveredIndex === index ? 4 : 1}
              />
            ))}
          </Scatter>

          {/* Quadrant labels - positioned inside each quadrant */}
          <text
            x="75%"
            y="20%"
            textAnchor="middle"
            style={{ 
              fill: 'hsl(var(--success-500))',
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '0.3px',
              opacity: 0.9
            }}
          >
            Stars
          </text>
          <text
            x="75%"
            y="80%"
            textAnchor="middle"
            style={{ 
              fill: 'hsl(var(--brand-500))',
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '0.3px',
              opacity: 0.9
            }}
          >
            Workhorses
          </text>
          <text
            x="25%"
            y="20%"
            textAnchor="middle"
            style={{ 
              fill: 'hsl(262 52% 47%)',
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '0.3px',
              opacity: 0.9
            }}
          >
            Niche Profit
          </text>
          <text
            x="25%"
            y="80%"
            textAnchor="middle"
            style={{ 
              fill: 'hsl(var(--danger-500))',
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '0.3px',
              opacity: 0.9
            }}
          >
            Financial Drag
          </text>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend with icons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-success-500/10 flex items-center justify-center">
            <Star className="w-3.5 h-3.5 text-success-500" />
          </div>
          <div>
            <div className="text-xs font-body-medium text-foreground">Stars</div>
            <div className="text-[10px] text-muted-foreground">High revenue, high margin</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-500/10 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-brand-500" />
          </div>
          <div>
            <div className="text-xs font-body-medium text-foreground">Workhorses</div>
            <div className="text-[10px] text-muted-foreground">High revenue, lower margin</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(262 52% 47% / 0.1)' }}>
            <Gem className="w-3.5 h-3.5" style={{ color: 'hsl(262 52% 47%)' }} />
          </div>
          <div>
            <div className="text-xs font-body-medium text-foreground">Niche Profit</div>
            <div className="text-[10px] text-muted-foreground">Lower revenue, high margin</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-danger-500/10 flex items-center justify-center">
            <AlertTriangle className="w-3.5 h-3.5 text-danger-500" />
          </div>
          <div>
            <div className="text-xs font-body-medium text-foreground">Financial Drag</div>
            <div className="text-[10px] text-muted-foreground">Lower revenue, lower margin</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
