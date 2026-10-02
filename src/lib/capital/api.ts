/**
 * Fast Pay data hooks (react-query over lib/Api). One place for the URLs,
 * query keys and invalidation of the transporter page, the invoice panel and
 * the capital desk. Every figure comes from these responses; nothing here
 * computes a fee or an advance.
 *
 * Keys: transporter data lives under ['capital', ...], the desk under
 * ['capital-desk', funderId, ...], so one invalidate refreshes a whole side.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { downloadBlob, fetchData, patchData, postData } from '@/lib/Api';
import type {
  AdvanceRow, Application, ApplicationPatch, Book, CapitalStatus, DataRoomExport, DebtorCard, DebtorDetail,
  DeskAdvance, DeskAlert, DeskLimit, FastPayInvoices, Funder, Ledger, LimitInput, Offer, PolicyParams,
  PolicyState, RequestResult, TransporterCard, TransporterDetail,
} from './types';

const BASE = 'api/v1/capital/';

export const CAP_URL = {
  status: `${BASE}status/`,
  application: `${BASE}application/`,
  applicationSubmit: `${BASE}application/submit/`,
  invoices: `${BASE}fast-pay/invoices/`,
  offer: (invoiceId: number | string) => `${BASE}fast-pay/invoices/${invoiceId}/offer/`,
  requests: `${BASE}fast-pay/requests/`,
  advances: `${BASE}fast-pay/advances/`,
  advance: (id: number | string) => `${BASE}fast-pay/advances/${id}/`,
  advanceCancel: (id: number | string) => `${BASE}fast-pay/advances/${id}/cancel/`,
} as const;

const withFunder = (path: string, funder?: number | null, extra?: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  if (funder != null) p.set('funder', String(funder));
  for (const [k, v] of Object.entries(extra ?? {})) if (v !== undefined && v !== '') p.set(k, String(v));
  const qs = p.toString();
  return `${BASE}desk/${path}${qs ? `?${qs}` : ''}`;
};

export const DESK_URL = {
  funders: (f?: number | null) => withFunder('funders/', f),
  book: (f?: number | null) => withFunder('book/', f),
  approvals: (f?: number | null) => withFunder('approvals/', f),
  queue: (f?: number | null) => withFunder('queue/', f),
  advances: (f?: number | null, status?: string) => withFunder('advances/', f, { status }),
  advance: (id: number | string, f?: number | null) => withFunder(`advances/${id}/`, f),
  advanceAction: (id: number | string, action: 'approve' | 'decline' | 'disburse' | 'settle' | 'write-off', f?: number | null) =>
    withFunder(`advances/${id}/${action}/`, f),
  alerts: (f?: number | null) => withFunder('alerts/', f, { open: 1 }),
  alertResolve: (id: number | string, f?: number | null) => withFunder(`alerts/${id}/resolve/`, f),
  ledger: (f?: number | null, limit = 200) => withFunder('ledger/', f, { limit }),
  debtors: (f?: number | null) => withFunder('debtors/', f),
  debtor: (id: number | string, f?: number | null) => withFunder(`debtors/${id}/`, f),
  transporters: (f?: number | null) => withFunder('transporters/', f),
  transporter: (id: number | string, f?: number | null) => withFunder(`transporters/${id}/`, f),
  policy: (f?: number | null) => withFunder('policy/', f),
  policyApprove: (id: number | string, f?: number | null) => withFunder(`policy/${id}/approve/`, f),
  limits: (f?: number | null) => withFunder('limits/', f),
  dataRoom: (f?: number | null) => withFunder('data-room/', f),
  dataRoomFile: (id: number | string, file: string, f?: number | null) => withFunder(`data-room/${id}/download/`, f, { file }),
} as const;

/**
 * Capital endpoints answer 403/404 by design (no access, not launched, the
 * backend not deployed yet): never retry a 4xx, so the page shows its empty
 * or error state at once instead of a 30 s skeleton. A 5xx or network error
 * gets one retry.
 */
export const capitalRetry = (count: number, error: unknown) => {
  const status = (error as { status?: number } | null)?.status;
  if (status != null && status < 500) return false;
  return count < 1;
};

const errData = (e: unknown) => (e as { data?: unknown } | null)?.data as Record<string, unknown> | undefined;

