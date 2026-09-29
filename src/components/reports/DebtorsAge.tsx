import { useSearchParams } from 'react-router-dom';
import {
  addMonths, day, daysBetween, isDraft, isIssued, isOpen, monthEnd, monthLabel, money, moneyWhole, num, pct, plural,
  todayISO, ymNow, type Invoice, type Ledger,
} from './data';
import { formatDays } from '@/lib/formatters';
import { Check, Choice, Empty, Info, ReportFrame, Seg, StatementTable, Tiles, statementCsv, type SRow, type Statement } from './ui';

const BUCKETS = ['Current', '1 to 30 days', '31 to 60 days', '61 to 90 days', 'Over 90 days'] as const;
const bucketOf = (daysOverdue: number) => (daysOverdue <= 0 ? 0 : daysOverdue <= 30 ? 1 : daysOverdue <= 60 ? 2 : daysOverdue <= 90 ? 3 : 4);

export interface AgedInvoice { inv: Invoice; balance: number; days: number; bucket: number }

/** Open balances as at a date. Today uses each invoice's balance; an earlier
 *  date is rebuilt from the invoice total less payments recorded by then. */
export function ageInvoices(d: Ledger, asAt: string | null): AgedInvoice[] {
  const at = asAt ?? todayISO();
  const paidBy = new Map<number, number>();
  const hasPayments = new Set<number>();
  d.payments.forEach(p => {
    if (p.invoice == null) return;
    hasPayments.add(p.invoice);
    if (p.payment_date <= at) paidBy.set(p.invoice, (paidBy.get(p.invoice) || 0) + num(p.amount));
  });
  return d.invoices.flatMap(inv => {
    let balance: number;
    if (!asAt) {
      if (!isOpen(inv)) return [];
      balance = num(inv.balance);
    } else {
      if (!isIssued(inv) || !inv.issue_date || inv.issue_date > at) return [];
      const paidInFull = (inv.status || '').toUpperCase() === 'PAID' && !hasPayments.has(inv.id) && !!inv.paid_at && inv.paid_at.slice(0, 10) <= at;
      balance = paidInFull ? 0 : num(inv.total_amount) - (paidBy.get(inv.id) || 0);
      if (balance <= 0.005) return [];
    }
    const days = inv.due_date ? daysBetween(inv.due_date, at) : 0;
    return [{ inv, balance, days, bucket: bucketOf(days) }];
  });
}

