import { useSearchParams } from 'react-router-dom';
import {
  inPeriod, isDraft, isIssued, laneOf, monthLabel, monthsIn, money, moneyWhole, num, pct, periodText, plural,
  vatShare, ymOf, type Ledger,
} from './data';
import { Check, Empty, Info, PeriodControl, ReportFrame, Seg, StatementTable, Tiles, statementCsv, usePeriod, type SRow, type Statement } from './ui';

// ---------------------------------------------------------- by customer

type Basis = 'invoice' | 'cash';

export function RevenueByCustomer({ d, companyName }: { d: Ledger; companyName?: string }) {
  const [period, setPeriod] = usePeriod('last-12');
  const [params, setParams] = useSearchParams();
  const basis: Basis = params.get('basis') === 'cash' ? 'cash' : 'invoice';
  const setBasis = (b: Basis) => setParams(p => { const n = new URLSearchParams(p); if (b === 'invoice') n.delete('basis'); else n.set('basis', b); return n; }, { replace: true });
  const invById = new Map(d.invoices.map(i => [i.id, i]));

  type Acc = { key: string; name: string; id: number | null; count: number; excl: number; vat: number };
  const acc = new Map<string, Acc>();
  const add = (id: number | null, name: string, incl: number, vat: number) => {
    const k = id != null ? `c${id}` : `n${name}`;
    const a = acc.get(k) || { key: k, name, id, count: 0, excl: 0, vat: 0 };
    a.count += 1; a.excl += incl - vat; a.vat += vat; acc.set(k, a);
  };
  let sourceCount = 0; let sourceTotal = 0;
  if (basis === 'invoice') {
    d.invoices.filter(i => isIssued(i) && inPeriod(i.issue_date, period)).forEach(i => {
      add(i.customer, i.customer_name, num(i.total_amount), num(i.vat_amount)); sourceCount += 1; sourceTotal += num(i.total_amount);
    });
  } else {
    d.payments.filter(p => inPeriod(p.payment_date, period)).forEach(p => {
      const inv = p.invoice != null ? invById.get(p.invoice) : undefined;
      const amt = num(p.amount);
      add(p.customer ?? inv?.customer ?? null, p.customer_name || inv?.customer_name || 'Unknown customer', amt, amt * vatShare(inv));
      sourceCount += 1; sourceTotal += amt;
    });
  }
  const rows = [...acc.values()].sort((a, b) => b.excl - a.excl);
  const excl = rows.reduce((s, r) => s + r.excl, 0);
  const vat = rows.reduce((s, r) => s + r.vat, 0);
  const noun = basis === 'invoice' ? 'Invoices' : 'Payments';
  const table: Statement = {
    columns: [{ label: 'Customer' }, { label: noun, type: 'int' }, { label: 'Excl. VAT', type: 'money' }, { label: 'VAT', type: 'money' }, { label: basis === 'invoice' ? 'Incl. VAT' : 'Received', type: 'money' }, { label: 'Share', type: 'pct' }],
    rows: [
      ...rows.map<SRow>(r => ({ key: r.key, cells: [r.name, r.count, r.excl, r.vat, r.excl + r.vat, excl > 0 ? (r.excl / excl) * 100 : null], href: r.id != null ? `/finance/reports?report=statement&customer=${r.id}` : undefined })),
      { key: 'tot', kind: 'grand', cells: ['Total', sourceCount, excl, vat, excl + vat, excl > 0 ? 100 : null] },
    ],
  };
  const top = rows[0];
  const top3 = rows.slice(0, 3).reduce((s, r) => s + r.excl, 0);
  const basisText = basis === 'invoice' ? 'Invoiced, by issue date' : 'Received, by payment date';

  return (
    <ReportFrame
      title="Revenue by customer"
      sub={`${periodText(period)} · ${basisText}`}
      companyName={companyName}
      info={<Info title="Revenue by customer" lines={[
        'Invoiced: issued invoices (not drafts or cancelled) by issue date.',
        'Received: customer payments by payment date, VAT split in the same proportion as the invoice.',
        'Share is of revenue excluding VAT. Select a customer to open their statement.',
      ]} />}
      controls={<>
        <PeriodControl period={period} onChange={setPeriod} />
        <Seg label="Basis" value={basis} onChange={setBasis} options={[{ id: 'invoice', label: 'Invoiced' }, { id: 'cash', label: 'Received' }]} />
      </>}
      tiles={rows.length ? <Tiles tiles={[
        { label: 'Revenue excl. VAT', value: moneyWhole(excl), title: money(excl), note: plural(sourceCount, noun.toLowerCase().slice(0, -1)) },
        { label: 'Customers', value: String(rows.length) },
        { label: 'Largest customer', value: moneyWhole(top?.excl ?? 0), title: money(top?.excl ?? 0), note: top ? `${top.name}, ${pct((top.excl / excl) * 100, 0)}` : undefined },
        { label: 'Top three share', value: pct(excl > 0 ? (top3 / excl) * 100 : 0, 0), note: 'of revenue excl. VAT' },
      ]} /> : undefined}
      csv={() => statementCsv(`Revenue by customer, ${periodText(period)}`, basisText, table)}
      csvName={`revenue-by-customer-${period.from}-to-${period.to}-${basis}`}
    >
      {rows.length === 0 ? <Empty line={`No ${basis === 'invoice' ? 'invoices issued' : 'payments received'} in ${periodText(period)}.`} /> : (
        <StatementTable table={table} caption="Revenue by customer"
          footer={<Check>Total {money(excl + vat)} equals {plural(sourceCount, noun.toLowerCase().slice(0, -1))} {basis === 'invoice' ? 'issued' : 'received'} in the period ({money(sourceTotal)}).</Check>} />
      )}
    </ReportFrame>
  );
}

// -------------------------------------------------------------- by lane

const DELIVERED = new Set(['DELIVERED', 'INVOICED', 'COMPLETED', 'PAID']);

export function RevenueByLane({ d, companyName }: { d: Ledger; companyName?: string }) {
  const [period, setPeriod] = usePeriod('last-12');
  const done = d.loads.filter(l => DELIVERED.has((l.status || '').toUpperCase()) && inPeriod(l.delivery_date, period));
  const known = done.filter(l => laneOf(l));
  const unknown = done.filter(l => !laneOf(l));
  const lanes = [...new Set(known.map(laneOf))].map(lane => {
    const list = known.filter(l => laneOf(l) === lane);
    const rev = list.reduce((s, l) => s + num(l.total_amount), 0);
    const withKm = list.filter(l => num(l.distance) > 0);
    const km = withKm.reduce((s, l) => s + num(l.distance), 0);
    const kmRev = withKm.reduce((s, l) => s + num(l.total_amount), 0);
    return { lane, loads: list.length, rev, km: km || null, perKm: km > 0 ? kmRev / km : null };
  }).sort((a, b) => b.rev - a.rev);
  const total = done.reduce((s, l) => s + num(l.total_amount), 0);
  const unknownRev = unknown.reduce((s, l) => s + num(l.total_amount), 0);
  const kmAll = known.filter(l => num(l.distance) > 0);
  const avgPerKm = kmAll.length ? kmAll.reduce((s, l) => s + num(l.total_amount), 0) / kmAll.reduce((s, l) => s + num(l.distance), 0) : null;

  const table: Statement = {
    columns: [{ label: 'Lane' }, { label: 'Loads', type: 'int' }, { label: 'Distance', type: 'km' }, { label: 'Revenue excl. VAT', type: 'money' }, { label: 'Per km', type: 'money' }, { label: 'Share', type: 'pct' }],
    rows: [
      ...lanes.map<SRow>(l => ({ key: l.lane, cells: [l.lane, l.loads, l.km, l.rev, l.perKm, total > 0 ? (l.rev / total) * 100 : null] })),
      ...(unknown.length ? [{ key: 'unknown', kind: 'muted' as const, cells: ['Route not recorded', unknown.length, null, unknownRev, null, total > 0 ? (unknownRev / total) * 100 : null] }] : []),
      { key: 'tot', kind: 'grand', cells: ['Total', done.length, null, total, avgPerKm, total > 0 ? 100 : null] },
    ],
  };

  return (
    <ReportFrame
      title="Revenue by lane"
      sub={`${periodText(period)} · Delivered loads, excl. VAT`}
      companyName={companyName}
      info={<Info title="Revenue by lane" lines={[
        'Loads delivered or invoiced, by delivery date. Revenue is the load total, excluding VAT.',
        'City names are cleaned so "JHB" and "Johannesburg" count as one. Loads without a route are listed apart.',
        'Per km uses only loads with a recorded distance.',
      ]} />}
      controls={<PeriodControl period={period} onChange={setPeriod} />}
      tiles={done.length ? <Tiles tiles={[
        { label: 'Delivered revenue', value: moneyWhole(total), title: money(total), note: plural(done.length, 'load') },
        { label: 'Lanes', value: String(lanes.length), note: unknown.length ? `${plural(unknown.length, 'load')} without a route` : undefined },
        { label: 'Top lane', value: moneyWhole(lanes[0]?.rev ?? 0), title: money(lanes[0]?.rev ?? 0), note: lanes[0]?.lane },
        { label: 'Average per km', value: avgPerKm != null ? money(avgPerKm) : 'Not recorded', note: `${plural(kmAll.length, 'load')} with distance` },
      ]} /> : undefined}
      csv={() => statementCsv(`Revenue by lane, ${periodText(period)}`, 'Delivered loads, excl. VAT, by delivery date', table)}
      csvName={`revenue-by-lane-${period.from}-to-${period.to}`}
    >
      {done.length === 0 ? <Empty line={`No loads delivered in ${periodText(period)}.`} action={{ label: 'See orders', to: '/bookings/orders' }} /> : (
        <StatementTable table={table} caption="Revenue by lane"
          footer={<Check>Total {money(total)} equals the {plural(done.length, 'delivered load')} in the period.</Check>} />
      )}
    </ReportFrame>
  );
}

