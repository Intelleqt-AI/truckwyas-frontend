import './finance-brand.css';
import './finance-reports.css';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SectionHeader, { FINANCE_TABS } from '@/components/layout/SectionHeader';
import { useCompany, useLedger } from '@/components/reports/data';
import { REPORTS, ReportLibrary, type ReportId } from '@/components/reports/library';
import { Partial, ReportExportContext, ReportState, useLibraryHref } from '@/components/reports/ui';
import ProfitLoss from '@/components/reports/ProfitLoss';
import CashMovement from '@/components/reports/CashMovement';
import DebtorsAge from '@/components/reports/DebtorsAge';
import CustomerStatement from '@/components/reports/CustomerStatement';
import { RevenueByCustomer, RevenueByLane, SalesByMonth } from '@/components/reports/RevenueReports';
import { ExpenseReport, VatReport } from '@/components/reports/CostAndTax';
import LaneMargin from '@/components/reports/LaneMargin';
import WeeklyMargin from '@/components/reports/WeeklyMargin';

/* Finance > Reports: a library of accountant-grade statements built from the
   records TruckWys holds (invoices, payments, expenses, loads). Reports say
   what happened, reconciled to those ledgers. Forecasts and recommendations
   live in Insights. Reads only; every list is loaded in full. */

// Same breakpoint as the report toolbar's phone layout (finance-reports.css).
const PHONE = '(max-width: 640px)';
function usePhone() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

export default function FinanceReports() {
  const [params] = useSearchParams();
  const id = params.get('report') as ReportId | null;
  const def = REPORTS.find(r => r.id === id);
  const back = useLibraryHref();
  const phone = usePhone();
  // Phones: Export CSV and Print sit in the head's "⋯" on the title row (the
  // toolbar then holds only the report's settings). Wider: toolbar buttons.
  const exportRef = useRef<(() => void) | null>(null);
  const menuItems = def && phone ? [
    { label: 'Export CSV', onSelect: () => exportRef.current?.() },
    { label: 'Print', onSelect: () => window.print() },
  ] : undefined;
  // One head: the library is "Reports"; a report is titled by its own name
  // with a back link to the library on the subtitle line. The head renders at
  // once; only the content below waits for data.
  return (
    <div className="fin-page fr-page">
      {def
        ? <SectionHeader title={def.title} back={{ to: back, label: 'Reports' }} menuItems={menuItems} />
        : <SectionHeader eyebrow="Finance" title="Reports" tabs={FINANCE_TABS} description="Reconciled to your invoices, payments and expenses" />}
      <ReportExportContext.Provider value={exportRef}>
        {def ? <Report id={def.id} key={def.id} /> : <Library />}
      </ReportExportContext.Provider>
    </div>
  );
}

function Library() {
  const { data } = useLedger(['invoices', 'payments', 'expenses', 'loads', 'creditNotes']);
  return <ReportLibrary d={data} />;
}

function Report({ id }: { id: ReportId }) {
  const def = REPORTS.find(r => r.id === id)!;
  const { data, loading, error, retry } = useLedger(def.needs);
  const company = useCompany();
  if (!data) return <ReportState loading={loading && !error} error={error} onRetry={retry} />;
  const name = company.data?.company_name;
  return (
    <>
      <Partial notes={data.partial} />
      {id === 'pl' && <ProfitLoss d={data} companyName={name} />}
      {id === 'sales' && <SalesByMonth d={data} companyName={name} />}
      {id === 'cash' && <CashMovement d={data} companyName={name} />}
      {id === 'debtors' && <DebtorsAge d={data} companyName={name} />}
      {id === 'statement' && <CustomerStatement d={data} company={company.data} />}
      {id === 'customers' && <RevenueByCustomer d={data} companyName={name} />}
      {id === 'lanes' && <RevenueByLane d={data} companyName={name} />}
      {id === 'margin' && <LaneMargin companyName={name} />}
      {id === 'weekly' && <WeeklyMargin companyName={name} />}
      {id === 'expenses' && <ExpenseReport d={data} companyName={name} />}
      {id === 'vat' && <VatReport d={data} companyName={name} vatNumber={company.data?.vat_number} />}
    </>
  );
}
