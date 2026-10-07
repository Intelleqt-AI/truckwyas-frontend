import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { postData } from "@/lib/Api";

export const COST_BREAKDOWN_URL = "api/v1/quotes/cost-breakdown/";

/** What the builder reads from the server's costing: the company figures it
 *  resolved (operating cost per km for this truck's class, the driver rate,
 *  settings), and its warnings. */
export interface ServerCosting {
  inputs: {
    operating_cost_per_km?: number | null; operating_cost_source?: string | null;
    driver?: { allowance_per_night?: number | null } | null;
    settings?: { include_empty_return_default?: boolean | null; empty_return_min_km?: number | null } | null;
    minimum_charge?: number | null; target_margin_pct?: number | null; hours_per_day?: number | null;
  } | null;
  floor: number | null;
  warnings: unknown[];
  resolution?: { vehicle_type_id?: number | null; suggested_vehicle_type_id?: number | null } | null;
}

/**
 * POST /api/v1/quotes/cost-breakdown/ for the builder's route, truck and load
 * (debounced 400 ms; cached per payload). `payload` null = not ready. A
 * missing endpoint (older backend) or a failure just means null: the builder
 * then uses the company profile's own figures.
 */
export function useCostBreakdown(payload: Record<string, unknown> | null): ServerCosting | null {
  const key = payload ? JSON.stringify(payload) : null;
  const [debounced, setDebounced] = useState<string | null>(key);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(key), 400);
    return () => clearTimeout(t);
  }, [key]);
  const { data } = useQuery({
    queryKey: ["cost-breakdown", debounced],
    queryFn: () => postData({ url: COST_BREAKDOWN_URL, data: JSON.parse(debounced as string) }).catch(() => null),
    enabled: !!debounced,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  if (!debounced || !data || (data as { success?: boolean }).success === false) return null;
  return data as ServerCosting;
}
