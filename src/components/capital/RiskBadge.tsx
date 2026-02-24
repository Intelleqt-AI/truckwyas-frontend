import { getRiskTierInfo, type RiskTier } from "@/lib/risk-engine";

interface RiskBadgeProps {
  tier: RiskTier;
  score: number;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RiskBadge({ tier, score, showScore = true, size = 'md' }: RiskBadgeProps) {
  const info = getRiskTierInfo(tier);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: info.bgColor,
        color: info.color
      }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: info.color }}
      />
      <span>{info.label}</span>
      {showScore && <span className="font-mono">({score})</span>}
    </div>
  );
}
