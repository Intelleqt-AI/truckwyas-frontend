import { useSearchParams } from 'react-router-dom';
import {
  BASIS_LABEL, DELIVERED, basisText as basisLine, inPeriod, isCreditIssued, isDraft, isIssued, laneOf, monthLabel, monthsIn, money, moneyWhole, num, parseBasis, pct, periodText, plural,
  revenueEntries, shownMonths, trimNote, ymOf, type Ledger, type RevenueBasis,
} from './data';
import { Check, Choice, Empty, Info, PeriodControl, ReportFrame, StatementTable, Tiles, statementCsv, usePeriod, type SRow, type Statement } from './ui';

// ---------------------------------------------------------- by customer

type Basis = RevenueBasis;

export function RevenueByCustomer({ d, companyName }: { d: Ledger; companyName?: string }) {
  const [period, setPeriod] = usePeriod('last-12');
  const [params, setParams] = useSearchParams();
  const basis: Basis = parseBasis(params.get('basis'), 'accrual');
  const setBasis = (b: Basis) => setParams(p => { const n = new URLSearchParams(p); if (b === 'accrual') n.delete('basis'); else n.set('basis', b); return n; }, { replace: true });

  type Acc = { key: string; name: string; id: number | null; count: number; excl: number; vat: number };
  const acc = new Map<string, Acc>();
  // Revenue as the P&L and the backend count it: accrual nets credit notes
  // against the customer; cash leaves out amounts paid above an invoice total.
  const entries = revenueEntries(d, basis, period);
  entries.forEach(e => {
    const k = e.customer != null ? `c${e.customer}` : `n${e.party}`;
    const a = acc.get(k) || { key: k, name: e.party || 'Unknown customer', id: e.customer, count: 0, excl: 0, vat: 0 };
    a.count += 1; a.excl += e.excl; a.vat += e.vat; acc.set(k, a);
  });
  const sourceCount = entries.length;
  const sourceTotal = entries.reduce((s2, e) => s2 + e.incl, 0);
  const credits = entries.filter(e => e.kind === 'credit').length;
  const rows = [...acc.values()].sort((a, b) => b.excl - a.excl);
  const excl = rows.reduce((s, r) => s + r.excl, 0);
  const vat = rows.reduce((s, r) => s + r.vat, 0);
  const noun = basis === 'accrual' ? (credits ? 'Documents' : 'Invoices') : 'Payments';
  const nounOne = basis === 'accrual' ? (credits ? 'invoice or credit note' : 'invoice') : 'payment';
  const nounMany = basis === 'accrual' ? (credits ? 'invoices and credit notes' : 'invoices') : 'payments';
  const table: Statement = {
    columns: [{ label: 'Customer' }, { label: noun, type: 'int', phone: false }, { label: 'Excl. VAT', type: 'money', phone: false }, { label: 'VAT', type: 'money', phone: false }, { label: basis === 'accrual' ? 'Incl. VAT' : 'Received', type: 'money' }, { label: 'Share', type: 'pct' }],
    rows: [
      ...rows.map<SRow>(r => ({ key: r.key, cells: [r.name, r.count, r.excl, r.vat, r.excl + r.vat, excl > 0 ? (r.excl / excl) * 100 : null], href: r.id != null ? `/finance/reports?report=statement&customer=${r.id}` : undefined })),
      { key: 'tot', kind: 'grand', cells: ['Total', sourceCount, excl, vat, excl + vat, excl > 0 ? 100 : null] },
    ],
  };
  const top = rows[0];
  const top3 = rows.slice(0, 3).reduce((s, r) => s + r.excl, 0);
  const basisText = basis === 'accrual' ? 'Accrual (invoiced), by issue date, net of credit notes, excl. VAT' : 'Cash (received), by payment date, excl. VAT';

  return (
    <ReportFrame
      title="Revenue by customer"
      sub={`${periodText(period)} · ${basisLine(basis)}`}
      printTitle={`Revenue by customer, ${basisLine(basis)}`}
      companyName={companyName}
      info={<Info title="Revenue by customer" lines={[
        'Accrual (invoiced): issued invoices (not drafts or void) by issue date, less issued credit notes on their own date.',
        'Cash (received): customer payments by payment date, VAT split in the same proportion as the invoice; amounts paid above an invoice total are left out.',
        'Share is of revenue excluding VAT. Select a customer to open their statement.',
      ]} />}
      controls={<>
        <PeriodControl period={period} onChange={setPeriod} />
        <Choice label="Basis" value={basis} onChange={setBasis} options={[{ id: 'accrual', label: BASIS_LABEL.accrual }, { id: 'cash', label: BASIS_LABEL.cash }]} />
      </>}
      tiles={rows.length ? <Tiles table={table} tiles={[
        { label: 'Revenue excl. VAT', value: moneyWhole(excl), title: money(excl), note: plural(sourceCount, nounOne, nounMany), amount: excl },
        { label: 'Largest customer', value: moneyWhole(top?.excl ?? 0), title: money(top?.excl ?? 0), note: top ? `${top.name}, ${pct((top.excl / excl) * 100, 0)}` : undefined, amount: top?.excl ?? 0 },
        ...(rows.length > 3 ? [{ label: 'Top three share', value: pct(excl > 0 ? (top3 / excl) * 100 : 0, 0), note: `of revenue excl. VAT, ${plural(rows.length, 'customer')}` }] : []),
      ]} /> : undefined}
      csv={() => statementCsv(`Revenue by customer, ${periodText(period)}`, basisText, table)}
      csvName={`revenue-by-customer-${period.from}-to-${period.to}-${basis}`}
    >
      {rows.length === 0 ? <Empty line={`No ${basis === 'accrual' ? 'invoices issued' : 'payments received'} in ${periodText(period)}.`} /> : (
        <StatementTable fit cue={null} table={table} caption="Revenue by customer"
          footer={Math.abs(excl + vat - sourceTotal) < 0.01
            ? <Check>Total equals the {plural(sourceCount, nounOne, nounMany)} {basis === 'accrual' ? 'issued' : 'received'} in the period.</Check>
            : <Check ok={false}>Total {money(excl + vat)} differs from the {plural(sourceCount, nounOne, nounMany)} {basis === 'accrual' ? 'issued' : 'received'} in the period ({money(sourceTotal)}).</Check>} />
      )}
    </ReportFrame>
  );
}

