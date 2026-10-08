// Run: node --experimental-strip-types scripts/test-diesel-price.mjs
// QUOTE-RULES.md §1–2 for src/lib/dieselPrice.ts.
import assert from "node:assert/strict";
import { resolveDieselPrice as r, resolvePetrolPrice as rp, fuelInputFor, fuelKind, petrolGrade, currentPeriodStartIso, dieselSourceNote, isoDay } from "../src/lib/dieselPrice.ts";

const NOW = new Date("2026-10-07T10:00:00+02:00"); // first Wednesday of Oct 2026
const live = { success: true, inland_price: 29.5551, coastal_price: 28.6831, zone: "INLAND", zone_price: 29.5551,
  diesel_500ppm_inland: 29.4, source: "FIASA", effective_from: "2026-10-07T00:01:00+02:00" };
const old = { ...live, effective_from: "2026-09-02T00:01:00+02:00" };
const fallback = { success: true, inland_price: null, coastal_price: null, zone_price: null, source: "FALLBACK_LATEST" };

const cases = [];
const t = (name, fn) => { fn(); cases.push(name); };
const codes = (x) => x.warnings.map((w) => w.code).sort();

t("period start: first Wednesday 00:01 SAST", () => {
  assert.equal(currentPeriodStartIso(NOW), "2026-10-07");
  assert.equal(currentPeriodStartIso(new Date("2026-10-06T23:59:00+02:00")), "2026-09-02");
  assert.equal(currentPeriodStartIso(new Date("2026-10-07T00:00:30+02:00")), "2026-09-02");
  assert.equal(currentPeriodStartIso(new Date("2026-10-07T00:01:00+02:00")), "2026-10-07");
  assert.equal(currentPeriodStartIso(new Date("2026-01-02T08:00:00+02:00")), "2025-12-03");
});
t("isoDay reads timestamps in SAST", () => {
  assert.equal(isoDay("2026-10-06T22:01:00Z"), "2026-10-07");
  assert.equal(isoDay("2026-09-02T00:01:00+02:00"), "2026-09-02");
  assert.equal(isoDay("2026-09-02"), "2026-09-02");
});
t("LIVE -> official zone price, no warnings", () => {
  const x = r({ company: { fuel_price_mode: "LIVE", fuel_zone: "INLAND" }, live, now: NOW });
  assert.equal(x.source, "official"); assert.equal(x.price, 29.5551); assert.deepEqual(codes(x), []);
  assert.equal(dieselSourceNote(x, NOW), "official inland, 7 Oct");
});
t("LIVE coastal", () => {
  const x = r({ company: { fuel_price_mode: "LIVE", fuel_zone: "COASTAL" }, live, now: NOW });
  assert.equal(x.price, 28.6831); assert.equal(x.zone, "COASTAL");
});
t("OWN -> own price; within 3% no warning", () => {
  const x = r({ company: { fuel_price_mode: "OWN", fuel_price_own: "29.00", fuel_price_own_set_at: "2026-10-07T09:00:00+02:00" }, live, now: NOW });
  assert.equal(x.source, "own"); assert.equal(x.price, 29); assert.deepEqual(codes(x), []);
});
t("OWN > 3% off official -> diesel_own_off", () => {
  const x = r({ company: { fuel_price_mode: "OWN", fuel_price_own: "27.00", fuel_price_own_set_at: "2026-10-07" }, live, now: NOW });
  assert.deepEqual(codes(x), ["diesel_own_off"]);
  assert.equal(x.warnings[0].severity, "warn");
  assert.ok(x.warnings[0].title.split(/\s+/).length <= 8);
  const y = r({ company: { fuel_price_mode: "OWN", fuel_price_own: "27.00", fuel_price_own_set_at: "2026-10-07" }, live, now: NOW, litres: 100 });
  assert.equal(y.warnings[0].impact_zar, -255.51);
  assert.deepEqual(x.warnings[0].actions.map((a) => a.id), ["use_official", "update_own"]);
});
t("OWN set before the latest official -> diesel_own_old", () => {
  const x = r({ company: { fuel_price_mode: "OWN", fuel_price_own: 29.5, fuel_price_own_set_at: "2026-09-20T00:00:00+02:00" }, live, now: NOW });
  assert.deepEqual(codes(x), ["diesel_own_old"]);
});
t("OWN with empty own -> LIVE", () => {
  const x = r({ company: { fuel_price_mode: "OWN", fuel_price_own: null }, live, now: NOW });
  assert.equal(x.source, "official"); assert.equal(x.mode, "LIVE");
});
t("LIVE with an old period -> diesel_stale", () => {
  const x = r({ company: { fuel_price_mode: "LIVE" }, live: old, now: NOW });
  assert.equal(x.source, "official"); assert.equal(x.official_stale, true); assert.deepEqual(codes(x), ["diesel_stale"]);
});
t("missing: no live, fallback row, failed request -> null + block, never 23.50", () => {
  for (const l of [null, undefined, fallback, { success: false }]) {
    const x = r({ company: { fuel_price_mode: "LIVE", fuel_price_per_litre: "23.50" }, live: l, now: NOW });
    assert.equal(x.price, null); assert.equal(x.source, "missing");
    assert.equal(x.warnings[0].code, "diesel_missing"); assert.equal(x.warnings[0].severity, "block");
  }
});
t("legacy profile (no mode): 23.50 / null / equal to a FuelPrice row -> LIVE", () => {
  for (const v of ["23.5000", null, "29.5551", 29.4]) {
    const x = r({ company: { fuel_price_per_litre: v }, live, now: NOW });
    assert.equal(x.source, "official", String(v)); assert.equal(x.price, 29.5551);
  }
});
t("legacy profile: anything else -> OWN, set_at = updated_at", () => {
  const x = r({ company: { fuel_price_per_litre: "27.80", updated_at: "2026-09-10T08:00:00+02:00" }, live, now: NOW });
  assert.equal(x.source, "own"); assert.equal(x.price, 27.8); assert.equal(x.ownSetAtDay, "2026-09-10");
});
t("server resolution (company_price) wins", () => {
  const x = r({ company: { fuel_price_mode: "LIVE" }, live: { ...live, company_price: { mode: "OWN", source: "own", price: 30.1, zone: "INLAND",
    official: { price: 31.2, effective_from: "2026-10-06T22:01:00Z", stale: false }, own: { price: 30.1, set_at: "2026-10-07T08:00:00Z" } } }, now: NOW });
  assert.equal(x.price, 30.1); assert.equal(x.source, "own"); assert.equal(x.officialFrom, "2026-10-07"); assert.deepEqual(codes(x), ["diesel_own_off"]);
});
t("use official on this quote / override", () => {
  const own = { fuel_price_mode: "OWN", fuel_price_own: "27.00", fuel_price_own_set_at: "2026-10-07" };
  assert.equal(r({ company: own, live, now: NOW, useOfficial: true }).source, "official");
  assert.equal(r({ company: own, live, now: NOW, overridePrice: 31 }).source, "override");
});
// ---- petrol (petrol + hybrid trucks), same rule; electric own only ----
const petrol = { inland_95: { price: 30.25, effective_from: "2026-10-06T22:01:00Z", source: "FIASA", stale: false },
  inland_93: { price: 29.5, effective_from: "2026-10-06T22:01:00Z", source: "FIASA", stale: false },
  coastal_95: { price: 29.4, effective_from: "2026-10-06T22:01:00Z", source: "FIASA", stale: false }, coastal_93: null };
