import assert from 'node:assert/strict';
import { plazaMeta, tollVatBasis, routeChipLabel, borderKind, borderMeta, borderName, borderTotalWithAgentFee, borderEstimate, dayLabel } from '../src/lib/routeTolls.ts';

assert.equal(dayLabel('2026-03-01'), '1 Mar 2026');
assert.equal(tollVatBasis(false), 'excl. VAT');
assert.equal(tollVatBasis(true), "incl. VAT — you're not VAT registered");
assert.equal(plazaMeta({ plaza: 'Gosforth Ramp (W)', tariff: 28.7, plaza_type: 'ramp', operator: 'SANRAL', tariff_effective_from: '2026-03-01', currency: 'ZAR' }, 4),
  'Class 4 · SANRAL · ramp · from 1 Mar 2026');
assert.equal(plazaMeta({ plaza: 'Moamba', tariff: 458.64, plaza_type: 'mainline', operator: 'TRAC', currency: 'MZN', tariff_foreign: 1800,
  fx: { zar_per_unit: 0.2548, is_fallback: true, as_of: '2026-10-08' }, class_mapping_verified: false }, 4),
  'Class 4 (mapped) · TRAC · mainline · MZN 1 800 at R0,2548 (rate as of 8 Oct 2026)');
assert.equal(routeChipLabel({ toll_summary: 'Fastest · via N17/N3 (Gosforth Ramp (W), Wilge, Tugela, Mooi) · tolls R 887' }, 0), 'Fastest · via N17/N3 · tolls R 887');
assert.equal(routeChipLabel({ toll_cost_zar: 1020 }, 0), 'Fastest · tolls R 1 020');
assert.equal(routeChipLabel({ toll_summary: 'Alternative 2 · via N1 (Grasmere, Vaal) · tolls R\u00a0636,53 excl. VAT', toll_cost_zar: 636.53 }, 2), 'Alternative 2 · via N1 · tolls R 637');
assert.equal(routeChipLabel({ tolls_unknown: true }, 2), 'Alternative 2 · tolls unknown');
assert.equal(routeChipLabel({ toll_summary: 'Fastest · no toll plazas · tolls R 0,00 excl. VAT', toll_cost_zar: 0, countries: ['SA', 'BW', 'NA'] }, 0), 'Fastest · no toll plazas · tolls R 0 · through Botswana');

const zw = [
  { code: 'zw_border_access_toll', description: 'Zimbabwe border access toll, Beitbridge (estimate)', amount: 6239.66, currency: 'USD', amount_foreign: 375,
    fx: { zar_per_unit: 16.6391, as_of: '2026-10-08', is_fallback: false }, verified: false, label: 'estimate', as_of: '2026-04-28' },
  { code: 'zw_clearing_agent', description: 'Clearing agent, Beitbridge (estimate)', amount: 2005, currency: 'ZAR', verified: false, label: 'estimate', source: "Agent estimate — enter your agent's fee" },
  { code: 'na_cbc', description: 'Namibia cross-border charge', amount: 4123, currency: 'NAD', amount_foreign: 4123, fx: { zar_per_unit: 1 }, verified: true, label: 'published', as_of: '2026-08-01' },
  { code: 'ls_entry', description: 'Lesotho entry (unverified)', amount: 650, verified: false, label: 'unverified' },
];
assert.deepEqual(zw.map(borderKind), ['estimate', 'agent', 'published', 'unverified']);
assert.equal(borderMeta(zw[0]), 'USD 375 at R16,6391 · as of 28 Apr 2026');
assert.equal(borderName(zw[0]), 'Zimbabwe border access toll, Beitbridge');
assert.equal(borderTotalWithAgentFee(zw.slice(0, 2), 8244.66, null), 8244.66);
assert.equal(borderTotalWithAgentFee(zw.slice(0, 2), 8244.66, 3500), 9739.66);
assert.equal(borderTotalWithAgentFee([zw[0]], 6239.66, 3500), 6239.66, 'no agent line');
assert.equal(borderEstimate(zw, null), 8894.66);
assert.equal(borderEstimate(zw, 3500), 6889.66, 'your agent fee is not an estimate');
console.log('routeTolls: 20 cases passed');
