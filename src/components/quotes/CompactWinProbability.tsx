import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceDot } from "recharts";

interface Quote {
  id: string;
  price: number;
  marginPct: number;
}

interface CompactWinProbabilityProps {
  quote: Quote;
}

// Mock win curve data
const mockWinCurveData = [
  { price: 18000, winProb: 95 },
  { price: 19000, winProb: 88 },
  { price: 20000, winProb: 75 },
  { price: 21000, winProb: 62 },
  { price: 21500, winProb: 52 },
  { price: 22000, winProb: 42 },
  { price: 23000, winProb: 28 },
  { price: 24000, winProb: 15 },
  { price: 25000, winProb: 8 }
];

export function CompactWinProbability({ quote }: CompactWinProbabilityProps) {
  // Find optimal margin point (mock calculation)
  const optimalPrice = 20500;
  const currentWinProb = 52; // Mock based on current price

  return (
    <div className="h-full flex flex-col gap-1">
      {/* Current Win Probability */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">Current Win Rate</span>
        <span className="text-lg font-bold text-primary">{currentWinProb}%</span>
      </div>

      {/* Compact Line Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={mockWinCurveData} margin={{ top: 0, right: 6, left: 6, bottom: 0 }}>
            <XAxis 
              dataKey="price" 
              hide
            />
            <YAxis 
              domain={[0, 100]}
              hide
            />
            <Line
              type="monotone"
              dataKey="winProb"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: "hsl(var(--primary))" }}
            />
            <ReferenceDot
              x={quote.price}
              y={currentWinProb}
              r={4}
              fill="hsl(var(--primary))"
              stroke="hsl(var(--background))"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Optimal Point */}
      <div className="mt-auto flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Optimal</span>
        <span className="font-medium text-success">
          {new Intl.NumberFormat('en-ZA', {
            style: 'currency',
            currency: 'ZAR',
            minimumFractionDigits: 0
          }).format(optimalPrice)} @ 68%
        </span>
      </div>
    </div>
  );
}