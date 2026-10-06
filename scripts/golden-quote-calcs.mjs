// Golden lock for QuoteBuilder's auto-calculation (fuel, tolls, cross-border,
// base rate, total, VAT). Owner's rule: these engines must not change.
//
// Run: node --experimental-strip-types scripts/golden-quote-calcs.mjs
// (no test runner is configured in this repo; no extra dependencies).
//
// Two checks:
//  1. FORMULA LOCK — every statement of the cost block, exactly as it is on
//     main (e1ef5f1), must still be present in src/pages/QuoteBuilder.tsx.
//     Editing any of them fails this script. Code AROUND them may change.
//  2. NUMBERS — the same formulas, fed with the inputs captured from main on
//     2026-10-06 (company profile, vehicle types, live FIASA diesel, and the
//     /route/calculate/ response for ten lanes; scripts/golden-quote-calcs.fixtures.json),
//     must reproduce the one-way and round-trip figures the builder showed
//     on main (:3815): fuel, tolls, cross-border, base, total excl. VAT, VAT.
//     The diesel price comes from the REAL src/lib/dieselPrice.ts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveDieselPrice } from "../src/lib/dieselPrice.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(here, "golden-quote-calcs.fixtures.json"), "utf8"));
const src = readFileSync(join(here, "../src/pages/QuoteBuilder.tsx"), "utf8");
const norm = (s) => s.replace(/\s+/g, " ").trim();
const srcN = norm(src);

// ---- 1. formula lock (verbatim from main e1ef5f1) ----
const LOCKED = [
  `const t = v > KG_SCALE_THRESHOLD ? v / 1000 : v;`,
  `return t >= MIN_PLAUSIBLE_T && t <= MAX_PLAUSIBLE_T ? t : null;`,
  `const FUEL_FALLBACK: Record<string, number> = { Flatbed: 32, Tautliner: 33, Refrigerated: 38, Tanker: 35, "Box Truck": 28, "Danger Load": 34, };`,
  `const fuelType = selectedVT?.fuel_type || 'Diesel';`,
  `const companyFuelPriceField = (FUEL_PRICE_FIELD_BY_TYPE as Record<string, string>)[fuelType] || 'fuel_price_per_litre';`,
  `const isDieselPricing = companyFuelPriceField === 'fuel_price_per_litre';`,
  `const diesel = resolveDieselPrice({ company: companyProfile, live: liveFuel });`,
  `const companyFuelPricePerL = (isDieselPricing ? diesel.price : null) || Number(companyProfile?.[companyFuelPriceField]) || Number(companyProfile?.fuel_price_per_litre) || 21.7;`,
  `const fuelPricePerL = aiFuelActive ? aiFuel!.pricePerL : companyFuelPricePerL;`,
  `const burn = (x: { vt: any; cap: number }) => (Number(x.vt.fuel_consumption_l_per_100km) || 32) * Math.pow(1 + (Number(x.vt.fuel_consumption_sensitivity_pct) || 2) / 100, t - x.cap);`,
  `const canCarry = rated.filter((x) => x.cap >= t);`,
  `return rated.sort((a, b) => b.cap - a.cap)[0].vt;`,
  `return canCarry.sort((a, b) => burn(a) - burn(b))[0].vt;`,
  `const fuelBasisVT = selectedVT || inferredVT;`,
  `const fuelConsumptionRef = Number(fuelBasisVT?.fuel_consumption_l_per_100km) || FUEL_FALLBACK[vehicleType] || 32;`,
  `const fuelRefCapacityTons = capacityTons(fuelBasisVT?.capacity) ?? 0;`,
  `const fuelSensitivity = (Number(fuelBasisVT?.fuel_consumption_sensitivity_pct) || 2) / 100;`,
  `const fuelConsumption = fuelRefCapacityTons > 0 ? fuelConsumptionRef * Math.pow(1 + fuelSensitivity, (Number(weight) || 0) - fuelRefCapacityTons) : fuelConsumptionRef;`,
  `if (Number(vt?.base_rate) > 0) { setBaseRatePerKm(String(vt.base_rate)); } else if (Number(companyProfile?.default_base_rate_per_km) > 0) { setBaseRatePerKm(String(companyProfile.default_base_rate_per_km)); }`,
  `const route = routeData?.routes?.[selectedRouteIndex] || null;`,
  `const distance = route?.distance_km ?? routeData?.distance_km ?? 0;`,
  `const legs = tripType === "ROUND_TRIP" ? 2 : 1;`,
  `const chargeDistance = distance * legs;`,
  `const fuelLitres = chargeDistance * fuelConsumption / 100;`,
  `const fuelCost = aiFuelActive ? Math.round(fuelLitres * fuelPricePerL) : Math.round(chargeDistance * fuelConsumption * fuelPricePerL / 100);`,
  `const tollRate = Number(companyProfile?.default_toll_rate_per_km) || 0.95;`,
  `const autoToll = Math.round((route?.toll_cost_zar ?? routeData?.toll_cost_zar ?? distance * tollRate) * legs);`,
  `const tollBreakdown = route?.toll_breakdown ?? routeData?.toll_breakdown ?? [];`,
  `const tollCost = tollManuallyEdited ? (Number(editableTollCost) || 0) : aiTollActive ? Math.round(aiToll!.oneWay * legs * 100) / 100 : autoToll;`,
  `const crossBorderCost = ((routeData?.additional_costs?.border_fees || 0) + (routeData?.additional_costs?.weighbridge_fees || 0) + (routeData?.additional_costs?.non_sa_tolls || 0)) * legs;`,
  `const driverAllowance = Number(driverAllowanceInput) || 0;`,
  `const weightKg = (Number(weight) || 0) * 1000;`,
  `const baseCost = Math.round(chargeDistance * Number(baseRatePerKm));`,
  `const total = baseCost + fuelCost + tollCost + crossBorderCost + driverAllowance + serviceCharge;`,
  `vehicle_type: vehicleType || "Flatbed", weight_kg: weightKg || 20000,`,
  `const vatAmt = isInternational ? 0 : Math.round(excl * 0.15 * 100) / 100;`,
  `const isForeignCountry = (code?: string) => !!code && !["ZA", "ZAF"].includes(code.toUpperCase());`,
];
const missing = LOCKED.filter((s) => !srcN.includes(norm(s)));
const lockOk = missing.length === 0;
if (!lockOk) {
  console.error(`FORMULA LOCK: ${missing.length} of ${LOCKED.length} locked statements changed or removed in QuoteBuilder.tsx:`);
  for (const m of missing) console.error("  - " + m);
}

