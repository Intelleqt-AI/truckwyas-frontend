import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ComposedChart, Line, Cell, Tooltip } from 'recharts';

interface LaneDrilldownProps {
  laneId: string;
  laneName: string;
}

const LaneDrilldown: React.FC<LaneDrilldownProps> = ({ laneId, laneName }) => {
  // Mock data based on lane
  const mockData = {
    totalTrips: 124,
    avgRevenue: 16530,
    avgMargin: 35.1,
    topCustomer: 'Makana Foods',
    waterfallData: [
      { name: 'Avg Revenue', value: 16530, color: 'hsl(var(--success-500))', cumulative: 16530 },
      { name: 'Fuel Cost', value: -5520, color: 'hsl(var(--danger-500))', cumulative: 11010 },
      { name: 'Tolls', value: -1850, color: 'hsl(var(--danger-500))', cumulative: 9160 },
      { name: 'Driver Pay', value: -3390, color: 'hsl(var(--danger-500))', cumulative: 5770 },
      { name: 'Maintenance', value: -960, color: 'hsl(var(--danger-500))', cumulative: 4810 },
      { name: 'Net Profit', value: 5770, color: 'hsl(var(--success-500))', cumulative: 5770 }
    ],
    monthlyTrends: [
      { month: 'Jan', trips: 98, revenue: 1620000, margin: 32.1 },
      { month: 'Feb', trips: 112, revenue: 1851200, margin: 34.8 },
      { month: 'Mar', trips: 124, revenue: 2049720, margin: 35.1 }
    ],
    customerMix: [
      { name: 'Makana Foods', value: 60, color: 'hsl(var(--primary))' },
      { name: 'Kudu Steel', value: 25, color: 'hsl(var(--secondary))' },
      { name: 'Others', value: 15, color: 'hsl(var(--muted))' }
    ]
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-heading text-muted-foreground mb-2">{laneName} - Profitability breakdown</h3>
        <p className="text-caption text-muted-foreground">Detailed lane economics and customer analysis</p>
      </div>
      
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="text-body-medium font-body-medium text-foreground text-tabular">
            {mockData.totalTrips}
          </div>
          <div className="text-caption text-muted-foreground">Total trips</div>
        </div>
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="text-body-medium font-body-medium text-foreground text-tabular">
            {formatPercentage(mockData.avgMargin / 100)}
          </div>
          <div className="text-caption text-muted-foreground">Average margin</div>
        </div>
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="text-body-medium font-body-medium text-foreground text-tabular">
            {formatCurrency(mockData.avgRevenue)}
          </div>
          <div className="text-caption text-muted-foreground">Average revenue</div>
        </div>
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="text-body-medium font-body-medium text-foreground text-tabular">
            {mockData.topCustomer}
          </div>
          <div className="text-caption text-muted-foreground">Top customer</div>
        </div>
      </div>

      {/* Profitability Waterfall */}
      <Card className="bg-muted/10 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-heading text-muted-foreground">Profitability waterfall (per trip)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockData.waterfallData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="name" 
                  fontSize={9} 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  fontSize={10}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  formatter={(value) => [formatCurrency(value as number), 'Amount']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="value">
                  {mockData.waterfallData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Performance */}
      <Card className="bg-muted/10 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-heading text-muted-foreground">3-month performance trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={mockData.monthlyTrends}>
                <XAxis dataKey="month" fontSize={10} />
                <YAxis yAxisId="trips" orientation="left" fontSize={10} />
                <YAxis yAxisId="margin" orientation="right" fontSize={10} />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'trips' ? `${value} trips` : 
                    name === 'revenue' ? formatCurrency(value as number) : 
                    `${value}%`,
                    name
                  ]}
                />
                <Bar 
                  yAxisId="trips"
                  dataKey="trips" 
                  fill="hsl(var(--primary))" 
                  opacity={0.7}
                />
                <Line 
                  yAxisId="margin"
                  type="monotone" 
                  dataKey="margin" 
                  stroke="hsl(var(--success-500))" 
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Customer Revenue Mix */}
      <div className="space-y-2">
        <h4 className="text-heading text-muted-foreground">Customer revenue mix</h4>
        <div className="space-y-2">
          {mockData.customerMix.map((customer, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: customer.color }}
                />
                <span className="text-body font-body-medium text-foreground">{customer.name}</span>
              </div>
              <span className="text-body-medium font-body-medium text-muted-foreground text-tabular">
                {customer.value}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Route Optimization Insights */}
      <div className="space-y-2">
        <h4 className="text-heading text-muted-foreground">Route insights</h4>
        <div className="space-y-2">
          <div className="p-3 bg-success/5 border border-success/20 rounded-lg">
            <div className="text-body font-body-medium text-success">Optimal timing</div>
            <div className="text-caption text-muted-foreground">
              Peak efficiency achieved with Tuesday-Thursday departures
            </div>
          </div>
          <div className="p-3 bg-warning/5 border border-warning/20 rounded-lg">
            <div className="text-body font-body-medium text-warning">Fuel cost opportunity</div>
            <div className="text-caption text-muted-foreground">
              Alternative fuel stops could save R340 per trip
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaneDrilldown;