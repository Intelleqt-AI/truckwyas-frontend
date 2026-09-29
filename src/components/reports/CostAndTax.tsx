import { useSearchParams } from 'react-router-dom';
import {
  catLabel, inPeriod, isApproved, isIssued, isPending, monthLabel, monthsIn, money, moneyWhole, num, pct, periodText, plural,
  shownMonths, trimNote, vatShare, ymOf, type Ledger,
} from './data';
import { Check, Choice, Empty, Info, PeriodControl, ReportFrame, StatementTable, Tiles, statementCsv, usePeriod, type SRow, type Statement } from './ui';

// ------------------------------------------------------------- expenses

type ExpView = 'category' | 'vehicle' | 'register';

export function ExpenseReport({ d, companyName }: { d: Ledger; companyName?: string }) {
  const [period, setPeriod] = usePeriod('last-12');
  const [params, setParams] = useSearchParams();
  const v = params.get('view');
  const view: ExpView = v === 'vehicle' || v === 'register' ? v : 'category';
  const setView = (x: ExpView) => setParams(p => { const n = new URLSearchParams(p); if (x === 'category') n.delete('view'); else n.set('view', x); return n; }, { replace: true });

  const list = d.expenses.filter(e => inPeriod(e.expense_date, period) && (isApproved(e) || isPending(e)));
  const approved = list.filter(isApproved);
  const pending = list.filter(isPending);
  const rejected = d.expenses.filter(e => inPeriod(e.expense_date, period) && !isApproved(e) && !isPending(e));
  const sum = (l: typeof list) => l.reduce((s, e) => s + num(e.amount), 0);
  const aTotal = sum(approved); const pTotal = sum(pending);
  const vehicleName = (id: number | null) => {
    if (id == null) return 'No vehicle linked';
    const veh = d.vehicles.find(x => x.id === id);
    return veh ? [veh.plate, [veh.make, veh.model].filter(Boolean).join(' ')].filter(Boolean).join(', ') : `Vehicle ${id}`;
  };

  const grouped = (keyOf: (e: (typeof list)[number]) => string, labelOf: (k: string) => string) => {
    const keys = [...new Set(list.map(keyOf))];
    return keys.map(k => {
      const l = list.filter(e => keyOf(e) === k);
      const a = sum(l.filter(isApproved));
      return { k, label: labelOf(k), count: l.length, a, p: sum(l.filter(isPending)) };
    }).sort((x, y) => y.a - x.a || y.p - x.p);
  };
  const byCat = grouped(e => (e.category || 'OTHER').toUpperCase(), catLabel);
  const byVeh = grouped(e => (e.vehicle == null ? 'none' : String(e.vehicle)), k => vehicleName(k === 'none' ? null : Number(k)))
    .sort((x, y) => (x.k === 'none' ? 1 : 0) - (y.k === 'none' ? 1 : 0) || y.a - x.a);

  const groupTable = (rows: typeof byCat, head: string): Statement => ({
    columns: [{ label: head }, { label: 'Expenses', type: 'int', phone: false }, { label: 'Approved', type: 'money' }, { label: 'Share', type: 'pct' }, { label: 'Pending', type: 'money' }],
    rows: [
      ...rows.map<SRow>(r => ({ key: r.k, kind: r.k === 'none' ? 'muted' : undefined, cells: [r.label, r.count, r.a, aTotal > 0 ? (r.a / aTotal) * 100 : null, r.p] })),
      { key: 'tot', kind: 'grand', cells: ['Total', list.length, aTotal, aTotal > 0 ? 100 : null, pTotal] },
    ],
  });
  const register: Statement = {
    columns: [{ label: 'Date', type: 'date' }, { label: 'Number' }, { label: 'Category' }, { label: 'Vehicle' }, { label: 'Supplier or detail' }, { label: 'Status' }, { label: 'Amount', type: 'money' }],
    rows: [
      ...[...list].sort((a, b) => a.expense_date.localeCompare(b.expense_date)).map<SRow>(e => ({
        key: `x${e.id}`, kind: isPending(e) ? 'muted' : undefined,
        cells: [e.expense_date, e.expense_number || `EXP-${e.id}`, catLabel(e.category), e.vehicle != null ? vehicleName(e.vehicle).split(',')[0] : '', e.vendor || e.description || '', isPending(e) ? 'Pending' : 'Approved', num(e.amount)],
      })),
      { key: 'tot-a', kind: 'subtotal', cells: ['Approved', '', '', '', plural(approved.length, 'expense'), '', aTotal] },
      { key: 'tot-p', kind: 'muted', cells: ['Pending', '', '', '', plural(pending.length, 'expense'), '', pTotal] },
      { key: 'tot', kind: 'grand', cells: ['Total', '', '', '', plural(list.length, 'expense'), '', aTotal + pTotal] },
    ],
  };
  const table = view === 'register' ? register : view === 'vehicle' ? groupTable(byVeh, 'Vehicle') : groupTable(byCat, 'Category');
  const noVehicle = approved.filter(e => e.vehicle == null);
  const topCat = byCat[0];

  return (
    <ReportFrame
      title="Expense report"
      sub={`${periodText(period)} · as captured`}
      companyName={companyName}
      info={<Info title="Expense report" lines={[
        'Expenses by expense date. Approved expenses count in profit and cash; pending ones are shown apart.',
        'Amounts are as captured. VAT on expenses is not recorded separately.',
        `${plural(rejected.length, 'rejected expense')} in the period ${rejected.length === 1 ? 'is' : 'are'} left out.`,
      ]} />}
      controls={<>
        <PeriodControl period={period} onChange={setPeriod} />
        <Choice label="View" value={view} onChange={setView} options={[{ id: 'category', label: 'By category' }, { id: 'vehicle', label: 'By vehicle' }, { id: 'register', label: 'Register' }]} />
      </>}
      tiles={list.length ? <Tiles table={table} tiles={[
        { label: 'Approved', value: moneyWhole(aTotal), title: money(aTotal), note: plural(approved.length, 'expense'), amount: aTotal },
        { label: 'Pending approval', value: moneyWhole(pTotal), title: money(pTotal), note: plural(pending.length, 'expense'), amount: pTotal },
        { label: 'Largest category', value: moneyWhole(topCat?.a ?? 0), title: money(topCat?.a ?? 0), note: topCat ? `${topCat.label}, ${pct(aTotal > 0 ? (topCat.a / aTotal) * 100 : 0, 0)}` : undefined, amount: topCat?.a ?? 0 },
        { label: 'Not linked to a vehicle', value: moneyWhole(sum(noVehicle)), title: money(sum(noVehicle)), note: plural(noVehicle.length, 'approved expense'), amount: sum(noVehicle) },
      ]} /> : undefined}
      gaps={['VAT on expenses is not captured.']}
      csv={() => statementCsv(`Expense report, ${periodText(period)}`, view === 'register' ? 'Register' : `By ${view}`, table)}
      csvName={`expenses-${view}-${period.from}-to-${period.to}`}
    >
      {list.length === 0 ? <Empty line={`No expenses dated in ${periodText(period)}.`} action={{ label: 'See expenses', to: '/finance/expenses' }} /> : (
        <StatementTable fit cue={null} table={table} caption={`Expenses ${view === 'register' ? 'register' : `by ${view}`}`} stickyFirst={view !== 'register'}
          footer={<Check>Approved total equals the approved costs in the profit and loss for {periodText(period)}.</Check>} />
      )}
    </ReportFrame>
  );
}

// ------------------------------------------------------------------ VAT

type VatBasis = 'invoice' | 'payments';
type VatView = 'month' | 'invoice';

export function VatReport({ d, companyName, vatNumber }: { d: Ledger; companyName?: string; vatNumber?: string }) {
  const [period, setPeriod] = usePeriod('last-12');
  const [params, setParams] = useSearchParams();
  const basis: VatBasis = params.get('basis') === 'payments' ? 'payments' : 'invoice';
  const view: VatView = params.get('view') === 'invoice' ? 'invoice' : 'month';
  const set = (k: string, v: string | null) => setParams(p => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });
  const invById = new Map(d.invoices.map(i => [i.id, i]));
  const allMonths = monthsIn(period.from, period.to);

  // One line per supply: an issued invoice (invoice basis) or a payment (payments basis).
  type Line = { date: string; ref: string; party: string; incl: number; vat: number };
  const lines: Line[] = basis === 'invoice'
    ? d.invoices.filter(i => isIssued(i) && inPeriod(i.issue_date, period)).map(i => ({ date: i.issue_date, ref: i.invoice_number, party: i.customer_name, incl: num(i.total_amount), vat: num(i.vat_amount) }))
    : d.payments.filter(p => inPeriod(p.payment_date, period)).map(p => {
      const inv = p.invoice != null ? invById.get(p.invoice) : undefined;
      const amt = num(p.amount);
      return { date: p.payment_date, ref: `${p.payment_number || `PMT-${p.id}`}${p.invoice_number ? `, ${p.invoice_number}` : ''}`, party: p.customer_name || inv?.customer_name || '', incl: amt, vat: amt * vatShare(inv) };
    });
  lines.sort((a, b) => a.date.localeCompare(b.date));
  const incl = lines.reduce((s, l) => s + l.incl, 0);
  const vat = lines.reduce((s, l) => s + l.vat, 0);
  const zeroRated = lines.filter(l => l.incl > 0 && l.vat < 0.005);
  // Rows end at the last month with a supply; the total covers the whole period.
  const months = shownMonths(allMonths, m => lines.some(l => ymOf(l.date) === m));
  const trimmed = view === 'month' ? trimNote(allMonths, months) : null;

  const table: Statement = view === 'month'
    ? {
      columns: [{ label: 'Month' }, { label: basis === 'invoice' ? 'Invoices' : 'Payments', type: 'int', phone: false }, { label: 'Excl. VAT', type: 'money' }, { label: 'Output VAT', type: 'money' }, { label: 'Incl. VAT', type: 'money' }],
      rows: [
        ...months.map<SRow>(m => {
          const l = lines.filter(x => ymOf(x.date) === m);
          const a = l.reduce((s, x) => s + x.incl, 0); const v = l.reduce((s, x) => s + x.vat, 0);
          return { key: m, cells: [monthLabel(m), l.length, a - v, v, a] };
        }),
        { key: 'tot', kind: 'grand', cells: ['Total', lines.length, incl - vat, vat, incl] },
        { key: 'input', kind: 'muted', cells: ['Input VAT', '', '', 'Not captured', ''] },
      ],
    }
    : {
      columns: [{ label: 'Date', type: 'date' }, { label: 'Reference' }, { label: 'Customer' }, { label: 'Excl. VAT', type: 'money' }, { label: 'Output VAT', type: 'money' }, { label: 'Incl. VAT', type: 'money' }],
      rows: [
        ...lines.map<SRow>((l, i) => ({ key: `l${i}`, cells: [l.date, l.ref, l.party, l.incl - l.vat, l.vat, l.incl] })),
        { key: 'tot', kind: 'grand', cells: ['Total', plural(lines.length, 'line'), '', incl - vat, vat, incl] },
      ],
    };
  const basisText = basis === 'invoice' ? 'Invoice basis' : 'Payments basis';

  return (
    <ReportFrame
      title="VAT report"
      sub={`${periodText(period)} · output VAT`}
      printTitle={`VAT report, ${basisText.toLowerCase()}`}
      companyName={companyName}
      info={<Info title="VAT report" lines={[
        'Invoice basis: VAT on issued invoices (not drafts or cancelled), by issue date.',
        'Payments basis: VAT in each customer payment, in the same proportion as its invoice, by payment date.',
        'Input VAT is not captured on expenses, so this report cannot give the VAT payable. Your accountant adds input VAT.',
        vatNumber ? `VAT number on your company profile: ${vatNumber}.` : 'No VAT number on your company profile.',
      ]} />}
      controls={<>
        <PeriodControl period={period} onChange={setPeriod} />
        <Choice label="Basis" value={basis} onChange={b => set('basis', b === 'invoice' ? null : b)} options={[{ id: 'invoice', label: 'Invoice basis' }, { id: 'payments', label: 'Payments basis' }]} />
        <Choice label="View" value={view} onChange={x => set('view', x === 'month' ? null : x)} options={[{ id: 'month', label: 'By month' }, { id: 'invoice', label: 'By line' }]} />
      </>}
      tiles={lines.length ? <Tiles table={table} tiles={[
        { label: 'Output VAT', value: moneyWhole(vat), title: money(vat), note: basisText, amount: vat },
        { label: 'Supplies excl. VAT', value: moneyWhole(incl - vat), title: money(incl - vat), amount: incl - vat },
        { label: 'Supplies incl. VAT', value: moneyWhole(incl), title: money(incl), note: plural(lines.length, basis === 'invoice' ? 'invoice' : 'payment'), amount: incl },
      ]} /> : undefined}
      gaps={[...(trimmed ? [trimmed] : []), 'Input VAT is not captured on expenses, so only output VAT is shown.']}
      csv={() => statementCsv(`VAT report, ${periodText(period)}`, `Output VAT, ${basisText}`, table)}
      csvName={`vat-${basis}-${period.from}-to-${period.to}`}
    >
      {lines.length === 0 ? <Empty line={`No ${basis === 'invoice' ? 'invoices issued' : 'payments received'} in ${periodText(period)}.`} /> : (
        <StatementTable fit cue={null} table={table} caption="Output VAT"
          footer={<>
            <Check>Total excl. VAT plus output VAT equals the total incl. VAT across {plural(lines.length, basis === 'invoice' ? 'invoice' : 'payment')}.</Check>
            {zeroRated.length > 0 && <Check ok={false}>{plural(zeroRated.length, 'line')} carry no VAT. Check they are zero-rated.</Check>}
          </>} />
      )}
    </ReportFrame>
  );
}
