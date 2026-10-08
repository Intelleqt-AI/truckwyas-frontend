import { useSearchParams } from 'react-router-dom';
import {
  catLabel, expenseNet, expenseVat, inPeriod, isApproved, isPending, isRejected, monthLabel, monthsIn, money, moneyWhole, num, parseBasis, pct, periodText, plural,
  revenueEntries, shownMonths, trimNote, ymOf, type Ledger,
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
  // Costs are net of their input VAT (amount − vat_amount), as in the P&L.
  const sum = (l: typeof list) => l.reduce((s, e) => s + expenseNet(e), 0);
  const vatOf = (l: typeof list) => l.reduce((s, e) => s + expenseVat(e), 0);
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
      return { k, label: labelOf(k), count: l.length, a, v: vatOf(l.filter(isApproved)), p: sum(l.filter(isPending)) };
    }).sort((x, y) => y.a - x.a || y.p - x.p);
  };
  const byCat = grouped(e => (e.category || 'OTHER').toUpperCase(), catLabel);
  const byVeh = grouped(e => (e.vehicle == null ? 'none' : String(e.vehicle)), k => vehicleName(k === 'none' ? null : Number(k)))
    .sort((x, y) => (x.k === 'none' ? 1 : 0) - (y.k === 'none' ? 1 : 0) || y.a - x.a);

  const groupTable = (rows: typeof byCat, head: string): Statement => ({
    columns: [{ label: head }, { label: 'Expenses', type: 'int', phone: false }, { label: 'Approved excl. VAT', type: 'money' }, { label: 'Input VAT', type: 'money', phone: false }, { label: 'Share', type: 'pct' }, { label: 'Pending excl. VAT', type: 'money' }],
    rows: [
      ...rows.map<SRow>(r => ({ key: r.k, kind: r.k === 'none' ? 'muted' : undefined, cells: [r.label, r.count, r.a, r.v, aTotal > 0 ? (r.a / aTotal) * 100 : null, r.p] })),
      { key: 'tot', kind: 'grand', cells: ['Total', list.length, aTotal, vatOf(approved), aTotal > 0 ? 100 : null, pTotal] },
    ],
  });
  const register: Statement = {
    columns: [{ label: 'Date', type: 'date' }, { label: 'Number' }, { label: 'Category' }, { label: 'Vehicle' }, { label: 'Supplier or detail' }, { label: 'Status' }, { label: 'Excl. VAT', type: 'money' }, { label: 'Input VAT', type: 'money' }],
    rows: [
      ...[...list].sort((a, b) => a.expense_date.localeCompare(b.expense_date)).map<SRow>(e => ({
        key: `x${e.id}`, kind: isPending(e) ? 'muted' : undefined,
        cells: [e.expense_date, e.expense_number || `EXP-${e.id}`, catLabel(e.category), e.vehicle != null ? vehicleName(e.vehicle).split(',')[0] : '', e.supplier_name || e.vendor || e.description || '', isPending(e) ? 'Pending' : 'Approved', expenseNet(e), expenseVat(e)],
      })),
      { key: 'tot-a', kind: 'subtotal', cells: ['Approved', '', '', '', plural(approved.length, 'expense'), '', aTotal, vatOf(approved)] },
      { key: 'tot-p', kind: 'muted', cells: ['Pending', '', '', '', plural(pending.length, 'expense'), '', pTotal, vatOf(pending)] },
      { key: 'tot', kind: 'grand', cells: ['Total', '', '', '', plural(list.length, 'expense'), '', aTotal + pTotal, vatOf(list)] },
    ],
  };
  const table = view === 'register' ? register : view === 'vehicle' ? groupTable(byVeh, 'Vehicle') : groupTable(byCat, 'Category');
  const noVehicle = approved.filter(e => e.vehicle == null);
  const topCat = byCat[0];

  return (
    <ReportFrame
      title="Expense report"
      sub={`${periodText(period)} · excl. VAT`}
      companyName={companyName}
      info={<Info title="Expense report" lines={[
        'Expenses by expense date. Approved and pending expenses both count as costs in the profit and loss; pending ones are shown apart so they can be approved.',
        'Amounts exclude input VAT (the VAT inside each expense, from its tax code); input VAT is shown beside them and in the VAT report.',
        `${plural(rejected.length, 'rejected expense')} in the period ${rejected.length === 1 ? 'is' : 'are'} left out.`,
      ]} />}
      controls={<>
        <PeriodControl period={period} onChange={setPeriod} />
        <Choice label="View" value={view} onChange={setView} options={[{ id: 'category', label: 'By category' }, { id: 'vehicle', label: 'By vehicle' }, { id: 'register', label: 'Register' }]} />
      </>}
      tiles={list.length ? <Tiles table={table} tiles={[
        { label: 'Approved excl. VAT', value: moneyWhole(aTotal), title: money(aTotal), note: plural(approved.length, 'expense'), amount: aTotal },
        { label: 'Pending approval', value: moneyWhole(pTotal), title: money(pTotal), note: plural(pending.length, 'expense'), amount: pTotal },
        { label: 'Largest category', value: moneyWhole(topCat?.a ?? 0), title: money(topCat?.a ?? 0), note: topCat ? `${topCat.label}, ${pct(aTotal > 0 ? (topCat.a / aTotal) * 100 : 0, 0)}` : undefined, amount: topCat?.a ?? 0 },
        { label: 'Not linked to a vehicle', value: moneyWhole(sum(noVehicle)), title: money(sum(noVehicle)), note: plural(noVehicle.length, 'approved expense'), amount: sum(noVehicle) },
      ]} /> : undefined}
      csv={() => statementCsv(`Expense report, ${periodText(period)}`, view === 'register' ? 'Register' : `By ${view}`, table)}
      csvName={`expenses-${view}-${period.from}-to-${period.to}`}
    >
      {list.length === 0 ? <Empty line={`No expenses dated in ${periodText(period)}.`} action={{ label: 'See expenses', to: '/finance/expenses' }} /> : (
        <StatementTable fit cue={null} table={table} caption={`Expenses ${view === 'register' ? 'register' : `by ${view}`}`} stickyFirst={view !== 'register'}
          footer={<Check>Approved plus pending equals the costs in the profit and loss for {periodText(period)}; rejected expenses are left out of both.</Check>} />
      )}
    </ReportFrame>
  );
}