// -------------------------------------------------------------- by lane


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
    columns: [{ label: 'Lane' }, { label: 'Loads', type: 'int' }, { label: 'Distance', type: 'km', phone: false }, { label: 'Revenue excl. VAT', type: 'money' }, { label: 'Per km', type: 'money' }, { label: 'Share', type: 'pct' }],
    rows: [
      ...lanes.map<SRow>(l => ({ key: l.lane, cells: [l.lane, l.loads, l.km, l.rev, l.perKm, total > 0 ? (l.rev / total) * 100 : null] })),
      ...(unknown.length ? [{ key: 'unknown', kind: 'muted' as const, cells: ['Route not recorded', unknown.length, null, unknownRev, null, total > 0 ? (unknownRev / total) * 100 : null] }] : []),
      { key: 'tot', kind: 'grand', cells: ['Total', done.length, null, total, avgPerKm, total > 0 ? 100 : null] },
    ],
  };

  return (
    <ReportFrame
      title="Revenue by lane"
      sub={`${periodText(period)} · load prices, excl. VAT`}
      companyName={companyName}
      info={<Info title="Revenue by lane" lines={[
        'Loads delivered or invoiced, by delivery date. Revenue here is the agreed load price, excluding VAT, not the invoiced amount; Lane margin shows invoiced revenue and costs.',
        'City names are cleaned so "JHB" and "Johannesburg" count as one. Loads without a route are listed apart.',
        'Per km uses only loads with a recorded distance.',
      ]} />}
      controls={<PeriodControl period={period} onChange={setPeriod} />}
      tiles={done.length ? <Tiles table={table} tiles={[
        { label: 'Delivered revenue', value: moneyWhole(total), title: money(total), note: plural(done.length, 'load'), amount: total },
        { label: 'Top lane', value: moneyWhole(lanes[0]?.rev ?? 0), title: money(lanes[0]?.rev ?? 0), note: lanes[0]?.lane, amount: lanes[0]?.rev ?? 0 },
        ...(avgPerKm != null ? [{ label: 'Average per km', value: money(avgPerKm), note: `${plural(kmAll.length, 'load')} with distance`, amount: avgPerKm }] : []),
      ]} /> : undefined}
      csv={() => statementCsv(`Revenue by lane, ${periodText(period)}`, 'Delivered loads, excl. VAT, by delivery date', table)}
      csvName={`revenue-by-lane-${period.from}-to-${period.to}`}
    >
      {done.length === 0 ? <Empty line={`No loads delivered in ${periodText(period)}.`} action={{ label: 'See orders', to: '/bookings/orders' }} /> : (
        <StatementTable cue={null} table={table} caption="Revenue by lane"
          footer={<Check>Total equals the {plural(done.length, 'delivered load')} in the period.</Check>} />
      )}
    </ReportFrame>
  );
}

// -------------------------------------------------------- sales by month

