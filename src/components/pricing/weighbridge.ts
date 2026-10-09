import { patchData } from "@/lib/Api";

/** "31,24" or "31.24" tonnes (comma or point decimals), above 0 and up to 100. */
export const parseTonnes = (text: string): number | null => {
  const n = Number(text.replace(/\s/g, "").replace(",", "."));
  return text.trim() !== "" && Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
};
export const fieldText = (v: string | number | null | undefined) => (v == null || v === "" ? "" : String(Number(v)).replace(".", ","));

/** PATCH the weighbridge tonnes (and slip) on a per-tonne load; the server
 *  re-prices the load and its draft invoice. */
export async function saveWeighbridge(loadId: number | string, tonnes: number, slip: string) {
  return patchData({ url: `api/v1/loads/${loadId}/`, data: { actual_tonnes: tonnes, weighbridge_slip: slip.trim(), actual_tonnes_source: "weighbridge" } });
}