// ------------------------------------------------------------------ VAT

type VatBasis = 'invoice' | 'payments';
type VatView = 'month' | 'invoice';

/**
 * Output VAT: VAT on issued invoices less VAT on issued credit notes (invoice
 * basis), or the VAT share of each payment (payments basis). Input VAT: the
 * VAT inside every expense that is not rejected, by expense date. Net VAT =
 * output − input.
 */
export function VatReport({ d, companyName, vatNumber }: { d: Ledger; companyName?: string; vatNumber?: string }) {
  const [period, setPeriod] = usePeriod('last-12');
  const [params, setParams] = useSearchParams();
  const basis: VatBasis = parseBasis(params.get('basis'), 'accrual') === 'cash' ? 'payments' : 'invoice';
  const view: VatView = params.get('view') === 'invoice' ? 'invoice' : 'month';
  const set = (k: string, v: string | null) => setParams(p => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });
  const allMonths = monthsIn(period.from, period.to);

  // Output: one line per supply (invoice, credit note or payment), signed.
  type Line = { date: string; ref: string; party: string; incl: number; vat: number };
  const lines: Line[] = revenueEntries(d, basis === 'invoice' ? 'accrual' : 'cash', period)
    .map(e => ({ date: e.date, ref: e.ref, party: e.party, incl: e.incl, vat: e.vat }));
  lines.sort((a, b) => a.date.localeCompare(b.date));
  const incl = lines.reduce((s, l) => s + l.incl, 0);
  const vat = lines.reduce((s, l) => s + l.vat, 0);
  const zeroRated = lines.filter(l => l.incl > 0 && l.vat < 0.005);
  const creditLines = lines.filter(l => l.incl < 0).length;

  // Input: expenses that are not rejected, by expense date.
  const purchases = d.expenses.filter(e => !isRejected(e) && inPeriod(e.expense_date, period)).sort((a, b) => a.expense_date.localeCompare(b.expense_date));
  const inputVat = purchases.reduce((s, e) => s + expenseVat(e), 0);
  const netVat = vat - inputVat;
  const noVatPurchases = purchases.filter(e => expenseVat(e) < 0.005 && (e.tax_code ?? 'STANDARD') === 'STANDARD');

  // Rows end at the last month with an entry; the total covers the whole period.
  const months = shownMonths(allMonths, m => lines.some(l => ymOf(l.date) === m) || purchases.some(e => ymOf(e.expense_date) === m));
  const trimmed = view === 'month' ? trimNote(allMonths, months) : null;

  const tables: Statement[] = view === 'month'
    ? [{
      columns: [{ label: 'Month' }, { label: 'Supplies excl. VAT', type: 'money', phone: false }, { label: 'Output VAT', type: 'money' }, { label: 'Input VAT', type: 'money' }, { label: 'Net VAT', type: 'money' }],
      rows: [
        ...months.map<SRow>(m => {
          const l = lines.filter(x => ymOf(x.date) === m);
          const a = l.reduce((s, x) => s + x.incl, 0); const v = l.reduce((s, x) => s + x.vat, 0);
          const iv = purchases.filter(e => ymOf(e.expense_date) === m).reduce((s, e) => s + expenseVat(e), 0);
          return { key: m, cells: [monthLabel(m), a - v, v, iv, v - iv] };
        }),
        { key: 'tot', kind: 'grand', cells: ['Total', incl - vat, vat, inputVat, netVat] },
      ],
    }]
    : [
      {
        columns: [{ label: 'Date', type: 'date' }, { label: 'Reference' }, { label: 'Customer' }, { label: 'Excl. VAT', type: 'money' }, { label: 'Output VAT', type: 'money' }, { label: 'Incl. VAT', type: 'money' }],
        rows: [
          ...lines.map<SRow>((l, i) => ({ key: `l${i}`, cells: [l.date, l.ref, l.party, l.incl - l.vat, l.vat, l.incl] })),
          { key: 'tot', kind: 'grand', cells: ['Output VAT', plural(lines.length, 'line'), '', incl - vat, vat, incl] },
        ],
      },
      {
        columns: [{ label: 'Date', type: 'date' }, { label: 'Expense' }, { label: 'Supplier' }, { label: 'Excl. VAT', type: 'money' }, { label: 'Input VAT', type: 'money' }, { label: 'Incl. VAT', type: 'money' }],
        rows: [
          ...purchases.map<SRow>(e => ({ key: `e${e.id}`, kind: isPending(e) ? 'muted' : undefined, cells: [e.expense_date, e.expense_number || `EXP-${e.id}`, e.supplier_name || e.vendor || e.description || '', expenseNet(e), expenseVat(e), num(e.amount)] })),
          { key: 'tot-in', kind: 'grand', cells: ['Input VAT', plural(purchases.length, 'expense'), '', purchases.reduce((s, e) => s + expenseNet(e), 0), inputVat, purchases.reduce((s, e) => s + num(e.amount), 0)] },
        ],
      },
    ];
  const basisText = basis === 'invoice' ? 'Invoice basis' : 'Payments basis';

  return (
    <ReportFrame
      title="VAT report"
      sub={`${periodText(period)} · output and input VAT`}
      printTitle={`VAT report, ${basisText.toLowerCase()}`}
      companyName={companyName}
      info={<Info title="VAT report" lines={[
        'Output VAT, invoice basis: VAT on issued invoices (not drafts or void) by issue date, less VAT on issued credit notes by their own date.',
        'Output VAT, payments basis: VAT in each customer payment, in the same proportion as its invoice, by payment date.',
        'Input VAT: the VAT inside each expense that is not rejected (approved and pending), by expense date. Only standard-rated expenses carry input VAT.',
        'Net VAT is output VAT less input VAT: what would be payable (or refundable) for the period. Check it with your accountant before filing.',
        vatNumber ? `VAT number on your company profile: ${vatNumber}.` : 'No VAT number on your company profile.',
      ]} />}
      controls={<>
        <PeriodControl period={period} onChange={setPeriod} />
        <Choice label="Basis" value={basis} onChange={b => set('basis', b === 'invoice' ? null : 'cash')} options={[{ id: 'invoice', label: 'Invoice basis' }, { id: 'payments', label: 'Payments basis' }]} />
        <Choice label="View" value={view} onChange={x => set('view', x === 'month' ? null : x)} options={[{ id: 'month', label: 'By month' }, { id: 'invoice', label: 'By line' }]} />
      </>}
      tiles={lines.length || purchases.length ? <Tiles table={tables} tiles={[
        { label: 'Output VAT', value: moneyWhole(vat), title: money(vat), note: basisText + (creditLines ? `, after ${plural(creditLines, 'credit note')}` : ''), amount: vat },
        { label: 'Input VAT', value: moneyWhole(inputVat), title: money(inputVat), note: plural(purchases.length, 'expense'), amount: inputVat },
        { label: netVat >= 0 ? 'Net VAT payable' : 'Net VAT refundable', value: moneyWhole(Math.abs(netVat)), title: money(netVat), note: 'Output less input', amount: netVat },
      ]} /> : undefined}
      gaps={trimmed ? [trimmed] : undefined}
      csv={() => tables.flatMap((t, i) => statementCsv(i === 0 ? `VAT report, ${periodText(period)}` : 'Input VAT', i === 0 ? `Output VAT, ${basisText}; input VAT by expense date` : 'Expenses by expense date', t))}
      csvName={`vat-${basis}-${period.from}-to-${period.to}`}
    >
      {lines.length === 0 && purchases.length === 0 ? <Empty line={`No ${basis === 'invoice' ? 'invoices issued' : 'payments received'} or expenses in ${periodText(period)}.`} /> : (
        <>
          {tables.map((t, i) => (
            <StatementTable key={i} fit cue={null} table={t} caption={view === 'month' ? 'Output and input VAT' : i === 0 ? 'Output VAT' : 'Input VAT'}
              footer={i === tables.length - 1 ? <>
                <Check>Net VAT {money(netVat)} is output VAT {money(vat)} less input VAT {money(inputVat)}.</Check>
                {zeroRated.length > 0 && <Check ok={false}>{plural(zeroRated.length, 'supply', 'supplies')} carry no VAT. Check they are zero-rated.</Check>}
                {noVatPurchases.length > 0 && <Check ok={false}>{plural(noVatPurchases.length, 'standard-rated expense')} show no input VAT. Check the amounts.</Check>}
              </> : undefined} />
          ))}
        </>
      )}
    </ReportFrame>
  );
}
