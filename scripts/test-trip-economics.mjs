// Run: node --experimental-strip-types scripts/test-trip-economics.mjs
// Trip economics display rules: margins, pair sums, booking choice, banners.
import assert from "node:assert/strict";
import {
  pctText, ptsText, marginText, costBasisLabel, emptyReturnNote, missingPrompts, combineLegs,
  returnChoiceRequest, linkWarnings, linkRefusal, invoiceWhenText, invoiceMismatchText, actualsText,
  returnHistoryText, candidateFit, candidateSummary,
} from "../src/lib/tripEconomics.ts";

const sp = (s) => (s == null ? s : s.replace(/ /g, " "));
let n = 0;
const eq = (a, b, m) => { assert.equal(a, b, m); n++; };

eq(pctText(-18.68), "−19%");
eq(pctText(8.5), "9%");
eq(pctText(null), "—");
eq(ptsText(4.41), "+4,4 pts");
eq(ptsText(-3), "−3 pts");
eq(ptsText(0.02), "0 pts");
eq(sp(marginText(2710.4, 8.3)), "R 2 710 · 8%");
eq(marginText(null, 8), null);
eq(costBasisLabel({ cost_basis: "actual", estimate_label: "x", estimate_basis: "snapshot" }), "Actual costs");
eq(costBasisLabel({ cost_basis: "estimate", estimate_label: "Quote costing, no empty return (return load linked)", estimate_basis: "snapshot_return_linked" }),
  "Estimate · no empty return");
eq(costBasisLabel({ cost_basis: "estimate", estimate_label: "Quote costing", estimate_basis: "snapshot" }), "Estimate · quote costing");
eq(costBasisLabel({ cost_basis: "estimate", estimate_label: "Odd", estimate_basis: "new_kind" }), "Estimate · Odd");
eq(costBasisLabel({ cost_basis: null, estimate_label: "No estimate", estimate_basis: "unknown" }), "No estimate");

// The empty-return note only for a pair that removed something.
eq(emptyReturnNote({ pair: false, combined: { empty_return_removed: 100 } }), null);
eq(emptyReturnNote({ pair: true, combined: { empty_return_removed: 0 } }), null);
eq(sp(emptyReturnNote({ pair: true, combined: { empty_return_removed: 29323.2 } })), "Empty return removed: return load linked (R 29 323 less cost)");

// Missing prompts: each once across both legs.
const miss = missingPrompts({ legs: [
  { missing: [{ code: "no_vehicle", prompt: "Add the truck to cost this job" }] },
  { missing: [{ code: "no_vehicle", prompt: "Add the truck to cost this job" }, { code: "tolls_unknown", prompt: "Add the tolls (or confirm none) to cost this job" }] },
] });
eq(miss.length, 2);
eq(miss[0].prompt, "Add the truck to cost this job");

// Hand-checked pair (seeded JHB→DBN R 32 500 + DBN→JHB R 21 500, both quoted
// with an empty return: floor R 29 789,99, of which R 14 661,60 empty return).
const legs = [
  { revenue: 32500, cost: 15128.39, quoted: { price: 32500, cost_floor: 29789.99 } },
  { revenue: 21500, cost: 15128.39, quoted: { price: 21500, cost_floor: 29789.99 } },
];
const c = combineLegs(legs);
eq(c.revenue, 54000);
eq(c.cost, 30256.78);
eq(c.margin, 23743.22);
eq(c.marginPct, 43.97);
eq(c.quotedMarginPct, -10.33);
eq(combineLegs([{ revenue: 100, cost: null, quoted: { price: 100, cost_floor: 50 } }]).margin, null, "no cost, no margin");

// The booking choice maps to one idempotent request.
eq(returnChoiceRequest({ kind: "none" }, 26, 40), null);
assert.deepEqual(returnChoiceRequest({ kind: "return", loadId: 29 }, 26, 40), { url: "api/v1/loads/40/link-return/", data: { return_load_id: 29 } }); n++;
assert.deepEqual(returnChoiceRequest({ kind: "outbound", loadId: 7 }, 26, 40), { url: "api/v1/quotes/26/convert_to_load/", data: { return_of_load_id: 7 } }); n++;
assert.deepEqual(returnChoiceRequest({ kind: "expect" }, 26, 40), { url: "api/v1/quotes/26/convert_to_load/", data: { expect_return: true } }); n++;
eq(linkWarnings({ warnings: [{ code: "long_gap", title: "Long wait before the return" }] }).length, 1);
eq(linkWarnings({ booking: { return_link: { linked: true, warnings: [{ code: "x", title: "T" }] } } })[0].title, "T");
eq(linkWarnings(null).length, 0);
eq(linkRefusal({ booking: { return_link: { linked: false, error: "outbound_has_return", detail: "LOAD-1 already has a return load." } } }), "LOAD-1 already has a return load.");
eq(linkRefusal({ booking: { return_link: { linked: true } } }), null);

// Candidates.
eq(candidateFit({ reverses_lane: true, pickup_km_from_drop: 0 }), "Reverses the lane");
eq(candidateFit({ reverses_lane: false, pickup_km_from_drop: 42.4 }), "Collects 42 km from the drop");
eq(candidateFit({}), null);
eq(sp(candidateSummary({ pickup: "Durban", delivery: "Johannesburg", pickup_date: "2026-10-12T00:00:00+02:00", total_amount: 21500 })), "Durban → Johannesburg · 12 Oct · R 21 500");

// Invoice preview wording.
eq(invoiceWhenText({ state: "on_delivery", terms_days: 30, auto_email: false }), "Raised on delivery · 30 days · you send it");
eq(invoiceWhenText({ state: "on_delivery", terms_days: 0, auto_email: true }), "Raised on delivery · due on receipt · emailed to the customer");
eq(invoiceWhenText({ state: "raised", invoice_number: "INV-0042" }), "Invoice INV-0042 raised");

// Invoice mismatch banner.
eq(invoiceMismatchText({}), null);
const mm = invoiceMismatchText({ code: "invoice_differs_from_rate", invoice_number: "INV-7", invoice_excl_vat: 31800, load_total_excl_vat: 32700, difference: 900 });
eq(sp(mm.detail), "Invoice INV-7 is R 31 800 excl. VAT; the job is now R 32 700 (R 900 more). Issue a credit note or a new invoice.");

// Quote actuals.
eq(actualsText(null), null);
const a = actualsText({ actual_margin_pct: 6.32, actual_revenue: 31800, actual_cost: 29789.99, actual_cost_basis: "estimate", backhaul_found: false });
eq(sp(a.line), "Actual margin R 2 010 · 6%");
eq(a.basis, "Estimated costs · came back empty");
eq(actualsText({ actual_margin_pct: null, actual_revenue: 100, actual_cost: null, actual_cost_basis: "" }), null);

eq(returnHistoryText({ text: "On this lane 60% of your trips found a return load (3 of 5)." }), "On this lane 60% of your trips found a return load (3 of 5).");
eq(returnHistoryText({ text: null }), null);
eq(returnHistoryText(null), null);

console.log(`tripEconomics: ${n} cases passed`);
