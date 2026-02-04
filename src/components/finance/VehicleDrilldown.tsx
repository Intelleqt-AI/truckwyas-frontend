import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

interface VehicleDrilldownProps {
  vehicleId: string;
  vehicleName: string;
}

const VehicleDrilldown: React.FC<VehicleDrilldownProps> = ({ vehicleId, vehicleName }) => {
  // Mock data based on vehicle
  const mockData = {
    totalMargin: 285000,
    costPerKm: 12.5,
    fuelEfficiency: 28.5,
    uptime: 94.2,
    safetyScore: 88,
    radarData: [
      { subject: 'Margin/KM', vehicle: 85, fleet: 75, fullMark: 100 },
      { subject: 'Fuel Efficiency', vehicle: 90, fleet: 80, fullMark: 100 },
      { subject: 'Reliability', vehicle: 94, fleet: 85, fullMark: 100 },
      { subject: 'Safety Score', vehicle: 88, fleet: 82, fullMark: 100 },
      { subject: 'Cost Control', vehicle: 78, fleet: 75, fullMark: 100 }
    ],
    performanceTrend: [
      { week: 'W1', efficiency: 27.2, uptime: 92, margin: 82 },
      { week: 'W2', efficiency: 28.1, uptime: 95, margin: 84 },
      { week: 'W3', efficiency: 28.8, uptime: 94, margin: 86 },
      { week: 'W4', efficiency: 28.5, uptime: 94.2, margin: 85 }
    ]
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-heading text-muted-foreground mb-2">{vehicleName} - Performance analysis</h3>
        <p className="text-caption text-muted-foreground">Comprehensive vehicle performance metrics</p>
      </div>
      
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="text-body-medium font-body-medium text-foreground text-tabular">
            {formatCurrency(mockData.totalMargin)}
          </div>
          <div className="text-caption text-muted-foreground">Total margin generated</div>
        </div>
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="text-body-medium font-body-medium text-foreground text-tabular">
            {formatPercentage(mockData.uptime / 100)}
          </div>
          <div className="text-caption text-muted-foreground">Uptime</div>
        </div>
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="text-body-medium font-body-medium text-foreground text-tabular">
            R{mockData.costPerKm.toFixed(2)}/km
          </div>
          <div className="text-caption text-muted-foreground">Cost per KM</div>
        </div>
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="text-body-medium font-body-medium text-foreground text-tabular">
            {mockData.fuelEfficiency.toFixed(1)}L
          </div>
          <div className="text-caption text-muted-foreground">Fuel efficiency /100km</div>
        </div>
      </div>

      {/* Performance Radar Chart */}
      <Card className="bg-muted/10 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-heading text-muted-foreground">Performance vs fleet average</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={mockData.radarData}>
                <PolarGrid strokeDasharray="2 2" stroke="hsl(var(--border))" />
                <PolarAngleAxis 
                  dataKey="subject" 
                  fontSize={9} 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <PolarRadiusAxis 
                  angle={90} 
                  domain={[0, 100]} 
                  fontSize={8}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Radar 
                  name="Vehicle" 
                  dataKey="vehicle" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))" 
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Radar 
                  name="Fleet Avg" 
                  dataKey="fleet" 
                  stroke="hsl(var(--muted-foreground))" 
                  fill="hsl(var(--muted-foreground))" 
                  fillOpacity={0.1}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Performance Trend */}
      <Card className="bg-muted/10 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-heading text-muted-foreground">4-week performance trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockData.performanceTrend}>
                <XAxis dataKey="week" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip 
                  formatter={(value, name) => [`${value}${name === 'efficiency' ? 'L' : name === 'uptime' ? '%' : ''}`, name]}
                />
                <Line 
                  type="monotone" 
                  dataKey="margin" 
                  stroke="hsl(var(--success-500))" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Key Insights */}
      <div className="space-y-2">
        <h4 className="text-heading text-muted-foreground">Key insights</h4>
        <div className="space-y-2">
          <div className="p-3 bg-success/5 border border-success/20 rounded-lg">
            <div className="text-body font-body-medium text-success">Above average performance</div>
            <div className="text-caption text-muted-foreground">
              Fuel efficiency 12% better than fleet average
            </div>
          </div>
          <div className="p-3 bg-warning/5 border border-warning/20 rounded-lg">
            <div className="text-body font-body-medium text-warning">Maintenance attention needed</div>
            <div className="text-caption text-muted-foreground">
              Due for scheduled service in 2,400 km
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleDrilldown;