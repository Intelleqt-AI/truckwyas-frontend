/**
 * Finance data hooks (react-query over lib/Api). One place for the URLs and
 * query keys the invoice, credit note, payment, supplier and settings screens
 * share, so a change on one screen refreshes every other one that shows it.
 */
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { fetchAllPages } from '@/components/insights/findings';
import { DEFAULT_TAX_CODES } from './tax';
import type {
  CreditNote, FinanceSettings, Invoice, ListResponse, Supplier, TaxCodesResponse,
} from './types';

export const FIN_URL = {
  invoices: 'api/v1/invoices/',
  invoice: (id: number | string) => `api/v1/invoices/${id}/`,
  invoiceVoid: (id: number | string) => `api/v1/invoices/${id}/void/`,
  taxCodes: 'api/v1/invoices/tax-codes/',
  creditNotes: 'api/v1/credit-notes/',
  creditNote: (id: number | string) => `api/v1/credit-notes/${id}/`,
  creditNoteVoid: (id: number | string) => `api/v1/credit-notes/${id}/void/`,
  payments: 'api/v1/payments/',
  payment: (id: number | string) => `api/v1/payments/${id}/`,
  suppliers: 'api/v1/suppliers/',
  supplier: (id: number | string) => `api/v1/suppliers/${id}/`,
  settings: 'api/v1/finance/settings/',
} as const;

export const rowsOf = <T,>(res: ListResponse<T> | null | undefined): T[] =>
  !res ? [] : Array.isArray(res) ? res : (res.results ?? []);

/** Tax codes and the tenant default. Falls back to the fixed SA list so an
 *  older API (or a failed request) never blocks the invoice editor. */
export function useTaxCodes() {
  const q = useQuery<TaxCodesResponse>({
    queryKey: ['finance', 'tax-codes'],
    queryFn: () => fetchData(FIN_URL.taxCodes),
    staleTime: 60 * 60_000,
    retry: 1,
  });
  const codes = q.data?.codes?.length ? q.data.codes : DEFAULT_TAX_CODES;
  const defaultCode = q.data?.default_tax_code ?? 'STANDARD';
  return { codes, defaultCode, isLoading: q.isLoading };
}

export function useInvoice(id: string | number | undefined) {
  return useQuery<Invoice>({
    queryKey: ['invoice', String(id)],
    queryFn: () => fetchData(FIN_URL.invoice(id!)),
    enabled: !!id,
    retry: (n, e) => (e as { status?: number } | null)?.status !== 404 && n < 2,
  });
}

export function useCreditNotes(filters: { invoice?: number | string; customer?: number | string } = {}) {
  const params = new URLSearchParams();
  if (filters.invoice != null) params.set('invoice', String(filters.invoice));
  if (filters.customer != null) params.set('customer', String(filters.customer));
  const qs = params.toString();
  return useQuery({
    queryKey: ['credit-notes', qs],
    queryFn: () => fetchAllPages<CreditNote>(`${FIN_URL.creditNotes}${qs ? `?${qs}` : ''}`),
  });
}

export function useCreditNote(id: string | number | undefined) {
  return useQuery<CreditNote>({
    queryKey: ['credit-note', String(id)],
    queryFn: () => fetchData(FIN_URL.creditNote(id!)),
    enabled: !!id,
    retry: (n, e) => (e as { status?: number } | null)?.status !== 404 && n < 2,
  });
}

export function useSuppliers(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: () => fetchAllPages<Supplier>(FIN_URL.suppliers),
    enabled: opts.enabled !== false,
  });
}

export function useFinanceSettings() {
  return useQuery<FinanceSettings>({
    queryKey: ['finance', 'settings'],
    queryFn: () => fetchData(FIN_URL.settings),
  });
}

/**
 * After anything that changes an invoice's figures (a payment, a credit note,
 * a void, an edit): refetch that invoice, its payments and credit notes, and
 * every list and report built from the ledgers.
 */
export function invalidateInvoiceData(qc: QueryClient, invoiceId?: number | string | null) {
  if (invoiceId != null) {
    qc.invalidateQueries({ queryKey: ['invoice', String(invoiceId)] });
    qc.invalidateQueries({ queryKey: ['invoice-payments', String(invoiceId)] });
  }
  for (const key of [['invoices'], ['invoices-page'], ['invoices-summary'], ['credit-notes'], ['credit-note'], ['capital-eligible'], ['capital'],
    ['insights-source', 'invoices'], ['insights-source', 'payments'], ['insights-source', 'creditNotes'], ['reports']]) {
    qc.invalidateQueries({ queryKey: key });
  }
}

export function useInvalidateInvoice() {
  const qc = useQueryClient();
  return (invoiceId?: number | string | null) => invalidateInvoiceData(qc, invoiceId);
}

/** The API's error text, or a fallback. lib/Api already lifts {error}/{detail}. */
export const errorText = (e: unknown, fallback: string) =>
  e instanceof Error && e.message && !/^HTTP error/.test(e.message) ? e.message : fallback;

/** The structured error code the API sends with some 400s ({error, code}). */
export const errorCode = (e: unknown): string | undefined =>
  ((e as { data?: { code?: string } } | null)?.data?.code) ?? undefined;
