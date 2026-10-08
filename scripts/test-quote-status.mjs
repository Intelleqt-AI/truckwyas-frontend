// Run: node --experimental-strip-types scripts/test-quote-status.mjs
// Incomplete quotes (no "R 0") and the own-diesel impact line.
import assert from "node:assert/strict";
import { quoteIncomplete, quoteTollsUnknown, ownDieselImpactText } from "../src/lib/quoteStatus.ts";

assert.equal(quoteIncomplete({ total_amount: "0.00" }), true);
assert.equal(quoteIncomplete({ total_amount: null }), true);
assert.equal(quoteIncomplete({ total_amount: "23400.00", customer_price: null }), true);
assert.equal(quoteIncomplete({ total_amount: "23400.00", customer_price: { total_incl_vat: "26910.00" } }), false);
assert.equal(quoteIncomplete({ total_amount: 23400 }), false);
assert.equal(quoteIncomplete({ total_amount: 24300, costing_inputs: { tolls_unknown: true } }), true, "priced, tolls unknown");
assert.equal(quoteIncomplete({ total_amount: 24300, costing_inputs: { tolls_unknown: true, tolls_confirmed_none: true } }), false);
assert.equal(quoteIncomplete({ total_amount: 24800, pricing_complete: false }), true, "border costs unknown");
assert.equal(quoteTollsUnknown({ costing_inputs: { tolls_unknown: false, toll_cost_one_way: 0 } }), false, "a known R 0");
assert.equal(ownDieselImpactText({ code: "diesel_own_off", impact_zar: -1333.4 }), "R 1 333 below official on this quote.");
assert.equal(ownDieselImpactText({ code: "diesel_own_off", impact_zar: 257.5 }), "R 258 above official on this quote.");
assert.equal(ownDieselImpactText({ code: "diesel_own_off", impact_zar: null }), null);
assert.equal(ownDieselImpactText({ code: "diesel_stale", impact_zar: -10 }), null);
console.log("quoteStatus: 13 cases passed");
