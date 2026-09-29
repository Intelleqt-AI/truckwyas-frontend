import { useSearchParams } from 'react-router-dom';
import {
  addMonths, day, isIssued, isOpen, methodLabel, monthLabel, money, moneyWhole, num, plural, todayISO, ymNow,
  type Company, type Ledger,
} from './data';
import { ageInvoices } from './DebtorsAge';
import { Check, Choice, Empty, Info, ReportFrame, StatementTable, Tiles, statementCsv, type SRow, type Statement } from './ui';

const BUCKETS = ['Current', '1 to 30 days', '31 to 60 days', '61 to 90 days', 'Over 90 days'];

export default function CustomerStatement({ d, company }: { d: Ledger; company?: Company }) {
  const [params, setParams] = useSearchParams();
  const set = (k: string, v: string | null) => setParams(p => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });

  // Customers with issued invoices, largest balance first for the default.
  const withInvoices = new Map<number, { id: number; name: string; balance: number }>();
  d.invoices.filter(i => isIssued(i) && i.customer != null).forEach(i => {
    const c = withInvoices.get(i.customer!) || { id: i.customer!, name: i.customer_name, balance: 0 };
    if (isOpen(i)) c.balance += num(i.balance);
    withInvoices.set(i.customer!, c);
  });
  const options = [...withInvoices.values()].sort((a, b) => a.name.localeCompare(b.name));
  const fallback = [...withInvoices.values()].sort((a, b) => b.balance - a.balance)[0];
  const selected = Number(params.get('customer')) || fallback?.id;
  const since = /^\d{4}-\d{2}$/.test(params.get('since') || '') ? params.get('since')! : null;
  const sinceDate = since ? `${since}-01` : null;

  if (!options.length) return <Empty line="No issued invoices yet." action={{ label: 'Create an invoice', to: '/finance/invoices/new' }} />;

  const cust = d.customers.find(c => c.id === selected);
  const name = cust?.company_name || cust?.name || withInvoices.get(selected)?.name || 'Customer';
  const invoices = d.invoices.filter(i => isIssued(i) && i.customer === selected);
  const invIds = new Set(invoices.map(i => i.id));
  const payments = d.payments.filter(p => (p.invoice != null ? invIds.has(p.invoice) : p.customer === selected));
  const withPayments = new Set(payments.map(p => p.invoice));

  type Entry = { date: string; type: string; ref: string; due?: string; debit: number; credit: number; href?: string; order: number };
  const entries: Entry[] = [
    ...invoices.map(i => ({ date: i.issue_date, type: 'Invoice', ref: i.invoice_number, due: i.due_date, debit: num(i.total_amount), credit: 0, href: `/finance/invoices/${i.id}`, order: 0 })),
    ...payments.map(p => ({ date: p.payment_date, type: `Payment, ${methodLabel(p.payment_method)}`, ref: `${p.payment_number || `PMT-${p.id}`}${p.invoice_number ? ` for ${p.invoice_number}` : ''}`, debit: 0, credit: num(p.amount), href: p.invoice != null ? `/finance/invoices/${p.invoice}` : undefined, order: 1 })),
    // Invoices marked paid with no payment recorded: credit on the paid date so the balance holds.
    ...invoices.filter(i => (i.status || '').toUpperCase() === 'PAID' && !withPayments.has(i.id) && i.paid_at).map(i => ({
      date: i.paid_at!.slice(0, 10), type: 'Marked paid', ref: i.invoice_number, debit: 0, credit: num(i.total_amount), href: `/finance/invoices/${i.id}`, order: 1,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  const before = sinceDate ? entries.filter(e => e.date < sinceDate) : [];
  const shown = sinceDate ? entries.filter(e => e.date >= sinceDate) : entries;
  const opening = before.reduce((s, e) => s + e.debit - e.credit, 0);
  let bal = opening;
  const invoiced = shown.reduce((s, e) => s + e.debit, 0);
  const paid = shown.reduce((s, e) => s + e.credit, 0);
  const closing = opening + invoiced - paid;

  const table: Statement = {
    columns: [{ label: 'Date', type: 'date' }, { label: 'Transaction' }, { label: 'Reference' }, { label: 'Due', type: 'date', phone: false }, { label: 'Invoiced', type: 'money' }, { label: 'Paid', type: 'money' }, { label: 'Balance', type: 'money' }],
    rows: [
      ...(sinceDate ? [{ key: 'open', kind: 'subtotal' as const, cells: [sinceDate, 'Opening balance', '', '', '', '', opening] }] : []),
      ...shown.map<SRow>((e, i) => ({ key: `e${i}`, cells: [e.date, e.type, e.ref, e.due ?? '', e.debit || '', e.credit || '', (bal += e.debit - e.credit)] })),
      { key: 'close', kind: 'grand', cells: [todayISO(), 'Closing balance', '', '', invoiced, paid, closing] },
    ],
  };

  const aged = ageInvoices(d, null).filter(a => a.inv.customer === selected);
  const ageB = BUCKETS.map((_, b) => aged.filter(a => a.bucket === b).reduce((s, a) => s + a.balance, 0));
  const openLedger = invoices.filter(isOpen).reduce((s, i) => s + num(i.balance), 0);
  const ties = Math.abs(openLedger - closing) < 0.01;
  const ageTable: Statement = {
    columns: [{ label: 'Age' }, ...BUCKETS.map(l => ({ label: l, type: 'money' as const })), { label: 'Total due', type: 'money' as const }],
    rows: [{ key: 'age', kind: 'grand', cells: ['Amount due', ...ageB, ageB.reduce((s, v) => s + v, 0)] }],
  };

  const now = ymNow();
  const sinceOptions = [{ id: '', label: 'All activity' }, ...[2, 5, 11].map(n => { const m = addMonths(now, -n); return { id: m, label: `From ${monthLabel(m)}` }; })];
  // The city only when the address does not already end with it ("…, Port Elizabeth").
  const street = (cust?.billing_address || cust?.address || '').trim();
  const city = (cust?.city || '').trim();
  const address = [street, city && !street.toLowerCase().includes(city.toLowerCase()) ? city : ''].filter(Boolean).join(', ');

  return (
    <ReportFrame
      title="Customer statement"
      // Customer and period are the two menus beside it; the line says what is listed.
      sub="Invoices and payments, oldest first"
      printTitle={`Statement for ${name}, ${since ? `from ${monthLabel(since)}` : 'all activity'}`}
      companyName={company?.company_name}
      info={<Info title="Customer statement" lines={[
        'Issued invoices and recorded payments for one customer, oldest first, with the running balance. Amounts include VAT.',
        'Drafts and cancelled invoices are left out. Opening balance: everything before the start month.',
        'Print it or export it to send to the customer.',
      ]} />}
      controls={<>
        <Choice label="Customer" wide value={String(selected ?? '')} onChange={v => set('customer', v || null)} options={options.map(o => ({ id: String(o.id), label: o.name }))} />
        <Choice label="Period" value={since ?? ''} onChange={v => set('since', v || null)} options={sinceOptions} />
      </>}
      tiles={<Tiles table={[table, ageTable]} tiles={[
        { label: 'Balance due', value: moneyWhole(closing), title: money(closing), note: plural(aged.length, 'open invoice'), amount: closing },
        { label: 'Overdue', value: moneyWhole(closing - ageB[0]), title: money(closing - ageB[0]), amount: closing - ageB[0] },
        { label: 'Invoiced', value: moneyWhole(invoiced), title: money(invoiced), note: plural(shown.filter(e => e.debit > 0).length, 'invoice'), amount: invoiced },
        { label: 'Paid', value: moneyWhole(paid), title: money(paid), note: plural(shown.filter(e => e.credit > 0).length, 'payment'), amount: paid },
      ]} />}
      csv={() => [
        [`Statement for ${name}`], [`From ${company?.company_name || ''}${company?.vat_number ? `, VAT ${company.vat_number}` : ''}`], [`Statement date ${todayISO()}`], [],
        ...statementCsv('', '', table).slice(3),
        ...(ageB.some(v => Math.abs(v) >= 0.005) ? [[], ...statementCsv('', '', ageTable).slice(3)] : []),
      ]}
      csvName={`statement-${name}-${todayISO()}`}
    >
      <section className="tw-card fr-parties" aria-label="Statement parties">
        <div>
          <span className="tw-label">From</span>
          <strong>{company?.company_name || 'Your company'}</strong>
          {company?.vat_number && <span className="fr-muted">VAT {company.vat_number}</span>}
        </div>
        <div>
          <span className="tw-label">To</span>
          <strong>{name}</strong>
          {address && <span className="fr-muted">{address}</span>}
          {cust?.email && <span className="fr-muted">{cust.email}</span>}
        </div>
        <div>
          <span className="tw-label">Statement date</span>
          <strong>{day(todayISO())}</strong>
          <span className="fr-muted">Amounts in rand, incl. VAT</span>
        </div>
      </section>
      <StatementTable
        table={table}
        caption={`Statement for ${name}`}
        stickyFirst={false}
        fit
        cue={null}
        stack={{ date: 0, title: 1, ref: 2, plus: 4, minus: 5, balance: 6, balanceLabel: 'Balance' }}
        footer={ties
          ? <Check>Closing balance equals the open invoice balances for {name}.</Check>
          : <Check ok={false}>Closing balance differs from the open invoice balances for {name} ({money(openLedger)}).</Check>}
      />
      {/* Nothing due: no row of R 0,00 buckets. */}
      {ageB.some(v => Math.abs(v) >= 0.005) && <StatementTable table={ageTable} caption="Amount due by age" stickyFirst={false} stack="pairs" />}
    </ReportFrame>
  );
}
