// Run: node --experimental-strip-types scripts/test-settings-checks.mjs
import assert from "node:assert/strict";
import { priceFieldError as e, ownPriceError as own } from "../src/lib/settingsChecks.ts";

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
console.log("settingsChecks: 12 cases passed");
