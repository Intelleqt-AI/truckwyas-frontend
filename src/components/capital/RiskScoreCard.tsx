import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatZAR } from "@/lib/constants";

interface RiskFactor {
  name: string;
  score: number;
  max: number;
}

interface RiskScoreCardProps {
  score: number;
  tier: string;
  factors: RiskFactor[];
  fee?: number;
  feeAmount?: number;
  netAmount?: number;
  compact?: boolean;
}

const getTierColor = (tier: string) => {
  switch (tier.toLowerCase()) {
    case 'excellent':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'good':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'fair':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'elevated':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const getTierBarColor = (tier: string) => {
  switch (tier.toLowerCase()) {
    case 'excellent':
      return 'var(--status-success)';
    case 'good':
      return 'var(--accent-primary)';
    case 'fair':
      return 'var(--status-warning)';
    case 'elevated':
      return 'var(--status-danger)';
    default:
      return 'var(--text-secondary)';
  }
};

export function RiskScoreCard({
  score,
  tier,
  factors,
  fee,
  feeAmount,
  netAmount,
  compact = false
}: RiskScoreCardProps) {
  const barColor = getTierBarColor(tier);
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Risk Assessment</h3>
          <Badge className={`${getTierColor(tier)} border font-medium`}>
            {tier}
          </Badge>
        </div>

        {/* Score Circle and Factors */}
        <div className={compact ? "space-y-4" : "grid grid-cols-2 gap-6"}>
          {/* Circular Score Gauge */}
          <div className="flex items-center justify-center">
            <div className="relative w-32 h-32">
              {/* Background circle */}
              <svg className="transform -rotate-90 w-32 h-32">
                <circle
                  cx="64"
                  cy="64"
                  r="45"
                  stroke="var(--border-subtle)"
                  strokeWidth="8"
                  fill="none"
                />
                {/* Progress circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="45"
                  stroke={barColor}
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              {/* Score text */}
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <div className="text-3xl font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                  {score}
                </div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>/ 100</div>
              </div>
            </div>
          </div>

          {/* Factor Bars */}
          <div className="space-y-3">
            {factors.map((factor) => (
              <div key={factor.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{factor.name}</span>
                  <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                    {factor.score}/{factor.max}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${(factor.score / factor.max) * 100}%`,
                      backgroundColor: barColor
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fee Summary (if provided) */}
        {fee !== undefined && feeAmount !== undefined && netAmount !== undefined && (
          <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Fee Rate</span>
              <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{fee}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Fee Amount</span>
              <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatZAR(feeAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Net Payout</span>
              <span className="text-2xl font-mono font-bold" style={{ color: 'var(--accent-primary)' }}>
                {formatZAR(netAmount)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
