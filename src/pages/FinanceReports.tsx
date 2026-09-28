import './finance-brand.css';
import './finance-reports.css';
import { useSearchParams } from 'react-router-dom';
import SectionHeader, { FINANCE_TABS } from '@/components/layout/SectionHeader';
import { useCompany, useLedger } from '@/components/reports/data';
import { REPORTS, ReportLibrary, type ReportId } from '@/components/reports/library';
import { Partial, ReportState, useLibraryHref } from '@/components/reports/ui';
import ProfitLoss from '@/components/reports/ProfitLoss';
import CashMovement from '@/components/reports/CashMovement';
import DebtorsAge from '@/components/reports/DebtorsAge';
import CustomerStatement from '@/components/reports/CustomerStatement';
import { RevenueByCustomer, RevenueByLane, SalesByMonth } from '@/components/reports/RevenueReports';
import { ExpenseReport, VatReport } from '@/components/reports/CostAndTax';

/* Finance > Reports: a library of accountant-grade statements built from the
   records TruckWys holds (invoices, payments, expenses, loads). Reports say
   what happened, reconciled to those ledgers. Forecasts and recommendations
   live in Insights. Reads only; every list is loaded in full. */

export default function FinanceReports() {
  const [params] = useSearchParams();
  const id = params.get('report') as ReportId | null;
  const def = REPORTS.find(r => r.id === id);
  const back = useLibraryHref();
  // One head: the library is "Reports"; a report is titled by its own name
  // with a back link to the library on the subtitle line. The head renders at
  // once; only the content below waits for data.
  return (
    <div className="fin-page fr-page">
      {def
        ? <SectionHeader title={def.title} back={{ to: back, label: 'Reports' }} />
        : <SectionHeader eyebrow="Finance" title="Reports" tabs={FINANCE_TABS} description="Reconciled to your invoices, payments and expenses" />}
      {def ? <Report id={def.id} key={def.id} /> : <Library />}
    </div>
  );
}

function Library() {
  const { data } = useLedger(['invoices', 'payments', 'expenses', 'loads']);
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
      {id === 'expenses' && <ExpenseReport d={data} companyName={name} />}
      {id === 'vat' && <VatReport d={data} companyName={name} vatNumber={company.data?.vat_number} />}
    </>
  );
}
