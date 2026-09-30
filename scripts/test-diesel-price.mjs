// Run: node --experimental-strip-types scripts/test-diesel-price.mjs
// Cases for src/lib/dieselPrice.ts (no test runner is configured in this repo).
import assert from "node:assert/strict";
import { resolveDieselPrice as r, dieselBasisNote as note, liveDieselHint as hint } from "../src/lib/dieselPrice.ts";

// Current production backend response shape (no zone/zone_price keys).
const oldLive = { success: true, inland_price: 29.1111, coastal_price: 28.2391, last_updated: "2026-09-01", is_stale: false, source: "FIASA" };
// PR #107 backend response shape.
const newLive = { ...oldLive, inland_price: 29.5551, coastal_price: 28.6831, zone: "INLAND", zone_price: 29.5551,
  diesel_grade: "50ppm", price_basis: "WHOLESALE_LIST", effective_from: "2026-09-02T00:01:00+02:00", last_failed_check_at: null };
const fallbackLive = { success: true, inland_price: null, coastal_price: null, is_stale: true, source: "FALLBACK_LATEST", zone: "INLAND", zone_price: null };

const cases = [];
const t = (name, fn) => { fn(); cases.push(name); };

t("default company price (23.5000 string) -> live zone_price", () => {
  const x = r({ company: { fuel_price_per_litre: "23.5000", fuel_zone: "INLAND" }, live: newLive });
  assert.equal(x.source, "live"); assert.equal(x.price, 29.5551);
  assert.equal(note(x), " · live, 50ppm inland, from 2 Sep"); assert.equal(hint(x), null);
});
t("default company price, current backend -> inland_price by fuel_zone", () => {
  const x = r({ company: { fuel_price_per_litre: 23.5, fuel_zone: "INLAND" }, live: oldLive });
  assert.equal(x.price, 29.1111); assert.equal(note(x), " · live, inland, from Sep 2026");
});
t("coastal company, current backend -> coastal_price", () => {
  const x = r({ company: { fuel_price_per_litre: "23.5000", fuel_zone: "COASTAL" }, live: oldLive });
  assert.equal(x.price, 28.2391); assert.equal(x.zone, "COASTAL");
});
t("coastal company, PR #107 backend -> zone_price wins", () => {
  const x = r({ company: { fuel_price_per_litre: "23.5000", fuel_zone: "COASTAL" }, live: { ...newLive, zone: "COASTAL", zone_price: 28.6831 } });
  assert.equal(x.price, 28.6831); assert.equal(note(x), " · live, 50ppm coastal, from 2 Sep");
});
t("empty company price -> live", () => {
  assert.equal(r({ company: { fuel_price_per_litre: null }, live: newLive }).price, 29.5551);
  assert.equal(r({ company: undefined, live: newLive }).price, 29.5551);
});
t("custom company price -> custom, with live hint", () => {
  const x = r({ company: { fuel_price_per_litre: "27.8000" }, live: newLive });
  assert.equal(x.source, "own"); assert.equal(x.price, 27.8);
  assert.equal(note(x), " · your price"); assert.equal(hint(x), "Live diesel: R29.56/L (effective 2 Sep)");
});
t("no live (fetch failed / null) -> company setting (old behaviour)", () => {
  const x = r({ company: { fuel_price_per_litre: "23.5000", fuel_zone: "INLAND" }, live: null });
  assert.equal(x.source, "company"); assert.equal(x.price, 23.5); assert.equal(note(x), " · inland");
  assert.equal(r({ company: { fuel_price_per_litre: "23.5000" }, live: { success: false, error: "x" } }).price, 23.5);
});
t("fallback row (nulls) -> company setting", () => {
  const x = r({ company: { fuel_price_per_litre: "23.5000" }, live: fallbackLive });
  assert.equal(x.source, "company"); assert.equal(x.price, 23.5);
});
t("stale flag (failed refresh) -> still live, labelled stale", () => {
  const x = r({ company: { fuel_price_per_litre: "23.5000" }, live: { ...newLive, is_stale: true, last_failed_check_at: "2026-09-28T06:00:00+02:00" } });
  assert.equal(x.source, "live"); assert.equal(x.liveStale, true);
  assert.equal(note(x), " · live, 50ppm inland, from 2 Sep · stale");
  const own = r({ company: { fuel_price_per_litre: "27.80" }, live: { ...oldLive, is_stale: true } });
  assert.equal(hint(own), "Live diesel: R29.11/L (effective Sep 2026, stale)");
});
t("no company and no live -> null (caller keeps its 21.7 last resort)", () => {
  assert.equal(r({ company: undefined, live: undefined }).price, null);
});
console.log(`OK ${cases.length} cases:\n - ` + cases.join("\n - "));
