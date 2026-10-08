// Run: node --experimental-strip-types scripts/test-tonnage.mjs
// Tonnage display helpers (src/lib/tonnage.ts): SA format, basis reason, periods.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fmtTonnes, fmtRatePerTonne, periodText, basisReason, contractPct, loadsText } from "../src/lib/tonnage.ts";
import { computeTonnage } from "../src/lib/quoteRules.ts";

assert.equal(fmtTonnes(30), "30 t");
assert.equal(fmtTonnes("22.75"), "22,75 t");
assert.equal(fmtTonnes(27.5), "27,5 t");
assert.equal(fmtTonnes(1250.4), "1 250,4 t");
assert.equal(fmtTonnes(null), "—");
assert.equal(fmtRatePerTonne(1300), "R 1 300/t");
assert.equal(fmtRatePerTonne("1300.50"), "R 1 300,50/t");
assert.equal(periodText("2026-10-01", "2026-12-31"), "1 Oct to 31 Dec 2026");
assert.equal(periodText("2026-11-01", "2027-02-28"), "1 Nov 2026 to 28 Feb 2027");
assert.equal(periodText(null, null), null);
assert.equal(loadsText(1), "1 load");
assert.equal(loadsText(20), "20 loads");
assert.equal(contractPct({ total_tonnes: 600, booked_tonnes: 150 }), 25);

const golden = JSON.parse(readFileSync(new URL("./fixtures/quote_golden.json", import.meta.url), "utf8"));
const byName = Object.fromEntries(golden.tonnage_cases.map((c) => [c.name, c]));
const safest = computeTonnage(byName.truck_unknown_three_eligible_safest.inputs).tonnage;
assert.equal(basisReason(safest), "Priced on Superlink 34 t: highest cost per tonne, so any truck covers it.");
const chosen = computeTonnage(byName.chosen_truck.inputs).tonnage;
assert.equal(basisReason(chosen), "Priced on Tri-axle 30 t, your choice.");
// The rate_below_cost warning: the loss in rand and "Price at target · R x/t".
const below = computeTonnage(byName.rate_below_cost.inputs);
const w = below.warnings.find((x) => x.code === "rate_below_cost");
assert.equal(w.severity, "warn");
assert.match(w.detail, /this loses R 9 530\.$/);
assert.deepEqual(w.actions, [{ id: "use_target_rate", label: "Price at target · R 1 242/t" }]);
assert.equal(below.can_send, true);
for (const c of golden.tonnage_cases) {
  for (const x of computeTonnage(c.inputs).warnings) {
    assert.ok(!/[—–]/.test(`${x.title} ${x.detail}`), `no dashes in copy: ${x.code}`);
  }
}
console.log("tonnage helpers: ok");
