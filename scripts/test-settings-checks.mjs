// Run: node --experimental-strip-types scripts/test-settings-checks.mjs
import assert from "node:assert/strict";
import { priceFieldError as e, ownPriceError as own, priceFieldErrors, fieldChanged, fuelChangeSummary } from "../src/lib/settingsChecks.ts";

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
// Fuel change confirmation (owner's wording).
const live = { fuel_price_mode: "LIVE", fuel_price_own: "", fuel_price_petrol_mode: "LIVE", fuel_price_petrol: "", fuel_price_petrol_grade: "95" };
const toOwn = fuelChangeSummary(live, { ...live, fuel_price_mode: "OWN", fuel_price_own: "29.11" }, { diesel: 32.8, petrol: 26.92 }, true);
assert.equal(toOwn.message, "New quotes will use your own diesel price of R 29,11/L instead of the official R 32,80/L (R 3,69/L less). Quotes already sent keep their price; open drafts update when you open them.");
assert.equal(toOwn.confirmLabel, "Save and use R 29,11");
assert.equal(toOwn.toast, "Saved. New quotes use your own diesel price of R 29,11/L.");
const ownForm = { ...live, fuel_price_mode: "OWN", fuel_price_own: "29.11" };
const back = fuelChangeSummary(ownForm, { ...ownForm, fuel_price_mode: "LIVE" }, { diesel: 32.8, petrol: null }, true);
assert.equal(back.message.startsWith("New quotes will use the official diesel price of R 32,80/L instead of your own R 29,11/L."), true);
assert.equal(back.confirmLabel, "Save and use official");
const grade = fuelChangeSummary(live, { ...live, fuel_price_petrol_grade: "93" }, { diesel: 32.8, petrol: 26.5 }, true);
assert.match(grade.message, /official petrol ULP 93 price of R 26,50\/L/);
assert.equal(fuelChangeSummary(live, { ...live }, { diesel: 32.8, petrol: 26.9 }, true), null);
assert.equal(fuelChangeSummary(ownForm, { ...ownForm }, { diesel: 32.8, petrol: 26.9 }, true), null);
console.log("settingsChecks: 30 cases passed");
