import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Sankey, Tooltip } from 'recharts';

interface CustomerDrilldownProps {
  customerId: string;
  customerName: string;
}

const CustomerDrilldown: React.FC<CustomerDrilldownProps> = ({ customerId, customerName }) => {
  // Mock data based on customer
  const mockData = {
    makana: {
      totalRevenue: 1650000,
      netMargin: 18.2,
      avgDso: 32,
      topLane: 'JHB-CPT',
      sankeyData: {
        nodes: [
          { name: 'Revenue' },
          { name: 'JHB-CPT' },
          { name: 'DBN-JHB' },
          { name: 'Fuel' },
          { name: 'Tolls' },
          { name: 'Driver Pay' },
          { name: 'Maintenance' },
          { name: 'Net Profit' }
        ],
        links: [
          { source: 0, target: 1, value: 1200000 },
          { source: 0, target: 2, value: 450000 },
          { source: 1, target: 3, value: 400000 },
          { source: 1, target: 4, value: 120000 },
          { source: 1, target: 5, value: 280000 },
          { source: 2, target: 3, value: 150000 },
          { source: 2, target: 4, value: 45000 },
          { source: 2, target: 5, value: 105000 },
          { source: 1, target: 6, value: 85000 },
          { source: 2, target: 6, value: 35000 },
          { source: 1, target: 7, value: 315000 },
          { source: 2, target: 7, value: 115000 }
        ]
      },
      trendData: [
        { month: 'Jan', revenue: 1200000, margin: 16.5 },
        { month: 'Feb', revenue: 1350000, margin: 17.8 },
        { month: 'Mar', revenue: 1650000, margin: 18.2 }
      ]
    }
  };

  const customerData = mockData.makana; // Default to Makana for demo

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-heading text-muted-foreground mb-2">{customerName} - Financial deep dive</h3>
        <p className="text-caption text-muted-foreground">Revenue flows and cost analysis</p>
      </div>
      
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="text-body-medium font-body-medium text-foreground text-tabular">
            {formatCurrency(customerData.totalRevenue)}
          </div>
          <div className="text-caption text-muted-foreground">Total revenue</div>
        </div>
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="text-body-medium font-body-medium text-foreground text-tabular">
            {formatPercentage(customerData.netMargin / 100)}
          </div>
          <div className="text-caption text-muted-foreground">Net margin</div>
        </div>
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="text-body-medium font-body-medium text-foreground text-tabular">
            {customerData.avgDso} days
          </div>
          <div className="text-caption text-muted-foreground">Avg DSO</div>
        </div>
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="text-body-medium font-body-medium text-foreground text-tabular">
            {customerData.topLane}
          </div>
          <div className="text-caption text-muted-foreground">Top lane</div>
        </div>
      </div>

      {/* Revenue Flow Visualization */}
      <Card className="bg-muted/10 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-heading text-muted-foreground">Revenue flow breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={customerData.trendData}>
                <XAxis dataKey="month" fontSize={10} />
                <YAxis yAxisId="revenue" orientation="left" fontSize={10} />
                <YAxis yAxisId="margin" orientation="right" fontSize={10} />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'revenue' ? formatCurrency(value as number) : `${value}%`,
                    name === 'revenue' ? 'Revenue' : 'Margin %'
                  ]}
                />
                <Bar 
                  yAxisId="revenue" 
                  dataKey="revenue" 
                  fill="hsl(var(--primary))" 
                  opacity={0.7}
                />
                <Line 
                  yAxisId="margin" 
                  type="monotone" 
                  dataKey="margin" 
                  stroke="hsl(var(--success-500))" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <div className="space-y-2">
        <h4 className="text-heading text-muted-foreground">Cost breakdown by category</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-danger/5 rounded-lg">
            <span className="text-body font-body-medium text-foreground">Fuel costs</span>
            <span className="text-body-medium font-body-medium text-danger text-tabular">
              {formatCurrency(550000)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-warning/5 rounded-lg">
            <span className="text-body font-body-medium text-foreground">Driver pay</span>
            <span className="text-body-medium font-body-medium text-warning text-tabular">
              {formatCurrency(385000)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
            <span className="text-body font-body-medium text-foreground">Tolls & fees</span>
            <span className="text-body-medium font-body-medium text-muted-foreground text-tabular">
              {formatCurrency(165000)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
            <span className="text-body font-body-medium text-foreground">Maintenance</span>
            <span className="text-body-medium font-body-medium text-muted-foreground text-tabular">
              {formatCurrency(120000)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDrilldown;