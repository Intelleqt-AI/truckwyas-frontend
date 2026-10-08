// Run: node --experimental-strip-types scripts/test-settings-checks.mjs
import assert from "node:assert/strict";
import { priceFieldError as e, ownPriceError as own, priceFieldErrors, fieldChanged } from "../src/lib/settingsChecks.ts";

assert.equal(e("fuel_price_electric", ""), null);
assert.equal(e("fuel_price_electric", "3,45"), null);
assert.match(e("fuel_price_electric", "25"), /R 20/);
assert.match(e("fuel_price_electric", "0"), /R 0/);
assert.match(e("fuel_price_hybrid", "abc"), /R 100/);
assert.equal(e("default_base_rate_per_km", "0"), null);
assert.match(e("default_base_rate_per_km", "1 200"), /R 1 000/);
assert.match(e("minimum_charge", "12x"), /rand/);
assert.equal(e("minimum_charge", "20 000"), null);
assert.match(own(""), /Official/);
assert.match(own("4,99"), /R 5 to R 100/);
assert.equal(own("32,80"), null);
// Toll rate: the server's R 0–R 50 bound.
assert.equal(e("default_toll_rate_per_km", "0,95"), null);
assert.equal(e("default_toll_rate_per_km", "50"), null);
assert.equal(e("default_toll_rate_per_km", "50,01"), "Enter a toll rate between R 0 and R 50 per km, or leave it empty.");
// Only changed values block; stored ones are hints (and are not re-sent).
const loaded = { fuel_price_electric: "25", default_base_rate_per_km: "10" };
const same = priceFieldErrors(["fuel_price_electric", "default_base_rate_per_km"], { ...loaded }, loaded);
assert.deepEqual(Object.keys(same.block), []); assert.deepEqual(Object.keys(same.hint), ["fuel_price_electric"]);
const edited = priceFieldErrors(["fuel_price_electric"], { fuel_price_electric: "30" }, loaded);
assert.deepEqual(Object.keys(edited.block), ["fuel_price_electric"]);
assert.equal(fieldChanged("fuel_price_electric", { fuel_price_electric: "25" }, loaded), false);
assert.equal(fieldChanged("fuel_price_electric", { fuel_price_electric: "3" }, loaded), true);
assert.equal(fieldChanged("fuel_price_electric", { fuel_price_electric: "3" }, null), true);
console.log("settingsChecks: 21 cases passed");