// ---- 2. numbers (mirror of the locked statements) ----
const FUEL_FALLBACK = { Flatbed: 32, Tautliner: 33, Refrigerated: 38, Tanker: 35, "Box Truck": 28, "Danger Load": 34 };
const FUEL_PRICE_FIELD_BY_TYPE = { Diesel: "fuel_price_per_litre", Petrol: "fuel_price_petrol", Electric: "fuel_price_electric", Hybrid: "fuel_price_hybrid" };
const capacityTons = (raw) => {
  const v = Number(raw);
  if (!Number.isFinite(v) || v <= 0) return null;
  const t = v > 999 ? v / 1000 : v;
  return t >= 0.3 && t <= 80 ? t : null;
};
const dedupe = (rows) => Object.values(rows.reduce((acc, v) => { if (!acc[v.name]) acc[v.name] = v; return acc; }, {}));

function builder(scn, tripType) {
  const companyProfile = fx.company_profile, liveFuel = fx.live_fuel, routeData = scn.route;
  const vehicleType = scn.vehicle_type, weight = String(scn.weight_t);
  const vehicleTypes = dedupe(fx.vehicle_types.filter((v) => (v.available_vehicle_count ?? 1) > 0));
  const allVehicleTypes = dedupe(fx.vehicle_types);
  const selectedVT = vehicleTypes.find((v) => v.name === vehicleType);
  const fuelType = selectedVT?.fuel_type || "Diesel";
  const companyFuelPriceField = FUEL_PRICE_FIELD_BY_TYPE[fuelType] || "fuel_price_per_litre";
  const isDieselPricing = companyFuelPriceField === "fuel_price_per_litre";
  const diesel = resolveDieselPrice({ company: companyProfile, live: liveFuel });
  const fuelPricePerL = (isDieselPricing ? diesel.price : null) || Number(companyProfile?.[companyFuelPriceField]) || Number(companyProfile?.fuel_price_per_litre) || 21.7;
  let inferredVT = null;
  if (!vehicleType && Number(weight) > 0) {
    const t = Number(weight);
    const rated = allVehicleTypes.map((v) => ({ vt: v, cap: capacityTons(v.capacity) })).filter((x) => x.cap != null);
    const burn = (x) => (Number(x.vt.fuel_consumption_l_per_100km) || 32) * Math.pow(1 + (Number(x.vt.fuel_consumption_sensitivity_pct) || 2) / 100, t - x.cap);
    const canCarry = rated.filter((x) => x.cap >= t);
    if (rated.length) inferredVT = !canCarry.length ? rated.sort((a, b) => b.cap - a.cap)[0].vt : canCarry.sort((a, b) => burn(a) - burn(b))[0].vt;
  }
  const fuelBasisVT = selectedVT || inferredVT;
  const fuelConsumptionRef = Number(fuelBasisVT?.fuel_consumption_l_per_100km) || FUEL_FALLBACK[vehicleType] || 32;
  const fuelRefCapacityTons = capacityTons(fuelBasisVT?.capacity) ?? 0;
  const fuelSensitivity = (Number(fuelBasisVT?.fuel_consumption_sensitivity_pct) || 2) / 100;
  const fuelConsumption = fuelRefCapacityTons > 0 ? fuelConsumptionRef * Math.pow(1 + fuelSensitivity, (Number(weight) || 0) - fuelRefCapacityTons) : fuelConsumptionRef;
  // Base rate: the picked type's own rate, else the company default (else the initial "10").
  let baseRatePerKm = "10";
  if (!vehicleType) { if (Number(companyProfile.default_base_rate_per_km) > 0) baseRatePerKm = String(companyProfile.default_base_rate_per_km); }
  else {
    const vt = allVehicleTypes.find((v) => v.name === vehicleType) || vehicleTypes.find((v) => v.name === vehicleType);
    if (Number(vt?.base_rate) > 0) baseRatePerKm = String(vt.base_rate);
    else if (Number(companyProfile?.default_base_rate_per_km) > 0) baseRatePerKm = String(companyProfile.default_base_rate_per_km);
  }
  const route = routeData?.routes?.[routeData.best_index ?? 0] || null;
  const distance = route?.distance_km ?? routeData?.distance_km ?? 0;
  const legs = tripType === "ROUND_TRIP" ? 2 : 1;
  const chargeDistance = distance * legs;
  const fuelCost = Math.round(chargeDistance * fuelConsumption * fuelPricePerL / 100);
  const tollRate = Number(companyProfile?.default_toll_rate_per_km) || 0.95;
  const tollCost = Math.round((route?.toll_cost_zar ?? routeData?.toll_cost_zar ?? distance * tollRate) * legs);
  const crossBorderCost = ((routeData?.additional_costs?.border_fees || 0) + (routeData?.additional_costs?.weighbridge_fees || 0) + (routeData?.additional_costs?.non_sa_tolls || 0)) * legs;
  const driverAllowance = 0, serviceCharge = 0;
  const baseCost = Math.round(chargeDistance * Number(baseRatePerKm));
  const total = baseCost + fuelCost + tollCost + crossBorderCost + driverAllowance + serviceCharge;
  const isForeign = (c) => !!c && !["ZA", "ZAF"].includes(c.toUpperCase());
  const isInternational = !!routeData?.cross_border || (routeData?.countries || []).some(isForeign) || [scn.origin_country, scn.dest_country].some(isForeign);
  const excl = Math.round(total * 100) / 100;
  const vat = companyProfile?.vat_registered === false ? 0 : (isInternational ? 0 : Math.round(excl * 0.15 * 100) / 100);
  return {
    fuel_price_per_l: fuelPricePerL, fuel_basis_vt: fuelBasisVT?.name ?? null, fuel_cost: fuelCost, toll_cost: tollCost,
    cross_border_cost: Math.round(crossBorderCost * 100) / 100, base_rate_per_km: Number(baseRatePerKm), base_cost: baseCost,
    total_excl_vat: Math.round(total * 100) / 100, vat, total_incl_vat: Math.round((excl + vat) * 100) / 100,
    is_international: isInternational, fuel_l_per_100km: Math.round(fuelConsumption * 1e6) / 1e6,
  };
}