/** The structured `code` some capital errors carry ('demo', 'not_launched', 'not_fundable'). */
export const capitalErrorCode = (e: unknown): string | undefined => {
  const c = errData(e)?.code;
  return typeof c === 'string' ? c : undefined;
};

/**
 * The server's own message, verbatim, when it sent one (desk rules such as
 * segregation of duties are explained by the server); otherwise a plain
 * fallback. Never the bare HTTP status.
 */
export function serverMessage(e: unknown, fallback: string): string {
  const d = errData(e);
  if (d && typeof d === 'object') {
    for (const k of ['detail', 'error', 'message', 'non_field_errors']) {
      const v = d[k];
      if (typeof v === 'string' && v.trim()) return v;
      if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
    }
    // DRF field errors: {reason: ["This field is required."]}
    for (const [k, v] of Object.entries(d)) {
      if (k === 'code' || k === 'offer') continue;
      if (Array.isArray(v) && typeof v[0] === 'string') return `${k.replace(/_/g, ' ')}: ${v[0]}`;
    }
  }
  const code = capitalErrorCode(e);
  if (code === 'demo') return 'This is a demo company, so nothing can be requested and no money moves.';
  if (code === 'not_launched') return 'Fast Pay is not live yet.';
  const status = (e as { status?: number } | null)?.status;
  if (status === 403) return "Your role can't do this.";
  if (e instanceof Error && e.message && !/^HTTP error/.test(e.message) && e.message !== code) return e.message;
  return fallback;
}

/** The offer a 400 `not_fundable` carries, if any. */
export const errorOffer = (e: unknown): Offer | undefined => {
  const o = errData(e)?.offer;
  return o && typeof o === 'object' ? (o as Offer) : undefined;
};

// ---- Transporter --------------------------------------------------------

export const capitalKeys = {
  all: ['capital'] as const,
  status: ['capital', 'status'] as const,
  application: ['capital', 'application'] as const,
  invoices: ['capital', 'fp-invoices'] as const,
  offer: (invoiceId: number | string) => ['capital', 'offer', String(invoiceId)] as const,
  advances: ['capital', 'advances'] as const,
  advance: (id: number | string) => ['capital', 'advance', String(id)] as const,
};

/** Status, line and desk access. Always answers on the backend; harmless when it does not. */
export function useCapitalStatus(opts: { enabled?: boolean } = {}) {
  return useQuery<CapitalStatus>({
    queryKey: capitalKeys.status,
    queryFn: () => fetchData(CAP_URL.status),
    retry: capitalRetry,
    staleTime: 60_000,
    enabled: opts.enabled !== false,
  });
}

export function useApplication(opts: { enabled?: boolean } = {}) {
  return useQuery<Application>({
    queryKey: capitalKeys.application,
    queryFn: () => fetchData(CAP_URL.application),
    retry: capitalRetry,
    enabled: opts.enabled !== false,
  });
}

export function useFastPayInvoices(opts: { enabled?: boolean } = {}) {
  return useQuery<FastPayInvoices>({
    queryKey: capitalKeys.invoices,
    queryFn: () => fetchData(CAP_URL.invoices),
    retry: capitalRetry,
    staleTime: 30_000,
    enabled: opts.enabled !== false,
  });
}

/**
 * The persisted offer for one invoice (valid 48 h). Fetched fresh each time
 * the request dialog opens, so the figures confirmed are the ones the server
 * will use.
 */