t("petrol LIVE -> official inland 95; 93 only inland; own off names petrol + grade", () => {
  const x = rp({ company: { fuel_price_petrol_mode: "LIVE", fuel_zone: "INLAND" }, live: { ...live, petrol } });
  assert.equal(x.source, "official"); assert.equal(x.price, 30.25); assert.equal(x.grade, "95"); assert.deepEqual(codes(x), []);
  assert.equal(rp({ company: { fuel_price_petrol_mode: "LIVE", fuel_price_petrol_grade: "93" }, live: { ...live, petrol } }).price, 29.5);
  assert.equal(petrolGrade({ fuel_zone: "COASTAL", fuel_price_petrol_grade: "93" }), "95");
  assert.equal(rp({ company: { fuel_price_petrol_mode: "LIVE", fuel_zone: "COASTAL", fuel_price_petrol_grade: "93" }, live: { ...live, petrol } }).price, 29.4);
  const o = rp({ company: { fuel_price_petrol_mode: "OWN", fuel_price_petrol: "27.00", fuel_price_petrol_set_at: "2026-10-07T08:00:00Z" }, live: { ...live, petrol } });
  assert.equal(o.source, "own"); assert.equal(o.price, 27);
  assert.equal(o.warnings[0].title, "Your petrol price differs from official");
  assert.equal(o.warnings[0].detail, "Yours R 27,00/L, official R 30,25/L (inland 95).");
  assert.equal(o.warnings[0].fuel_type, "petrol");
});
t("petrol: server resolution wins; old backend -> own only; hybrid uses petrol; electric own", () => {
  const server = { fuel_type: "Petrol", grade: "95", mode: "LIVE", source: "official", price: 30.1, zone: "INLAND",
    official: { price: 30.1, effective_from: "2026-10-06T22:01:00Z", stale: false }, own: { price: null, set_at: null } };
  assert.equal(rp({ company: { fuel_price_petrol: "27" }, live: { ...live, company_petrol_price: server } }).price, 30.1);
  const old1 = rp({ company: { fuel_price_petrol: "27.40" }, live });
  assert.equal(old1.source, "own"); assert.equal(old1.price, 27.4);
  const old2 = rp({ company: {}, live });
  assert.equal(old2.source, "missing"); assert.equal(old2.warnings[0].title, "No petrol price available");
  assert.equal(fuelKind("Hybrid"), "Petrol"); assert.equal(fuelKind("Electric"), "Electric"); assert.equal(fuelKind(null), "Diesel");
  assert.equal(fuelInputFor({ fuelType: "Hybrid", company: { fuel_price_petrol_mode: "LIVE" }, live: { ...live, petrol } }).official_price, 30.25);
  const e = fuelInputFor({ fuelType: "Electric", company: { fuel_price_electric: "3.10" }, live });
  assert.equal(e.own_price, 3.1); assert.equal(e.fuel_type, "Electric");
});
console.log(`dieselPrice: ${cases.length} cases passed`);