export default function DebtorsAge({ d, companyName }: { d: Ledger; companyName?: string }) {
  const [params, setParams] = useSearchParams();
  const asAtYm = /^\d{4}-\d{2}$/.test(params.get('asat') || '') ? params.get('asat') : null;
  const asAt = asAtYm ? monthEnd(asAtYm) : null;
  const view = params.get('view') === 'invoice' ? 'invoice' : 'customer';
  const set = (k: string, v: string | null) => setParams(p => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });

  const aged = ageInvoices(d, asAt);
  const total = aged.reduce((s, a) => s + a.balance, 0);
  const byBucket = BUCKETS.map((_, b) => aged.filter(a => a.bucket === b).reduce((s, a) => s + a.balance, 0));
  const overdue = total - byBucket[0];
  const over60 = byBucket[3] + byBucket[4];
  const dateText = day(asAt ?? todayISO());

  const custKey = (i: Invoice) => (i.customer != null ? `c${i.customer}` : `n${i.customer_name}`);
  const customers = [...new Set(aged.map(a => custKey(a.inv)))].map(k => {
    const list = aged.filter(a => custKey(a.inv) === k);
    const b = BUCKETS.map((_, i) => list.filter(a => a.bucket === i).reduce((s, a) => s + a.balance, 0));
    return { k, name: list[0].inv.customer_name, id: list[0].inv.customer, count: list.length, b, total: b.reduce((s, v) => s + v, 0) };
  }).sort((a, b) => b.total - a.total);

  const bucketCols = BUCKETS.map(l => ({ label: l, type: 'money' as const }));
  const table: Statement = view === 'customer'
    ? {
      columns: [{ label: 'Customer' }, { label: 'Invoices', type: 'int', phone: false }, ...bucketCols, { label: 'Total', type: 'money' }],
      rows: [
        ...customers.map<SRow>(c => ({
          key: c.k, cells: [c.name, c.count, ...c.b, c.total],
          href: c.id != null ? `/finance/reports?report=statement&customer=${c.id}` : undefined,
        })),
        { key: 'tot', kind: 'grand', cells: ['Total', aged.length, ...byBucket, total] },
        { key: 'share', kind: 'ratio', fmt: 'pct', cells: ['Share of total', '', ...byBucket.map(v => (total > 0 ? (v / total) * 100 : null)), total > 0 ? 100 : null] },
      ],
    }
    : {
      columns: [{ label: 'Invoice' }, { label: 'Customer', phone: false }, { label: 'Issued', type: 'date', phone: false }, { label: 'Due', type: 'date', phone: false }, { label: 'Days overdue', type: 'int' }, ...bucketCols, { label: 'Balance', type: 'money' }],
      rows: [
        ...[...aged].sort((a, b) => b.days - a.days).map<SRow>(a => ({
          key: `i${a.inv.id}`, href: `/finance/invoices/${a.inv.id}`,
          cells: [a.inv.invoice_number, a.inv.customer_name, a.inv.issue_date, a.inv.due_date, Math.max(0, a.days), ...BUCKETS.map((_, i) => (i === a.bucket ? a.balance : '')), a.balance],
        })),
        { key: 'tot', kind: 'grand', cells: ['Total', plural(aged.length, 'invoice'), '', '', '', ...byBucket, total] },
      ],
    };

  // On screen, ageing columns with nothing in them are left out (a column of
  // R 0,00 answers nothing); the CSV keeps all five buckets.
  const firstBucket = view === 'customer' ? 2 : 5;
  const emptyBuckets = BUCKETS.filter((_, b) => Math.abs(byBucket[b]) < 0.005);
  const hide = new Set(BUCKETS.flatMap((_, b) => (Math.abs(byBucket[b]) < 0.005 ? [firstBucket + b] : [])));
  const shown: Statement = hide.size === 0 || hide.size === BUCKETS.length ? table : {
    columns: table.columns.filter((_, i) => !hide.has(i)),
    rows: table.rows.map(r => (r.kind === 'section' ? r : { ...r, cells: r.cells.filter((_, i) => !hide.has(i)) })),
  };
  const hiddenNote = hide.size && hide.size < BUCKETS.length
    ? `No balances in ${emptyBuckets.join(', ').replace(/, ([^,]*)$/, ' or $1')}, so ${hide.size === 1 ? 'that column is' : 'those columns are'} not shown.`
    : null;

  // Reconcile to the invoice ledger (today only): every open balance, straight from the invoices.
  const ledgerOpen = d.invoices.filter(isOpen);
  const ledgerTotal = ledgerOpen.reduce((s, i) => s + num(i.balance), 0);
  const drafts = d.invoices.filter(isDraft);
  const draftTotal = drafts.reduce((s, i) => s + num(i.total_amount), 0);
  const ties = Math.abs(ledgerTotal - total) < 0.01;

  const now = ymNow();
  // "Now" is the live ledger; earlier options are month-ends rebuilt from payments.
  const asAtOptions = [{ id: '', label: day(todayISO()) }, ...[1, 2, 3, 4, 5, 6].map(n => { const m = addMonths(now, -n); return { id: m, label: `End ${monthLabel(m)}` }; })];
  // Balance-weighted days past due: how late the money is, which the table does not show.
  const lateDays = overdue > 0.005 ? aged.filter(a => a.days > 0).reduce((s, a) => s + a.days * a.balance, 0) / overdue : 0;
  const allOverdue = total > 0 && Math.abs(overdue - total) < 0.005;

  return (
    <ReportFrame
      title="Debtors age analysis"
      sub={`As at ${dateText} · Incl. VAT, by due date${allOverdue ? (over60 > total - 0.005 ? ' · All over 60 days' : ' · All past due') : ''}`}
      companyName={companyName}
      info={<Info title="Debtors age analysis" lines={[
        'Unpaid balances on issued invoices, including VAT. Drafts and cancelled invoices are not owed.',
        'Aged by days past the due date: current means not yet due.',
        'A month-end date is rebuilt from invoice totals less payments recorded by that date.',
        'Select a customer to open their statement.',
      ]} />}
      controls={<>
        <Choice label="As at" prefix="As at" value={asAtYm ?? ''} onChange={v => set('asat', v || null)} options={asAtOptions} />
        <Seg label="View" value={view} onChange={v => set('view', v === 'customer' ? null : v)} options={[{ id: 'customer', label: 'By customer' }, { id: 'invoice', label: 'By invoice' }]} />
      </>}
      tiles={aged.length > 0 && total > 0 ? <Tiles table={table} tiles={[
        // Shares and days, not rands: the rand figures are the table's own
        // total and buckets. An "Overdue 100%" tile would only restate the
        // table, so when everything is past due the head says so instead.
        ...(overdue > 0.005 && !allOverdue ? [{
          label: 'Overdue', value: pct((overdue / total) * 100, 0), title: money(overdue),
          note: `${moneyWhole(overdue)} of the total`,
          noteAmount: overdue,
          noteFallback: 'Of the total, past the due date',
        }] : []),
        ...(Math.abs(over60 - overdue) < 0.005 || over60 < 0.005 ? [] : [{
          label: 'Over 60 days', value: pct((over60 / total) * 100, 0), title: money(over60),
          note: `${moneyWhole(over60)} of the total`,
          noteAmount: over60,
          noteFallback: 'Of the total',
        }]),
        ...(lateDays >= 1 ? [{ label: 'Average days late', value: formatDays(Math.round(lateDays)), note: 'Weighted by balance' }] : []),
        ...(customers[0] ? [{ label: 'Largest debtor share', value: pct((customers[0].total / total) * 100, 0), note: customers[0].name }] : []),
      ]} /> : undefined}
      gaps={hiddenNote ? [hiddenNote] : undefined}
      csv={() => statementCsv(`Debtors age analysis as at ${asAt ?? todayISO()}`, 'Incl. VAT, aged by due date', table)}
      csvName={`debtors-age-${asAt ?? todayISO()}-${view}`}
    >
      {aged.length === 0 ? (
        <Empty line={`Nobody owed you money on ${dateText}.`} action={{ label: 'See invoices', to: '/finance/invoices' }} />
      ) : (
        <StatementTable
          table={shown}
          caption={`Debtors age analysis, ${view === 'customer' ? 'by customer' : 'by invoice'}`}
          stickyFirst
          pinLast
          fit
          cue={null}
          footer={<>
            {!asAt
              ? (ties
                ? <Check>Total equals the {plural(ledgerOpen.length, 'open invoice balance')} on the invoice ledger.</Check>
                : <Check ok={false}>Total {money(total)} differs from the {plural(ledgerOpen.length, 'open invoice balance')} on the invoice ledger ({money(ledgerTotal)}).</Check>)
              : <Check>Rebuilt from invoices issued and payments recorded by {day(asAt)}.</Check>}
            {drafts.length > 0 && <Check>{plural(drafts.length, 'draft invoice')} ({money(draftTotal)}) not issued, so not included.</Check>}
          </>}
        />
      )}
    </ReportFrame>
  );
}
