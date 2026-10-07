// Run: node --experimental-strip-types scripts/test-quote-rules.mjs
// Builder helpers in src/lib/quoteRules.ts not covered by the golden vectors
// (scripts/test-quote-golden.mjs covers compute()).
import assert from "node:assert/strict";
import { suggestTruck, capacityTonnes, nightsAway, vehicleClass, cents } from "../src/lib/quoteRules.ts";

const cases = [];
const t = (name, fn) => { fn(); cases.push(name); };

t("capacity: > 100 is kg", () => {
  assert.equal(capacityTonnes(34000), 34); assert.equal(capacityTonnes("30"), 30); assert.equal(capacityTonnes(101), 0.101);
  assert.equal(capacityTonnes(0), null); assert.equal(capacityTonnes(null), null);
});
t("suggested truck (§3): smallest that fits, tie -> lowest burn; none fits -> null", () => {
  const types = [{ id: 1, name: "A", capacity: 34000, fuel_consumption_l_per_100km: 48 }, { id: 2, name: "B", capacity: 14, fuel_consumption_l_per_100km: 30 },
    { id: 3, name: "C", capacity: 30, fuel_consumption_l_per_100km: 42 }, { id: 4, name: "D", capacity: 30, fuel_consumption_l_per_100km: 38 },
    { id: 5, name: "E", capacity: 10, fuel_consumption_l_per_100km: null }];
  assert.equal(suggestTruck(types, 8).name, "B");
  assert.equal(suggestTruck(types, 20).name, "D");
  assert.equal(suggestTruck(types, 31).name, "A");
  assert.equal(suggestTruck(types, 50), null);
});
t("nights away: driving days - 1 at 9 h/day", () => {
  assert.equal(nightsAway(3), 0); assert.equal(nightsAway(9), 0); assert.equal(nightsAway(9.5), 1); assert.equal(nightsAway(20), 2);
  assert.equal(nightsAway(null), null);
});
t("vehicle class (operating cost)", () => {
  assert.equal(vehicleClass("Superlink Tautliner", 34), "superlink");
  assert.equal(vehicleClass("Thing", 14000), "rigid");
});
t("cents: floor(x * 100 + 0.5) / 100", () => {
  assert.equal(cents(1.005), 1); assert.equal(cents(2.675), 2.68); assert.equal(cents(-1.005), -1);
});

console.log(`quoteRules helpers: ${cases.length} cases passed`);
