import type { Payment, PaymentSource } from './types';

export const PAYMENT_METHODS = [
  { value: 'EFT', label: 'EFT' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'CHEQUE', label: 'Cheque' },
];

const SOURCE_LABEL: Record<PaymentSource, string> = { MANUAL: 'TruckWys', XERO: 'Xero', QBO: 'QuickBooks', BANK: 'the bank feed' };

/** Only payments recorded in TruckWys can be changed here; synced ones belong to their source. */
export const isManualPayment = (p: Pick<Payment, 'source'>) => !p.source || p.source === 'MANUAL';
export const paymentSourceTag = (p: Pick<Payment, 'source'>) =>
  isManualPayment(p) ? null : `Synced from ${SOURCE_LABEL[p.source as PaymentSource] ?? p.source}`;
