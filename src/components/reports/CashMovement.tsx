import { useSearchParams } from 'react-router-dom';
import {
  catLabel, inPeriod, isApproved, methodLabel, monthLabel, monthsIn, money, moneyWhole, num, periodText, plural, shownMonths,
  trimNote, ymOf, type Ledger,
} from './data';
import { Check, Choice, Info, PeriodControl, ReportFrame, StatementTable, Tiles, statementCsv, usePeriod, type SRow, type Statement } from './ui';

type View = 'summary' | 'book';

export default function CashMovement({ d, companyName }: { d: Ledger; companyName?: string }) {
  const [period, setPeriod] = usePeriod('last-12');
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'book' ? 'book' : 'summary';
  const setView = (v: View) => setParams(p => { const n = new URLSearchParams(p); if (v === 'summary') n.delete('view'); else n.set('view', v); return n; }, { replace: true });

  const allMonths = monthsIn(period.from, period.to);
  const receipts = d.payments.filter(p => inPeriod(p.payment_date, period));
  const outs = d.expenses.filter(e => isApproved(e) && inPeriod(e.expense_date, period));
  const totalIn = receipts.reduce((s, p) => s + num(p.amount), 0);
  const totalOut = outs.reduce((s, e) => s + num(e.amount), 0);
  const invById = new Map(d.invoices.map(i => [i.id, i]));

  // Summary statement: months across, money in by method, money out by category.
  const methods = [...new Set(receipts.map(p => methodLabel(p.payment_method)))].sort();
  const cats = [...new Set(outs.map(e => (e.category || 'OTHER').toUpperCase()))].sort((a, b) => catLabel(a).localeCompare(catLabel(b)));
  const sumBy = <T,>(list: T[], date: (x: T) => string, amt: (x: T) => number, m: string) => list.filter(x => ymOf(date(x)) === m).reduce((s, x) => s + amt(x), 0);
  const inM = (m: string) => sumBy(receipts, p => p.payment_date, p => num(p.amount), m);
  const outM = (m: string) => sumBy(outs, e => e.expense_date, e => num(e.amount), m);
  // Columns end at the last month with money in or out; totals cover the whole period.
  const months = shownMonths(allMonths, m => receipts.some(p => ymOf(p.payment_date) === m) || outs.some(e => ymOf(e.expense_date) === m));
  const trimmed = view === 'summary' ? trimNote(allMonths, months) : null;
  let run = 0;
  const cumulative = months.map(m => (run += inM(m) - outM(m)));
  const summary: Statement = {
    columns: [{ label: 'Line' }, ...months.map(m => ({ label: monthLabel(m), type: 'money' as const })), { label: 'Total', type: 'money' }],
    rows: [
      { key: 's-in', kind: 'section', cells: ['Money in'] },
      ...methods.map<SRow>(me => {
        const list = receipts.filter(p => methodLabel(p.payment_method) === me);
        return { key: `in-${me}`, indent: true, cells: [me === 'Payment' ? 'Customer receipts' : me === 'Cash' ? 'Received in cash' : `Received by ${me === 'EFT' ? 'EFT' : me.toLowerCase()}`, ...months.map(m => sumBy(list, p => p.payment_date, p => num(p.amount), m)), list.reduce((s, p) => s + num(p.amount), 0)] };
      }),
      { key: 't-in', kind: 'subtotal', cells: ['Total money in', ...months.map(inM), totalIn] },
      { key: 's-out', kind: 'section', cells: ['Money out'] },
      ...cats.map<SRow>(c => {
        const list = outs.filter(e => (e.category || 'OTHER').toUpperCase() === c);
        return { key: `out-${c}`, indent: true, cells: [catLabel(c), ...months.map(m => sumBy(list, e => e.expense_date, e => num(e.amount), m)), list.reduce((s, e) => s + num(e.amount), 0)] };
      }),
      { key: 't-out', kind: 'subtotal', cells: ['Total money out', ...months.map(outM), totalOut] },
      { key: 'net', kind: 'grand', cells: ['Net movement', ...months.map(m => inM(m) - outM(m)), totalIn - totalOut] },
      { key: 'cum', kind: 'muted', cells: ['Running total', ...cumulative, totalIn - totalOut] },
    ],
  };

  // Cash book: every receipt and approved expense, oldest first.
  type Entry = { date: string; ref: string; detail: string; inAmt: number; outAmt: number; href?: string };
  const entries: Entry[] = [
    ...receipts.map(p => ({
      date: p.payment_date, ref: p.payment_number || `PMT-${p.id}`,
      detail: `${p.customer_name || invById.get(p.invoice ?? -1)?.customer_name || 'Customer'}, ${p.invoice_number || 'unallocated'}`,
      inAmt: num(p.amount), outAmt: 0, href: p.invoice != null ? `/finance/invoices/${p.invoice}` : undefined,
    })),
    ...outs.map(e => ({
      date: e.expense_date, ref: e.expense_number || `EXP-${e.id}`,
      detail: [catLabel(e.category), e.vendor || e.description].filter(Boolean).join(', '),
      inAmt: 0, outAmt: num(e.amount),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (b.inAmt - a.inAmt));
  let bal = 0;
  const book: Statement = {
    columns: [{ label: 'Date', type: 'date' }, { label: 'Reference' }, { label: 'Detail' }, { label: 'Money in', type: 'money' }, { label: 'Money out', type: 'money' }, { label: 'Running movement', type: 'money' }],
    rows: [
      ...entries.map<SRow>((e, i) => ({ key: `e${i}`, cells: [e.date, e.ref, e.detail, e.inAmt || '', e.outAmt || '', (bal += e.inAmt - e.outAmt)] })),
      { key: 'tot', kind: 'grand', cells: ['Total', '', plural(entries.length, 'entry', 'entries'), totalIn, totalOut, totalIn - totalOut] },
    ],
  };

  // Reconciliation: receipts split into invoices now paid in full and part-payments.
  const toPaid = receipts.filter(p => (invById.get(p.invoice ?? -1)?.status || '').toUpperCase() === 'PAID');
  const paidInvoices = new Set(toPaid.map(p => p.invoice)).size;
  const toPaidSum = toPaid.reduce((s, p) => s + num(p.amount), 0);
  const table = view === 'book' ? book : summary;

  return (
    <ReportFrame
      title="Cash movement"
      sub={`${periodText(period)} · Movement, excluding bank balance`}
      companyName={companyName}
      info={<Info title="Cash movement" lines={[
        'Money in: every customer payment recorded, by payment date, including VAT.',
        'Money out: approved expenses, by expense date, treated as paid on that date.',
        'TruckWys does not hold your bank balance, so this is movement only: no opening or closing balance.',
        'Forecasts are not shown here. Insights flags a predicted shortfall.',
      ]} />}
      controls={<>
        <PeriodControl period={period} onChange={setPeriod} />
        <Choice label="View" value={view} onChange={setView} options={[{ id: 'summary', label: 'By month' }, { id: 'book', label: 'Cash book' }]} />
      </>}
      tiles={<Tiles table={table} tiles={[
        { label: 'Money in', value: moneyWhole(totalIn), title: money(totalIn), note: plural(receipts.length, 'receipt'), amount: totalIn },
        { label: 'Money out', value: moneyWhole(totalOut), title: money(totalOut), note: plural(outs.length, 'approved expense'), amount: totalOut },
        { label: 'Net movement', value: moneyWhole(totalIn - totalOut), title: money(totalIn - totalOut), note: periodText(period), amount: totalIn - totalOut },
      ]} />}
      gaps={[...(trimmed ? [trimmed] : []), 'Bank balance is not recorded in TruckWys, so there is no opening or closing balance.']}
      csv={() => statementCsv(`Cash movement, ${periodText(period)}`, view === 'book' ? 'Cash book' : 'By month', table)}
      csvName={`cash-movement-${view}-${period.from}-to-${period.to}`}
    >
      <StatementTable
        table={table}
        caption={view === 'book' ? 'Cash book' : 'Cash movement by month'}
        stickyFirst={view !== 'book'}
        fit={view !== 'book'}
        pinLast={view !== 'book'}
        footer={receipts.length > 0 ? (
          <Check>
            {Math.abs(totalIn - toPaidSum) < 0.005
              ? <>All money in was on {plural(paidInvoices, 'invoice')} now paid in full.</>
              : toPaidSum < 0.005
                ? <>All money in was part-payments on open invoices.</>
                : <>Money in: {money(toPaidSum)} on {plural(paidInvoices, 'invoice')} now paid in full, {money(totalIn - toPaidSum)} part-payments on open invoices.</>}
          </Check>
        ) : undefined}
      />
    </ReportFrame>
  );
}
