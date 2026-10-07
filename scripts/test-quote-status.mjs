// Run: node --experimental-strip-types scripts/test-quote-status.mjs
// Incomplete quotes (no "R 0") and the own-diesel impact line.
import assert from "node:assert/strict";
import { quoteIncomplete, ownDieselImpactText } from "../src/lib/quoteStatus.ts";

assert.equal(quoteIncomplete({ total_amount: "0.00" }), true);
assert.equal(quoteIncomplete({ total_amount: null }), true);
assert.equal(quoteIncomplete({ total_amount: "23400.00", customer_price: null }), true);
assert.equal(quoteIncomplete({ total_amount: "23400.00", customer_price: { total_incl_vat: "26910.00" } }), false);
assert.equal(quoteIncomplete({ total_amount: 23400 }), false);
assert.equal(ownDieselImpactText({ code: "diesel_own_off", impact_zar: -1333.4 }), "R 1 333 below official on this quote.");
assert.equal(ownDieselImpactText({ code: "diesel_own_off", impact_zar: 257.5 }), "R 258 above official on this quote.");
assert.equal(ownDieselImpactText({ code: "diesel_own_off", impact_zar: null }), null);
assert.equal(ownDieselImpactText({ code: "diesel_stale", impact_zar: -10 }), null);
console.log("quoteStatus: 9 cases passed");
