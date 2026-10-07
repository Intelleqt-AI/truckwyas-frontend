// Run: node --experimental-strip-types scripts/test-diesel-short.mjs
// Insights "Quotes short on diesel": like-for-like snapshot comparison.
import assert from "node:assert/strict";
import { dieselShortRows } from "../src/components/insights/dieselShort.ts";

const official = { INLAND: 32.8, COASTAL: 31.9 };
const open = () => true;
const base = { status: "SENT", valid_until: "2026-10-20", fuel_zone: "INLAND", fuel_official_at_pricing: "30.80", fuel_litres: "200.000" };
const rows = dieselShortRows([
  { id: 1, ...base },                                                      // inland, 2,00 short x 200 L
  { id: 2, ...base, fuel_zone: "COASTAL", fuel_official_at_pricing: 31.0 }, // coastal compared to coastal: 0,90 x 200
  { id: 3, ...base, fuel_official_at_pricing: null },                      // no snapshot: skipped
  { id: 4, ...base, fuel_zone: "" },                                       // no zone: skipped
  { id: 5, ...base, fuel_litres: null, fuel_price_at_creation: 20 },        // no litres: skipped (never the old field)
  { id: 6, ...base, valid_until: "2026-10-01" },                           // expired: skipped
  { id: 7, ...base, fuel_official_at_pricing: 32.7 },                      // under 0,20: skipped
  { id: 8, ...base, status: "ACCEPTED" },                                  // accepted, job open
], official, "2026-10-07", open);
assert.deepEqual(rows.map((r) => r.q.id), [1, 2, 8]);
assert.ok(Math.abs(rows[0].short - 400) < 1e-9);
assert.ok(Math.abs(rows[1].short - 180) < 1e-9);
assert.equal(rows[1].zone, "COASTAL");
assert.deepEqual(dieselShortRows([{ id: 8, ...base, status: "ACCEPTED" }], official, "2026-10-07", () => false), []);
console.log("dieselShort: 1 suite passed");
