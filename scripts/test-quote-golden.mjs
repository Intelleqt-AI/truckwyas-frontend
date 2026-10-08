// Run: node --experimental-strip-types scripts/test-quote-golden.mjs
// QUOTE-RULES.md §12: the local calculator (src/lib/quoteRules.ts) over the
// backend's golden vectors. scripts/fixtures/quote_golden.json is a byte-for-
// byte copy of pricing-backend/core/tests/fixtures/quote_golden.json; set
// QUOTE_GOLDEN_BACKEND=<path> to also check the copy is still identical.
//
// Compared per the file's own `rules.compare`: line amounts, floor,
// floor_known, target_price and margin exact to the cent; warnings by code,
// severity and impact_zar; litres and burn within 1e-9. Every other field of
// `expected` is compared too (strings exactly), so drift is caught early.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compute, changesSincePriced, computeTonnage } from "../src/lib/quoteRules.ts";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "fixtures/quote_golden.json");
const raw = readFileSync(file, "utf8");
const backend = process.env.QUOTE_GOLDEN_BACKEND;
if (backend && existsSync(backend)) assert.equal(raw, readFileSync(backend, "utf8"), "fixture differs from the backend's golden file");
const golden = JSON.parse(raw);
assert.ok(golden.cases.length >= 12, "at least 12 golden cases");

const TOL = /(^|\.)(litres|loaded|empty_return|total|burn_l_per_100km|burn_loaded_l_per_100km|burn_empty_l_per_100km|load_ratio|hours_one_way|margin_pct|margin_then|margin_now|km|km_loaded|km_empty|km_driven)$/;
const COPY = /(\.basis|\.detail)$/;   // server copy: reported, not failed
const copyDiffs = [];

function cmp(exp, got, path) {
  if (exp === null || typeof exp !== "object") {
    if (typeof exp === "number" && typeof got === "number") {
      if (TOL.test(path)) assert.ok(Math.abs(exp - got) <= 1e-9, `${path}: expected ${exp}, got ${got}`);
      else assert.equal(got, exp, `${path}: expected ${exp}, got ${got}`);
      return;
    }
    if (typeof exp === "string" && COPY.test(path)) { if (exp !== got) copyDiffs.push(`${path}: "${exp}" vs "${got}"`); return; }
    assert.equal(got, exp, `${path}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(got)}`);
    return;
  }
  if (Array.isArray(exp)) {
    assert.ok(Array.isArray(got), `${path}: expected an array`);
    assert.equal(got.length, exp.length, `${path}: expected ${exp.length} items, got ${got.length} (${JSON.stringify(got.map((x) => x?.key ?? x?.code ?? x))})`);
    exp.forEach((e, k) => cmp(e, got[k], `${path}[${k}]`));
    return;
  }
  assert.ok(got && typeof got === "object", `${path}: expected an object`);
  for (const k of Object.keys(exp)) cmp(exp[k], got[k], path ? `${path}.${k}` : k);
}

let n = 0;
for (const c of golden.cases) {
  const got = JSON.parse(JSON.stringify(compute(c.inputs)));
  try { cmp(c.expected, got, ""); } catch (e) { e.message = `${c.name}: ${e.message}`; throw e; }
  n++;
}
let r = 0;
for (const c of golden.reopen_cases ?? []) {
  const i = c.inputs;
  const got = JSON.parse(JSON.stringify(changesSincePriced(i.price, i.floor_then, i.floor_now, i.priced_at)));
  try { cmp(c.expected, got, ""); } catch (e) { e.message = `reopen ${c.name}: ${e.message}`; throw e; }
  r++;
}
let t = 0;
for (const c of golden.tonnage_cases ?? []) {
  const got = JSON.parse(JSON.stringify(computeTonnage(c.inputs)));
  try { cmp(c.expected, got, ""); } catch (e) { e.message = `tonnage ${c.name}: ${e.message}`; throw e; }
  t++;
}
assert.ok(t >= 8, "at least 8 tonnage cases");
if (copyDiffs.length) console.log(`(copy differences, not compared: ${copyDiffs.length})\n  ${copyDiffs.slice(0, 10).join("\n  ")}`);
console.log(`quote golden vectors: ${n} cases, ${r} reopen cases and ${t} tonnage cases match to the cent`);