export function useOffer(invoiceId: number | string | null | undefined) {
  return useQuery<Offer>({
    queryKey: capitalKeys.offer(invoiceId ?? ''),
    queryFn: () => fetchData(CAP_URL.offer(invoiceId!)),
    enabled: invoiceId != null && invoiceId !== '',
    retry: capitalRetry,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useAdvances(opts: { enabled?: boolean } = {}) {
  return useQuery<AdvanceRow[]>({
    queryKey: capitalKeys.advances,
    queryFn: async () => {
      const d = await fetchData(CAP_URL.advances);
      return Array.isArray(d) ? d : (d?.results ?? []);
    },
    retry: capitalRetry,
    enabled: opts.enabled !== false,
  });
}

export function useAdvance(id: number | string | undefined) {
  return useQuery<AdvanceRow>({
    queryKey: capitalKeys.advance(id ?? ''),
    queryFn: () => fetchData(CAP_URL.advance(id!)),
    enabled: !!id,
    retry: capitalRetry,
  });
}

/** After a request, a cancel or an application change: refresh every transporter view. */
export function invalidateCapital(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: capitalKeys.all });
  qc.invalidateQueries({ queryKey: ['invoice'] });
  qc.invalidateQueries({ queryKey: ['invoices-page'] });
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation<Application, Error, ApplicationPatch>({
    mutationFn: (data) => patchData({ url: CAP_URL.application, data }),
    onSuccess: (app) => {
      qc.setQueryData(capitalKeys.application, app);
      qc.invalidateQueries({ queryKey: capitalKeys.status });
    },
  });
}

export function useSubmitApplication() {
  const qc = useQueryClient();
  return useMutation<Application, Error, { consents: string[] }>({
    mutationFn: (data) => postData({ url: CAP_URL.applicationSubmit, data }),
    onSuccess: (app) => {
      qc.setQueryData(capitalKeys.application, app);
      invalidateCapital(qc);
    },
  });
}

export function useRequestFastPay() {
  const qc = useQueryClient();
  return useMutation<RequestResult, Error, { invoice_id: number; offer_id?: number | null }>({
    mutationFn: ({ invoice_id, offer_id }) =>
      postData({ url: CAP_URL.requests, data: offer_id != null ? { invoice_id, offer_id } : { invoice_id } }),
    onSettled: () => invalidateCapital(qc),
  });
}

export function useCancelAdvance() {
  const qc = useQueryClient();
  return useMutation<AdvanceRow, Error, number>({
    mutationFn: (id) => postData({ url: CAP_URL.advanceCancel(id) }),
    onSuccess: (row) => qc.setQueryData(capitalKeys.advance(row.id), row),
    onSettled: () => invalidateCapital(qc),
  });
}

// ---- Capital desk -------------------------------------------------------

export const deskKeys = {
  all: ['capital-desk'] as const,
  of: (funder: number | null | undefined, ...rest: (string | number)[]) => ['capital-desk', funder ?? 'default', ...rest] as const,
};

const list = async <T,>(url: string): Promise<T[]> => {
  const d = await fetchData(url);
  return Array.isArray(d) ? d : (d?.results ?? []);
};

const deskQuery = { retry: capitalRetry, staleTime: 30_000 } as const;

export function useDeskFunders(funder: number | null | undefined, enabled = true) {
  return useQuery<Funder[]>({ queryKey: deskKeys.of(funder, 'funders'), queryFn: () => list(DESK_URL.funders(funder)), enabled, ...deskQuery });
}
export function useDeskBook(funder: number | null | undefined, enabled = true) {
  return useQuery<Book>({ queryKey: deskKeys.of(funder, 'book'), queryFn: () => fetchData(DESK_URL.book(funder)), enabled, ...deskQuery });
}
export function useDeskApprovals(funder: number | null | undefined, enabled = true) {
  return useQuery<DeskAdvance[]>({ queryKey: deskKeys.of(funder, 'approvals'), queryFn: () => list(DESK_URL.approvals(funder)), enabled, ...deskQuery });
}
export function useDeskQueue(funder: number | null | undefined, enabled = true) {
  return useQuery<DeskAdvance[]>({ queryKey: deskKeys.of(funder, 'queue'), queryFn: () => list(DESK_URL.queue(funder)), enabled, ...deskQuery });
}
export function useDeskAdvances(funder: number | null | undefined, status: string, enabled = true) {
  return useQuery<DeskAdvance[]>({ queryKey: deskKeys.of(funder, 'advances', status), queryFn: () => list(DESK_URL.advances(funder, status)), enabled, ...deskQuery });
}
export function useDeskAdvance(funder: number | null | undefined, id: number | null | undefined) {
  return useQuery<DeskAdvance>({ queryKey: deskKeys.of(funder, 'advance', id ?? ''), queryFn: () => fetchData(DESK_URL.advance(id!, funder)), enabled: id != null, ...deskQuery });
}
export function useDeskAlerts(funder: number | null | undefined, enabled = true) {
  return useQuery<DeskAlert[]>({ queryKey: deskKeys.of(funder, 'alerts'), queryFn: () => list(DESK_URL.alerts(funder)), enabled, ...deskQuery });
}
export function useDeskLedger(funder: number | null | undefined, enabled = true) {
  return useQuery<Ledger>({ queryKey: deskKeys.of(funder, 'ledger'), queryFn: () => fetchData(DESK_URL.ledger(funder)), enabled, ...deskQuery });
}
export function useDeskDebtors(funder: number | null | undefined, enabled = true) {
  return useQuery<DebtorCard[]>({ queryKey: deskKeys.of(funder, 'debtors'), queryFn: () => list(DESK_URL.debtors(funder)), enabled, ...deskQuery });
}
export function useDeskDebtor(funder: number | null | undefined, id: number | null | undefined) {
  return useQuery<DebtorDetail>({ queryKey: deskKeys.of(funder, 'debtor', id ?? ''), queryFn: () => fetchData(DESK_URL.debtor(id!, funder)), enabled: id != null, ...deskQuery });
}
export function useDeskTransporters(funder: number | null | undefined, enabled = true) {
  return useQuery<TransporterCard[]>({ queryKey: deskKeys.of(funder, 'transporters'), queryFn: () => list(DESK_URL.transporters(funder)), enabled, ...deskQuery });
}
export function useDeskTransporter(funder: number | null | undefined, id: number | null | undefined) {
  return useQuery<TransporterDetail>({ queryKey: deskKeys.of(funder, 'transporter', id ?? ''), queryFn: () => fetchData(DESK_URL.transporter(id!, funder)), enabled: id != null, ...deskQuery });
}
export function useDeskPolicy(funder: number | null | undefined, enabled = true) {
  return useQuery<PolicyState>({ queryKey: deskKeys.of(funder, 'policy'), queryFn: () => fetchData(DESK_URL.policy(funder)), enabled, ...deskQuery });
}
export function useDeskLimits(funder: number | null | undefined, enabled = true) {
  return useQuery<DeskLimit[]>({ queryKey: deskKeys.of(funder, 'limits'), queryFn: () => list(DESK_URL.limits(funder)), enabled, ...deskQuery });
}
export function useDeskDataRoom(funder: number | null | undefined, enabled = true) {
  return useQuery<DataRoomExport[]>({ queryKey: deskKeys.of(funder, 'data-room'), queryFn: () => list(DESK_URL.dataRoom(funder)), enabled, ...deskQuery });
}

/** Every desk mutation refreshes the whole desk (book, queues, ledger move together). */
function useDeskMutation<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation<TResult, Error, TVars>({
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: deskKeys.all });
      qc.invalidateQueries({ queryKey: capitalKeys.all });
    },
  });
}