export function SalesByMonth({ d, companyName }: { d: Ledger; companyName?: string }) {
  const [period, setPeriod] = usePeriod('last-12');
  const allMonths = monthsIn(period.from, period.to);
  const issued = d.invoices.filter(i => isIssued(i) && inPeriod(i.issue_date, period));
  // Issued credit notes reduce revenue in their own month (accrual, as the backend).
  const credits = (d.creditNotes ?? []).filter(c => isCreditIssued(c) && inPeriod(c.issue_date, period));
  // Rows end at the last month with an invoice or credit note; the total covers the whole period.
  const months = shownMonths(allMonths, m => issued.some(i => ymOf(i.issue_date) === m) || credits.some(c => ymOf(c.issue_date) === m));
  const trimmed = trimNote(allMonths, months);
  const drafts = d.invoices.filter(i => isDraft(i) && inPeriod(i.issue_date, period));
  const rowFor = (label: string, list: typeof issued, cns: typeof credits, kind?: SRow['kind'], key = label): SRow => {
    const incl = list.reduce((s, i) => s + num(i.total_amount), 0);
    const vat = list.reduce((s, i) => s + num(i.vat_amount), 0);
    const cnExcl = cns.reduce((s, c) => s + num(c.subtotal), 0);
    const cnVat = cns.reduce((s, c) => s + num(c.vat_amount), 0);
    const paid = list.reduce((s, i) => s + num(i.paid_amount), 0);
    const bal = list.reduce((s, i) => s + num(i.balance), 0);
    return { key, kind, cells: [label, list.length, incl - vat, cnExcl ? -cnExcl : 0, incl - vat - cnExcl, vat - cnVat, paid, bal] };
  };
  const inMonth = (m: string) => [issued.filter(i => ymOf(i.issue_date) === m), credits.filter(c => ymOf(c.issue_date) === m)] as const;
  const excl = issued.reduce((s, i) => s + num(i.total_amount) - num(i.vat_amount), 0) - credits.reduce((s, c) => s + num(c.subtotal), 0);
  const incl = issued.reduce((s, i) => s + num(i.total_amount), 0);
  const paid = issued.reduce((s, i) => s + num(i.paid_amount), 0);
  const draftExcl = drafts.reduce((s, i) => s + num(i.total_amount) - num(i.vat_amount), 0);
  const table: Statement = {
    columns: [
      { label: 'Month' }, { label: 'Invoices', type: 'int', phone: false }, { label: 'Invoiced excl. VAT', type: 'money', phone: false },
      { label: 'Credit notes excl. VAT', type: 'money', phone: false }, { label: 'Revenue excl. VAT', type: 'money' }, { label: 'VAT', type: 'money', phone: false },
      { label: 'Paid to date', type: 'money', phone: false }, { label: 'Still owed', type: 'money' },
    ],
    rows: [
      ...months.map(m => { const [l, c] = inMonth(m); return rowFor(monthLabel(m), l, c, undefined, m); }),
      rowFor('Total', issued, credits, 'grand', 'tot'),
      ...(drafts.length ? [{ key: 'drafts', kind: 'muted' as const, cells: ['Drafts, not issued', drafts.length, draftExcl, '', '', '', '', ''] }] : []),
    ],
  };
  return (
    <ReportFrame
      title="Sales by month"
      sub={`${periodText(period)} · excl. VAT, accrual (invoiced)`}
      companyName={companyName}
      info={<Info title="Sales by month" lines={[
        'Accrual (invoiced): every issued invoice (not drafts or void) by issue date, less issued credit notes in the month of the credit note.',
        'Revenue is excl. VAT and matches the Profit and loss on the accrual basis.',
        'Paid to date and still owed are incl. VAT, as at today, for the invoices issued in that month; still owed is after credit notes.',
        'Drafts are listed below the total and not counted.',
      ]} />}
      controls={<PeriodControl period={period} onChange={setPeriod} />}
      gaps={trimmed ? [trimmed] : undefined}
      tiles={issued.length ? <Tiles table={table} tiles={[
        { label: 'Revenue excl. VAT', value: moneyWhole(excl), title: money(excl), note: plural(issued.length, 'invoice') + (credits.length ? `, ${plural(credits.length, 'credit note')}` : ''), amount: excl },
        { label: 'Average invoice excl. VAT', value: moneyWhole((incl - issued.reduce((s, i) => s + num(i.vat_amount), 0)) / issued.length), note: `Across ${plural(issued.length, 'invoice')}`, amount: (incl - issued.reduce((s, i) => s + num(i.vat_amount), 0)) / issued.length },
        { label: 'Collected so far', value: pct(incl > 0 ? (paid / incl) * 100 : 0, 0), note: `${moneyWhole(paid)} paid, incl. VAT`, noteAmount: paid, noteFallback: 'Of sales incl. VAT, paid to date' },
      ]} /> : undefined}
      csv={() => statementCsv(`Sales by month, ${periodText(period)}`, 'Accrual (invoiced): issued invoices by issue date less credit notes, excl. VAT', table)}
      csvName={`sales-by-month-${period.from}-to-${period.to}`}
    >
      {issued.length === 0 && credits.length === 0 ? <Empty line={`No invoices issued in ${periodText(period)}.`} action={{ label: 'See invoices', to: '/finance/invoices' }} /> : (
        <StatementTable cue={null} table={table} caption="Sales by month"
          footer={<Check>Revenue equals the {plural(issued.length, 'issued invoice')} dated in the period{credits.length ? ` less ${plural(credits.length, 'credit note')}` : ''}, excl. VAT.</Check>} />
      )}
    </ReportFrame>
  );
}
