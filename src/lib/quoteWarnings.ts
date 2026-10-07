// Send-path warnings for a SAVED quote (QUOTE-RULES.md §10–11).
//
// The server's send check (POST /quotes/cost-breakdown/ {quote_id} →
// send_check.warnings) is the authority; savedQuoteWarnings() is the local
// stand-in while it loads or on an older backend: "priced in an earlier
// diesel period" from the quote's own snapshot.
import { useQuery } from "@tanstack/react-query";
import { postData } from "@/lib/Api";
import { currentPeriodStartIso, isoDay, shortDate, type QuoteWarning } from "./dieselPrice";

interface QuoteLike { priced_at?: string | null }
type RawWarning = { code?: unknown; title?: unknown; severity?: unknown; actions?: unknown };

export function savedQuoteWarnings(q: QuoteLike | null | undefined, now = new Date()): QuoteWarning[] {
  if (!q) return [];
  const pricedAt = isoDay(q.priced_at);
  if (!pricedAt || pricedAt >= currentPeriodStartIso(now)) return [];
  return [{ code: "diesel_period_changed", severity: "warn", title: "Priced on an earlier diesel price",
    detail: `Priced ${shortDate(pricedAt, now)}.`, actions: [{ id: "reprice", label: "Re-price" }] }];
}

const asWarnings = (v: unknown): QuoteWarning[] => (Array.isArray(v) ? (v as RawWarning[]) : [])
  .filter((w) => !!w && typeof w.code === "string" && typeof w.title === "string")
  .map((w) => ({ ...(w as QuoteWarning), severity: w.severity === "block" ? "block" : "warn", actions: Array.isArray(w.actions) ? (w.actions as QuoteWarning["actions"]) : [] }));

/** The server's send check for a saved quote (null id = off). */
export function useSendCheck(quoteId: number | string | null | undefined, quote: QuoteLike | null | undefined): QuoteWarning[] {
  const { data } = useQuery({
    queryKey: ["quote-send-check", quoteId],
    queryFn: () => postData({ url: "api/v1/quotes/cost-breakdown/", data: { quote_id: quoteId } }).catch(() => null),
    enabled: quoteId != null && quoteId !== "",
    staleTime: 30 * 1000,
    retry: false,
  });
  const server = (data as { send_check?: { warnings?: unknown } } | null)?.send_check?.warnings;
  return server ? asWarnings(server) : savedQuoteWarnings(quote);
}

/** A send refused by the server (400 quote_send_blocked): its first block title. */
export function sendBlockedMessage(e: unknown): string | null {
  const body = (e as { data?: { code?: string; warnings?: unknown; error?: unknown } } | null)?.data;
  if (body?.code !== "quote_send_blocked") return null;
  const w = asWarnings(body.warnings).find((x) => x.severity === "block");
  return w ? w.title : (typeof body.error === "string" ? body.error : "This quote can't be sent yet");
}