export type DeskAdvanceAction =
  | { action: 'approve'; id: number; notes?: string }
  | { action: 'decline'; id: number; reason: string }
  | { action: 'disburse'; id: number; reference: string }
  | { action: 'settle'; id: number; payment_reference: string; payment_id?: number }
  | { action: 'write-off'; id: number; reason: string };

export function useDeskAdvanceAction(funder: number | null | undefined) {
  return useDeskMutation<DeskAdvanceAction, DeskAdvance>(({ action, id, ...data }) =>
    postData({ url: DESK_URL.advanceAction(id, action, funder), data }));
}

export function useResolveAlert(funder: number | null | undefined) {
  return useDeskMutation<number, DeskAlert>((id) => postData({ url: DESK_URL.alertResolve(id, funder) }));
}

export function useProposePolicy(funder: number | null | undefined) {
  return useDeskMutation<{ params: PolicyParams; notes: string }>((data) => postData({ url: DESK_URL.policy(funder), data }));
}

export function useApprovePolicy(funder: number | null | undefined) {
  return useDeskMutation<number>((id) => postData({ url: DESK_URL.policyApprove(id, funder) }));
}

export function useAddLimit(funder: number | null | undefined) {
  return useDeskMutation<LimitInput, DeskLimit>((data) => postData({ url: DESK_URL.limits(funder), data }));
}

export function useGenerateDataRoom(funder: number | null | undefined) {
  return useDeskMutation<string, DataRoomExport>((period) => postData({ url: DESK_URL.dataRoom(funder), data: { period } }));
}

/** Download a data-room file through the authenticated client and save it. */
export async function downloadDataRoomFile(id: number, file: string, funder?: number | null) {
  const blob = await downloadBlob(DESK_URL.dataRoomFile(id, file, funder));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.split('/').pop() || file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
