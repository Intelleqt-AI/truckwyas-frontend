import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number;
  className?: string;
  showPrefix?: boolean;
}

export function CurrencyDisplay({ amount, className, showPrefix = true }: CurrencyDisplayProps) {
  const formatted = amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <span className={cn("font-mono font-medium", className)}>
      {showPrefix && "R "}
      {formatted}
    </span>
  );
}

export function formatCurrency(amount: number, showPrefix = true): string {
  const formatted = amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return showPrefix ? `R ${formatted}` : formatted;
}
