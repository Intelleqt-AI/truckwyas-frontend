import assert from 'node:assert/strict';
import { borderCostsUnknown } from '../src/lib/borderUnknown.ts';
import { compute } from '../src/lib/quoteRules.ts';

const breakdown = [
  { type: 'border_crossing', description: 'South Africa → Namibia border crossing (Vioolsdrif)', amount: 1200 },
  { type: 'sa_permit', description: 'SA cross-border permit (C-BRTA)', amount: 450 },
];
const bu = borderCostsUnknown({ countries: ['AO'], crossings: ['NA-AO'] }, breakdown);
assert.deepEqual(bu, { countries: ['Angola'], crossings: ['Namibia→Angola'],
  known: [{ label: 'South Africa→Namibia', amount: 1200 }, { label: 'permit', amount: 450 }] });
assert.equal(borderCostsUnknown({ countries: [], crossings: [] }, breakdown), null, 'all known');
assert.equal(borderCostsUnknown(null), null);
assert.deepEqual(borderCostsUnknown({ countries: ['Angola'], crossings: [], known: [{ label: 'x', amount: '5' }, { label: 'y' }] }).known, [{ label: 'x', amount: 5 }]);

// Cape Town -> Ondjiva: blocked until the border costs are entered (then complete).
const trip = { trip_type: 'ONE_WAY', distance_km: 2500, duration_minutes: 2000, load_kg: 15000,
  vehicle: { id: 1, name: 'Tri-axle', capacity: 30, rated_burn_l_per_100km: 38 },
  diesel: { zone: 'COASTAL', mode: 'LIVE', official_price: 31.5 }, operating_cost_per_km: 14,
  tolls: { one_way: 0 }, driver: { allowance_per_night: 487.05 }, international: true, target_margin_pct: 10,
  border_cost: 1650, border_costs_unknown: bu, include_empty_return: false };
const blocked = compute(trip);
assert.equal(blocked.floor, null);
const w = blocked.warnings.find((x) => x.code === 'border_costs_missing');
assert.equal(w.severity, 'block');
assert.equal(w.title, 'Border costs for Angola not known');
assert.equal(w.detail, 'Known: South Africa→Namibia R 1 200,00 + permit R 450,00; missing: Namibia→Angola');
const typed = compute({ ...trip, border_cost: 9800, border_cost_is_override: true });
assert.ok(typed.floor > 0);
assert.equal(typed.lines.find((l) => l.key === 'border').amount, 9800);
assert.ok(!typed.warnings.some((x) => x.code === 'border_costs_missing'));
console.log('borderUnknown: 9 cases passed');
