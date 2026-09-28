import { useSearchParams } from 'react-router-dom';
import {
  CATEGORY_LABEL, DIRECT, OVERHEADS, catLabel, inPeriod, isApproved, isIssued, isPending, monthLabel, monthsIn,
  money, num, periodText, plural, priorPeriod, shownMonths, trimNote, vatShare, ymOf, type Ledger, type Period,
} from './data';
import { Check, Choice, Info, PeriodControl, ReportFrame, StatementTable, statementCsv, usePeriod, type SRow, type Statement } from './ui';

type Basis = 'cash' | 'invoice';
type Range = { from: string; to: string };

/** Revenue excluding VAT by month, on the chosen basis. */
function revenue(d: Ledger, basis: Basis, r: Range) {
  const byMonth = new Map<string, number>();
  let excl = 0; let vat = 0; let count = 0;
  const invById = new Map(d.invoices.map(i => [i.id, i]));
  if (basis === 'cash') {
    d.payments.filter(p => inPeriod(p.payment_date, r)).forEach(p => {
      const amt = num(p.amount);
      const v = amt * vatShare(p.invoice != null ? invById.get(p.invoice) : undefined);
      const m = ymOf(p.payment_date);
      byMonth.set(m, (byMonth.get(m) || 0) + amt - v);
      excl += amt - v; vat += v; count += 1;
    });
  } else {
    d.invoices.filter(i => isIssued(i) && inPeriod(i.issue_date, r)).forEach(i => {
      const t = num(i.total_amount); const v = num(i.vat_amount);
      const m = ymOf(i.issue_date);
      byMonth.set(m, (byMonth.get(m) || 0) + t - v);
      excl += t - v; vat += v; count += 1;
    });
  }
  return { byMonth, excl, vat, incl: excl + vat, count };
}

/** Approved costs by category and month. */
function costs(d: Ledger, r: Range) {
  const byCat = new Map<string, Map<string, number>>();
  d.expenses.filter(e => isApproved(e) && inPeriod(e.expense_date, r)).forEach(e => {
    const c = (e.category || 'OTHER').toUpperCase();
    const m = ymOf(e.expense_date);
    const row = byCat.get(c) || new Map<string, number>();
    row.set(m, (row.get(m) || 0) + num(e.amount));
    byCat.set(c, row);
  });
  return byCat;
}
const sumMap = (m?: Map<string, number>) => [...(m?.values() ?? [])].reduce((s, v) => s + v, 0);

export default function ProfitLoss({ d, companyName }: { d: Ledger; companyName?: string }) {
  const [period, setPeriod] = usePeriod('last-12');
  const [params, setParams] = useSearchParams();
  const basis: Basis = params.get('basis') === 'invoice' ? 'invoice' : 'cash';
  const setBasis = (b: Basis) => setParams(p => { const n = new URLSearchParams(p); if (b === 'cash') n.delete('basis'); else n.set('basis', b); return n; }, { replace: true });

  const t = build(d, period, basis);
  const basisText = basis === 'cash' ? 'Excl. VAT, cash basis' : 'Excl. VAT, invoice basis';

  return (
    <ReportFrame
      title="Profit and loss"
      sub={`${periodText(period)} · ${basisText}`}
      companyName={companyName}
      info={<Info title="Profit and loss" lines={[
        basis === 'cash'
          ? 'Revenue: money received from customers, by payment date, excluding the VAT share of each invoice.'
          : 'Revenue: invoices issued (not drafts or cancelled), by issue date, excluding VAT.',
        'Costs: approved expenses by expense date, as captured. VAT on costs is not recorded separately.',
        'Direct costs: fuel, tolls, driver costs, maintenance. Overheads: insurance, admin and the rest.',
        'Pending expenses are listed below the result and not deducted.',
        'Prior: the same number of months immediately before. No credit notes are recorded in TruckWys.',
      ]} />}
      controls={<>
        <PeriodControl period={period} onChange={setPeriod} />
        <Choice label="Basis" value={basis} onChange={setBasis} options={[{ id: 'cash', label: 'Cash basis' }, { id: 'invoice', label: 'Invoice basis' }]} />
      </>}
      gaps={[...(t.trimmed ? [t.trimmed] : []), 'VAT on expenses is not captured, so costs are shown as entered.']}
      csv={() => statementCsv(`Profit and loss, ${periodText(period)}`, basisText, t.table)}
      csvName={`profit-and-loss-${period.from}-to-${period.to}-${basis}`}
    >
      <StatementTable
        table={t.table}
        caption={`Profit and loss, ${periodText(period)}`}
        footer={t.check}
        scrollEnd
      />
    </ReportFrame>
  );
}

