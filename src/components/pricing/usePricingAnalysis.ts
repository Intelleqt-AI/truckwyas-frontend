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
  const lastNonceRef = useRef(0);
  const hasDataRef = useRef(false);
  hasDataRef.current = !!data;

  useEffect(() => {
    if (!key) {
      abortRef.current?.abort();
      setStatus("idle");
      setData(null); setDataKey(null);
      return;
    }
    const forced = nonce !== lastNonceRef.current;
    lastNonceRef.current = nonce;
    if (key === dataKey && !forced) { setStatus("ready"); return; }
    setStatus(hasDataRef.current ? "refreshing" : "loading");
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await postData({ url: PRICING_URL, data: JSON.parse(key), config: { signal: ctrl.signal, timeout: 15000 } });
        if (ctrl.signal.aborted) return;
        const adapted = adaptAnalysis(res);
        if (!adapted) { setStatus("error"); return; }
        setData(adapted);
        setDataKey(key);
        setStatus("ready");
      } catch (e) {
        if (ctrl.signal.aborted) return;
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

  // Back online: try again on its own.
  useEffect(() => {
    if (status !== "offline") return;
    const on = () => setNonce((n) => n + 1);
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { status, data: key ? data : null, dataKey, retry };
}
