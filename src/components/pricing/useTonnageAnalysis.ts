import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { postData } from "@/lib/Api";
import type { TonnageCosting } from "@/lib/quoteRules";
import type { TonnageChoice, TonnageMarket } from "./TonnagePanel";

export interface TonnageAnalysis {
  costing: TonnageCosting;
  market_per_tonne: TonnageMarket | null;
  choices: TonnageChoice[];
  /** The previous answer kept on screen while the one for these inputs loads. */
  placeholder: boolean;
}

/**
 * POST /api/v1/quotes/pricing-analysis/ with pricing_basis "per_tonne": the
 * server's tonnage costing (every eligible truck, the safest basis), the market
 * per tonne and three rates. Debounced 400 ms, cached per payload. null while
 * not ready or on failure (the builder then shows its own computeTonnage()).
 */
export function useTonnageAnalysis(payload: Record<string, unknown> | null): TonnageAnalysis | null {
  const key = payload ? JSON.stringify(payload) : null;
  const [debounced, setDebounced] = useState<string | null>(key);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(key), 400);
    return () => clearTimeout(t);
  }, [key]);
  const { data, isPlaceholderData } = useQuery({
    queryKey: ["tonnage-analysis", debounced],
    queryFn: () => postData({ url: "api/v1/quotes/pricing-analysis/", data: JSON.parse(debounced as string) }).catch(() => null),
    enabled: !!debounced,
    staleTime: 5 * 60 * 1000,
    retry: false,
    placeholderData: keepPreviousData,
  });
  const d = data as { success?: boolean; pricing_basis?: string; costing?: TonnageCosting; market_per_tonne?: TonnageMarket; choices?: TonnageChoice[] } | null;
  if (!debounced || !d || d.success === false || d.pricing_basis !== "per_tonne" || !d.costing?.tonnage) return null;
  return { costing: d.costing, market_per_tonne: d.market_per_tonne ?? null, choices: d.choices ?? [],
    placeholder: isPlaceholderData || debounced !== key };
}
