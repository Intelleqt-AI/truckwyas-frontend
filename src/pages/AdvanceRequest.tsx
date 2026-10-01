import { Navigate, useSearchParams } from 'react-router-dom';
import { CAPITAL_LAUNCHED } from '@/lib/features';

/**
 * Legacy entry point (/capital/request?invoice_id=…). Requests now happen in
 * one dialog on the Fast Pay page, on the server's persisted offer, so this
 * route hands over to /capital and opens that dialog for the invoice.
 * Before launch it lands on the pre-launch page.
 */
export default function AdvanceRequest() {
  const [params] = useSearchParams();
  const invoiceId = params.get('invoice_id');
  const to = CAPITAL_LAUNCHED && invoiceId && /^\d+$/.test(invoiceId) ? `/capital?request=${invoiceId}` : '/capital';
  return <Navigate to={to} replace />;
}
