import { cn } from "@/lib/utils";

interface AgingBarProps {
  currentDays: number;
  days30: number;
  days60: number;
  days90Plus: number;
  className?: string;
}

export function AgingBar({ currentDays, days30, days60, days90Plus, className }: AgingBarProps) {
  const total = currentDays + days30 + days60 + days90Plus;

  if (total === 0) {
    return <div className={cn("h-2 w-full bg-muted rounded", className)} />;
  }

  const currentPercent = (currentDays / total) * 100;
  const days30Percent = (days30 / total) * 100;
  const days60Percent = (days60 / total) * 100;
  const days90Percent = (days90Plus / total) * 100;

  return (
    <div className={cn("flex h-2 w-full overflow-hidden rounded", className)}>
      {currentPercent > 0 && (
        <div
          className="bg-success"
          style={{ width: `${currentPercent}%` }}
          title={`Current: ${currentDays}`}
        />
      )}
      {days30Percent > 0 && (
        <div
          className="bg-primary"
          style={{ width: `${days30Percent}%` }}
          title={`1-30 days: ${days30}`}
        />
      )}
      {days60Percent > 0 && (
        <div
          className="bg-warning"
          style={{ width: `${days60Percent}%` }}
          title={`31-60 days: ${days60}`}
        />
      )}
      {days90Percent > 0 && (
        <div
          className="bg-destructive"
          style={{ width: `${days90Percent}%` }}
          title={`60+ days: ${days90Plus}`}
        />
      )}
    </div>
  );
}
