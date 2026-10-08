import { useCallback, useEffect, useRef, useState } from "react";
import { postData } from "@/lib/Api";
import { adaptAnalysis, buildRequest, type PricingAnalysis, type PricingInputs } from "./types";

export const PRICING_URL = "api/v1/quotes/pricing-analysis/";
const DEBOUNCE_MS = 400;

export type PricingStatus =
  | "idle"        // inputs not ready: nothing requested
  | "loading"     // first request for this quote in flight
  | "ready"       // a result for the current inputs
  | "refreshing"  // a result is shown; a newer request is in flight
  | "error"       // the server failed (5xx, bad body)
  | "offline"     // no response at all
  | "unavailable";// endpoint not deployed (404) or refused (403)

export interface PricingState {
  status: PricingStatus;
  data: PricingAnalysis | null;
  /** The request body the shown data answers (stale while refreshing). */
  dataKey: string | null;
  /** The shown data answers exactly the builder's current values. */
  isCurrent: boolean;
  retry: () => void;
}

/**
 * Debounced (~400 ms), cancel-stale fetch of the pricing analysis for the
 * builder's current values. `inputs` null means "not ready": nothing is sent.
 * The last good result stays on screen while a newer one loads.
 */
export function usePricingAnalysis(inputs: PricingInputs | null, enabled: boolean): PricingState {
  const body = inputs && enabled ? buildRequest(inputs) : null;
  const key = body ? JSON.stringify(body) : null;

  const [status, setStatus] = useState<PricingStatus>("idle");
  const [data, setData] = useState<PricingAnalysis | null>(null);
  const [dataKey, setDataKey] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  // The values the builder shows now: an answer for anything else is dropped.
  const latestKeyRef = useRef<string | null>(null);
  latestKeyRef.current = key;
  const lastNonceRef = useRef(0);
  // Automatic retries for the same inputs (reset on new inputs or an answer).
  const attemptRef = useRef(0);
  const attemptKeyRef = useRef<string | null>(null);
  const hasDataRef = useRef(false);
  hasDataRef.current = !!data;

  useEffect(() => {
    // Any change cancels the request still on its way at once (not when the
    // next one is sent): its answer is for values no longer on screen.
    abortRef.current?.abort();
    abortRef.current = null;
    if (!key) {
      // The last result is kept (not shown: data is null without a key) so a
      // route recalculation that then fails still has prices to show greyed.
      setStatus("idle");
      return;
    }
    if (attemptKeyRef.current !== key) { attemptKeyRef.current = key; attemptRef.current = 0; }
    const forced = nonce !== lastNonceRef.current;
    lastNonceRef.current = nonce;
    if (key === dataKey && !forced) { setStatus("ready"); return; }
    setStatus(hasDataRef.current ? "refreshing" : "loading");
    const timer = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        // 30 s: an international trip (border costs, market) can take a while;
        // a timeout is retried below, never shown as "offline" for good.
        const res = await postData({ url: PRICING_URL, data: JSON.parse(key), config: { signal: ctrl.signal, timeout: 30000 } });
        // Only an answer for exactly what is on screen now is shown.
        if (ctrl.signal.aborted || key !== latestKeyRef.current) return;
        const adapted = adaptAnalysis(res);
        if (!adapted) { setStatus("error"); return; }
        setData(adapted);
        setDataKey(key);
        setStatus("ready");
        attemptRef.current = 0;
      } catch (e) {
        if (ctrl.signal.aborted || key !== latestKeyRef.current) return;
        const err = e as { status?: number; message?: string };
        if (err?.message === "canceled") return;
        if (err?.status === 404 || err?.status === 403 || err?.status === 402) setStatus("unavailable");
        else if (!err?.status) setStatus("offline");
        else setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  // No answer (timeout, a gateway error without CORS headers, the server
  // restarting) or a server error: try again on its own, backing off, while
  // the inputs are the same. The last result stays on screen marked out of date.
  useEffect(() => {
    if ((status !== "offline" && status !== "error") || !key) return;
    const delays = [2000, 5000, 10000, 20000, 30000];
    const wait = delays[Math.min(attemptRef.current, delays.length - 1)];
    attemptRef.current += 1;
    const t = setTimeout(() => setNonce((n) => n + 1), wait);
    return () => clearTimeout(t);
  }, [status, key]);

  // Back online: try again on its own.
  useEffect(() => {
    if (status !== "offline") return;
    const on = () => setNonce((n) => n + 1);
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { status, data: key ? data : null, dataKey, isCurrent: !!key && dataKey === key, retry };
}