function build(d: Ledger, period: Period, basis: Basis) {
  const allMonths = monthsIn(period.from, period.to);
  const prior = priorPeriod(period);
  const priorLabel = `prior ${plural(allMonths.length, 'month')}`;
  const rNow = revenue(d, basis, period);
  const rPrev = revenue(d, basis, prior);
  const cNow = costs(d, period);
  const cPrev = costs(d, prior);
  const pendingList = d.expenses.filter(e => isPending(e) && inPeriod(e.expense_date, period));
  const pendingByMonth = new Map<string, number>();
  pendingList.forEach(e => { const m = ymOf(e.expense_date); pendingByMonth.set(m, (pendingByMonth.get(m) || 0) + num(e.amount)); });
  const pendingPrev = d.expenses.filter(e => isPending(e) && inPeriod(e.expense_date, prior)).reduce((s, e) => s + num(e.amount), 0);

  // Columns end at the last month with any entry (revenue, cost or pending);
  // totals still cover the whole period. The prior-period comparison is shown
  // only when the prior period holds entries, otherwise Change would just
  // repeat Total.
  const months = shownMonths(allMonths, m => rNow.byMonth.has(m) || pendingByMonth.has(m) || [...cNow.values()].some(x => x.has(m)));
  const showPrior = rPrev.count > 0 || cPrev.size > 0 || pendingPrev > 0.005;
  const known = new Set([...DIRECT, ...OVERHEADS]);
  const extra = [...new Set([...cNow.keys(), ...cPrev.keys()])].filter(c => !known.has(c)).sort();
  const direct = DIRECT;
  const overheads = [...OVERHEADS, ...extra];

  const line = (label: string, get: (m: string) => number, now: number, prev: number, kind: SRow['kind'] = 'row', indent = false): SRow => ({
    key: `${kind}-${label}`, kind, indent,
    cells: [label, ...months.map(get), now, ...(showPrior ? [prev, now - prev] : [])],
  });
  const catRow = (c: string) => line(CATEGORY_LABEL[c] ?? catLabel(c), m => cNow.get(c)?.get(m) || 0, sumMap(cNow.get(c)), sumMap(cPrev.get(c)), 'row', true);
  const group = (cats: string[], map: Map<string, Map<string, number>>) => ({
    m: (month: string) => cats.reduce((s, c) => s + (map.get(c)?.get(month) || 0), 0),
    total: cats.reduce((s, c) => s + sumMap(map.get(c)), 0),
  });
  const dNow = group(direct, cNow); const dPrev = group(direct, cPrev);
  const oNow = group(overheads, cNow); const oPrev = group(overheads, cPrev);
  const rev = rNow.excl; const prevRev = rPrev.excl;
  const gross = rev - dNow.total; const prevGross = prevRev - dPrev.total;
  const net = gross - oNow.total; const prevNet = prevGross - oPrev.total;
  const revM = (m: string) => rNow.byMonth.get(m) || 0;
  const grossM = (m: string) => revM(m) - dNow.m(m);
  const netM = (m: string) => grossM(m) - oNow.m(m);
  const ratio = (label: string, f: (m: string) => number, now: number, prev: number): SRow => ({
    key: `ratio-${label}`, kind: 'ratio', fmt: 'pct',
    cells: [label, ...months.map(m => (revM(m) > 0 ? (f(m) / revM(m)) * 100 : null)), rev > 0 ? (now / rev) * 100 : null, ...(showPrior ? [prevRev > 0 ? (prev / prevRev) * 100 : null, null] : [])],
  });

  const rows: SRow[] = [
    { key: 's-rev', kind: 'section', cells: ['Revenue'] },
    line('Sales', revM, rev, prevRev, 'row', true),
    line('Total revenue', revM, rev, prevRev, 'subtotal'),
    { key: 's-direct', kind: 'section', cells: ['Direct costs'] },
    ...direct.map(catRow),
    line('Total direct costs', dNow.m, dNow.total, dPrev.total, 'subtotal'),
    line('Gross profit', grossM, gross, prevGross, 'total'),
    ratio('Gross margin', grossM, gross, prevGross),
    { key: 's-over', kind: 'section', cells: ['Overheads'] },
    ...overheads.map(catRow),
    line('Total overheads', oNow.m, oNow.total, oPrev.total, 'subtotal'),
    line('Net profit', netM, net, prevNet, 'grand'),
    ratio('Net margin', netM, net, prevNet),
    line(`Pending approval, not deducted (${pendingList.length})`, m => pendingByMonth.get(m) || 0, pendingList.reduce((s, e) => s + num(e.amount), 0), pendingPrev, 'muted'),
  ];

  const table: Statement = {
    columns: [
      { label: 'Account' },
      ...months.map(m => ({ label: monthLabel(m), type: 'money' as const })),
      { label: 'Total', type: 'money' },
      ...(showPrior ? [
        { label: `Prior ${allMonths.length} months`, type: 'money' as const },
        { label: 'Change', type: 'money' as const },
      ] : []),
    ],
    rows,
  };

  const check = basis === 'cash'
    ? <Check>Total revenue plus VAT {money(rNow.vat)} equals {money(rNow.incl)} received, {plural(rNow.count, 'payment')}.</Check>
    : <Check>Total revenue plus VAT {money(rNow.vat)} equals {money(rNow.incl)} invoiced, {plural(rNow.count, 'invoice')}.</Check>;

  const pending = pendingList.reduce((s, e) => s + num(e.amount), 0);
  return {
    table, check, rev, prevRev, gross, net, prevNet, priorLabel, trimmed: trimNote(allMonths, months),
    costs: dNow.total + oNow.total, pending, pendingCount: pendingList.length,
  };
}