// -------------------------------------------------------- sales by month

export function SalesByMonth({ d, companyName }: { d: Ledger; companyName?: string }) {
  const [period, setPeriod] = usePeriod('last-12');
  const months = monthsIn(period.from, period.to);
  const issued = d.invoices.filter(i => isIssued(i) && inPeriod(i.issue_date, period));
  const drafts = d.invoices.filter(i => isDraft(i) && inPeriod(i.issue_date, period));
  const rowFor = (label: string, list: typeof issued, kind?: SRow['kind'], key = label): SRow => {
    const incl = list.reduce((s, i) => s + num(i.total_amount), 0);
    const vat = list.reduce((s, i) => s + num(i.vat_amount), 0);
    const paid = list.reduce((s, i) => s + num(i.paid_amount), 0);
    const bal = list.reduce((s, i) => s + num(i.balance), 0);
    return { key, kind, cells: [label, list.length, incl - vat, vat, incl, paid, bal] };
  };
  const incl = issued.reduce((s, i) => s + num(i.total_amount), 0);
  const paid = issued.reduce((s, i) => s + num(i.paid_amount), 0);
  const draftIncl = drafts.reduce((s, i) => s + num(i.total_amount), 0);
  const active = months.filter(m => issued.some(i => ymOf(i.issue_date) === m));
  const table: Statement = {
    columns: [{ label: 'Month' }, { label: 'Invoices', type: 'int' }, { label: 'Excl. VAT', type: 'money' }, { label: 'VAT', type: 'money' }, { label: 'Incl. VAT', type: 'money' }, { label: 'Paid to date', type: 'money' }, { label: 'Still owed', type: 'money' }],
    rows: [
      ...months.map(m => rowFor(monthLabel(m), issued.filter(i => ymOf(i.issue_date) === m), undefined, m)),
      rowFor('Total', issued, 'grand', 'tot'),
      ...(drafts.length ? [{ key: 'drafts', kind: 'muted' as const, cells: ['Drafts, not issued', drafts.length, '', '', draftIncl, '', ''] }] : []),
    ],
  };
  return (
    <ReportFrame
      title="Sales by month"
      sub={`${periodText(period)} · Issued invoices, by issue date`}
      companyName={companyName}
      info={<Info title="Sales by month" lines={[
        'Every issued invoice (not drafts or cancelled), by issue date.',
        'Paid to date and still owed are as at today, for the invoices issued in that month.',
        'Drafts are listed below the total and not counted.',
      ]} />}
      controls={<PeriodControl period={period} onChange={setPeriod} />}
      tiles={issued.length ? <Tiles tiles={[
        { label: 'Sales incl. VAT', value: moneyWhole(incl), title: money(incl), note: plural(issued.length, 'invoice') },
        { label: 'Average invoice', value: moneyWhole(incl / issued.length), title: money(incl / issued.length) },
        { label: 'Collected so far', value: pct(incl > 0 ? (paid / incl) * 100 : 0, 0), note: `${moneyWhole(paid)} paid` },
        { label: 'Months with sales', value: `${active.length} of ${months.length}` },
      ]} /> : undefined}
      csv={() => statementCsv(`Sales by month, ${periodText(period)}`, 'Issued invoices by issue date', table)}
      csvName={`sales-by-month-${period.from}-to-${period.to}`}
    >
      {issued.length === 0 ? <Empty line={`No invoices issued in ${periodText(period)}.`} action={{ label: 'See invoices', to: '/finance/invoices' }} /> : (
        <StatementTable table={table} caption="Sales by month"
          footer={<Check>Total {money(incl)} equals the {plural(issued.length, 'issued invoice')} dated in the period.</Check>} />
      )}
    </ReportFrame>
  );
}