let failures = 0;
const rows = [];
for (const scn of fx.scenarios) {
  for (const trip of ["ONE_WAY", "ROUND_TRIP"]) {
    const got = builder(scn, trip);
    const exp = scn.expected[trip];
    for (const k of Object.keys(exp)) {
      const ok = typeof exp[k] === "number" ? Math.abs(got[k] - exp[k]) < 1e-6 : got[k] === exp[k];
      if (!ok) { failures++; console.error(`MISMATCH ${scn.key} ${trip} ${k}: got ${got[k]} expected ${exp[k]}`); }
    }
    if (trip === "ONE_WAY") rows.push(`${scn.key.padEnd(34)} fuel ${String(got.fuel_cost).padStart(6)}  tolls ${String(got.toll_cost).padStart(5)}  border ${String(got.cross_border_cost).padStart(8)}  base ${String(got.base_cost).padStart(6)}  total ${String(got.total_excl_vat).padStart(9)}  vat ${got.vat}`);
  }
}
console.log(rows.join("\n"));
assert.ok(lockOk, "QuoteBuilder cost formulas changed (see FORMULA LOCK above)");
assert.equal(failures, 0, `${failures} golden figure(s) differ`);
console.log(`OK: ${LOCKED.length} locked statements present; ${fx.scenarios.length} scenarios x 2 trip types match main.`);
