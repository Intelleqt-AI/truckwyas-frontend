/**
 * Accounting integrations (Xero now, QuickBooks Online next): types, URLs,
 * API calls and hooks for every screen that shows or changes the company's
 * accounting connection. Provider-neutral: the provider only appears in URLs
 * (its slug) and in PROVIDERS below, so adding QuickBooks is a config change.
 *
 * Base path: api/v1/integrations/accounting/. Reads are open to any company
 * user; writes are company-admin only (403 with the backend's sentence).
 * Errors arrive as {error, code}; lib/Api lifts `error` into Error.message
 * and keeps the body on `err.data`.
 */
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { fetchData, postData, putData } from '@/lib/Api';

// ---------------------------------------------------------------- providers

export type ProviderCode = 'XERO' | 'QBO' | 'SAGE';
export type ProviderSlug = 'xero' | 'quickbooks' | 'sage';

export interface ProviderConfig {
  code: ProviderCode;
  slug: ProviderSlug;
  /** Full product name, for headings and cards. */
  name: string;
  /** Short name for buttons and badges ("Record in Xero", "From QuickBooks"). */
  short: string;
  /** Square logo in /public, or null for a lettermark tile. */
  logo: string | null;
  initials: string;
  /** One line under the card title. */
  blurb: string;
  /** What the provider calls one set of books ("organisation", "company"). */
  orgWord: 'organisation' | 'company';
  /** Lettermark colours when there is no logo file. */
  mark?: { bg: string; fg: string };
  /** Account codes people recognise (Xero "200") or internal ids we shouldn't show (QuickBooks). */
  showAccountCodes: boolean;
  /** Revenue types map to accounts (Xero) or products/services (QuickBooks items). */
  revenueTarget: 'account' | 'item';
  /** Tracking row labels; `vehicleCat`/`branchCat` pin the category id when the provider has fixed ones. */
  tracking: { vehicle: string; branchCat: string; branch: string; vehicleCat?: string; branchCatId?: string };
}

const XERO_TRACKING = { vehicle: 'Vehicle category', branchCat: 'Branch category', branch: 'Branch' };

/** Display config keyed by provider code. The server says which are available. */
export const PROVIDERS: Record<ProviderCode, ProviderConfig> = {
  XERO: {
    code: 'XERO', slug: 'xero', name: 'Xero', short: 'Xero', logo: '/Xero_logo.jpg', initials: 'X',
    blurb: 'Invoices, credit notes and bills go to Xero; payments come back.',
    orgWord: 'organisation', revenueTarget: 'account', showAccountCodes: true, tracking: XERO_TRACKING,
  },
  QBO: {
    code: 'QBO', slug: 'quickbooks', name: 'QuickBooks Online', short: 'QuickBooks', logo: null, initials: 'qb',
    blurb: 'Invoices, credit notes and bills go to QuickBooks; payments come back.',
    orgWord: 'company', mark: { bg: '#2CA01C', fg: '#FFFFFF' }, revenueTarget: 'item', showAccountCodes: false,
    tracking: { vehicle: 'Vehicle (Class)', branchCat: 'Branch (Location)', branch: 'Location', vehicleCat: 'class', branchCatId: 'location' },
  },
  SAGE: {
    code: 'SAGE', slug: 'sage', name: 'Sage Business Cloud Accounting', short: 'Sage', logo: null, initials: 'S',
    blurb: 'Invoices, credit notes and bills go to Sage; payments come back.',
    orgWord: 'organisation', revenueTarget: 'account', showAccountCodes: true, tracking: XERO_TRACKING,
  },
};

/**
 * Readiness reasons that come from settings inside the accounting system
 * (e.g. QuickBooks "Custom transaction numbers"), as opposed to setup steps
 * in TruckWys, which the checklist already shows.
 */
const SETUP_REASON = /^(Choose which organisation|Reconnect |Disconnected|Map every |Confirm |Choose a cut-over date)/;
export const providerBlockers = (r: Readiness | null | undefined): string[] =>
  (r?.blocking_reasons ?? []).filter(x => !SETUP_REASON.test(x));

export const PROVIDER_ORDER: ProviderCode[] = ['XERO', 'QBO', 'SAGE'];

export const providerConfig = (code: string | null | undefined): ProviderConfig =>
  PROVIDERS[(code ?? '').toUpperCase() as ProviderCode] ?? PROVIDERS.XERO;

export const providerBySlug = (slug: string | null | undefined): ProviderConfig | null =>
  Object.values(PROVIDERS).find(p => p.slug === (slug ?? '').toLowerCase()) ?? null;

// ---------------------------------------------------------------- types

/** Money as the API sends it: a 2-dp string ("1234.50"). */
export type Money = string;

export type ConnectionStatus = 'PENDING_ORG' | 'ACTIVE' | 'NEEDS_REAUTH' | 'DISABLED';
export type BackfillState = 'NOT_STARTED' | 'RUNNING' | 'DONE' | 'FAILED';

export interface ProviderInfo {
  provider: ProviderCode;
  slug: ProviderSlug;
  name: string;
  availability: 'available' | 'coming_soon';
  configured: boolean;
}

export interface PendingTenant {
  tenant_id: string;
  name: string;
  currency: string;
}

export interface Readiness {
  mapping_complete: boolean;
  missing_mappings: string[];
  contacts_to_confirm: number;
  backfill_state: BackfillState;
  sync_enabled: boolean;
  blocking_reasons: string[];
}

export interface SyncCounts {
  queued: number;
  synced: number;
  errors: number;
  dead: number;
}

export interface Connection {
  id: number;
  provider: ProviderCode;
  provider_name: string;
  status: ConnectionStatus;
  status_reason: string;
  tenant_id: string;
  tenant_name: string;
  base_currency: string;
  pending_tenants?: PendingTenant[];
  connected_at: string | null;
  connected_by: string;
  last_payment_sync_at: string | null;
  last_reconciled_at: string | null;
  cutover_date: string | null;
  payments_managed_externally: boolean;
  readiness: Readiness;
  counts: SyncCounts;
  web_url: string | null;
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
  connection: Connection | null;
}

// Mapping
export interface AccountRow { key: string; label: string; account_code: string | null }
export interface TaxRow { key: string; label: string; rate: Money; tax_code: string | null }
export interface TrackingMapping {
  vehicle_category_id: string | null;
  branch_category_id: string | null;
  branch_option: string;
}
export interface ProviderAccount { code: string; name: string; type: string; class: string; is_bank: boolean }
export interface ProviderTaxRate { code: string; name: string; rate: Money; revenue: boolean; expenses: boolean }
export interface TrackingCategory { id: string; name: string; options: { id: string; name: string }[] }

export type MappingSection = 'revenue_types' | 'expense_categories' | 'tax_sales' | 'tax_purchases';

export interface Mapping {
  revenue_types: AccountRow[];
  expense_categories: AccountRow[];
  tax_sales: TaxRow[];
  tax_purchases: TaxRow[];
  receipts_account: string | null;
  tracking: TrackingMapping;
  options: {
    accounts: ProviderAccount[];
    tax_rates: ProviderTaxRate[];
    tracking_categories: TrackingCategory[];
    fetched_at: string | null;
  };
  suggestions: Partial<Record<MappingSection, Record<string, string>>>;
  complete: boolean;
  missing: string[];
}

export interface MappingUpdate {
  revenue_types?: Record<string, string | null>;
  expense_categories?: Record<string, string | null>;
  tax_sales?: Record<string, string | null>;
  tax_purchases?: Record<string, string | null>;
  receipts_account?: string | null;
  tracking?: TrackingMapping;
}

// Contacts
export type ContactStatus = 'SUGGESTED' | 'MATCHED' | 'UNMATCHED' | 'CREATE' | 'SKIPPED';
export type ContactKind = 'CUSTOMER' | 'SUPPLIER';
export type MatchMethod = 'external_id' | 'vat' | 'registration' | 'email' | 'name' | 'created' | 'manual';

export interface ProviderContact { external_id: string; name: string; vat: string; email: string }
export interface ContactCandidate extends ProviderContact { method: MatchMethod | string }

export interface ContactMatch {
  id: number;
  kind: ContactKind;
  local_id: number;
  local_name: string;
  local_vat: string;
  local_registration: string;
  local_email: string;
  status: ContactStatus;
  method: MatchMethod | null;
  external_id: string | null;
  external_name: string | null;
  candidates: ContactCandidate[];
}

export type ContactSummary = Partial<Record<ContactStatus, number>>;

export interface ContactsResponse {
  results: ContactMatch[];
  summary: ContactSummary;
}

export type ContactConfirmBody = { external_id: string } | { action: 'create' } | { action: 'skip' };

// Backfill
export type StepState = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED';
export interface BackfillStep { key: string; label: string; state: StepState; count: number; error: string }
export interface BackfillPreview {
  invoices: number;
  credit_notes: number;
  bills: number;
  historic_receipts: number;
  contacts_unconfirmed: number;
}
export interface Backfill {
  state: BackfillState;
  cutover_date: string | null;
  started_at: string | null;
  finished_at: string | null;
  steps: BackfillStep[];
  preview: BackfillPreview | null;
}

// Sync
export interface SyncEvent {
  id: number;
  created_at: string;
  level: 'INFO' | 'WARNING' | 'ERROR';
  action: string;
  object_type: string;
  local_id: number | null;
  label: string;
  message: string;
}
export type LinkObjectType = 'INVOICE' | 'CREDIT_NOTE' | 'BILL' | 'CONTACT_CUSTOMER' | 'CONTACT_SUPPLIER';
export interface LinkError {
  id: number;
  object_type: LinkObjectType | string;
  local_id: number | null;
  label: string;
  status: 'ERROR' | 'DEAD' | 'BLOCKED' | string;
  last_error: string;
  attempts: number;
  next_attempt_at: string | null;
  local_url: string | null;
}
export interface SyncStatus {
  counts: SyncCounts;
  last_payment_sync_at: string | null;
  recent: SyncEvent[];
  errors: LinkError[];
}

// Reconciliation
export type ReconScope = 'INVOICE' | 'CUSTOMER' | 'MONTH';
export interface ReconRun {
  id: number;
  ran_at: string;
  status: 'OK' | 'DIFFERENCES' | 'FAILED';
  error: string;
  checked: { invoices?: number; customers?: number; months?: number };
  difference_count: number;
}
export interface ReconDifference {
  id: number;
  scope: ReconScope;
  key: string;
  label: string;
  field: string;
  truckwys: string;
  provider: string;
  difference: string;
  local_url: string | null;
  provider_url: string | null;
}
export interface Reconciliation {
  run: ReconRun | null;
  differences: ReconDifference[];
}

/** `accounting_sync` on invoices and credit notes. */
export type DocumentSyncStatus = 'PENDING' | 'SYNCED' | 'ERROR' | 'DEAD' | 'BLOCKED' | 'VOIDED';
export interface AccountingSync {
  provider: ProviderCode;
  provider_name: string;
  status: DocumentSyncStatus;
  external_number: string;
  url: string | null;
  last_error: string;
  last_synced_at: string | null;
}

// ---------------------------------------------------------------- URLs + calls

const BASE = 'api/v1/integrations/accounting/';

export const ACCT_URL = {
  providers: `${BASE}providers/`,
  connect: (slug: ProviderSlug) => `${BASE}${slug}/connect/`,
  connection: `${BASE}connection/`,
  selectOrg: `${BASE}connection/select-org/`,
  disconnect: `${BASE}connection/disconnect/`,
  mapping: `${BASE}connection/mapping/`,
  refreshOptions: `${BASE}connection/refresh-options/`,
  contacts: `${BASE}connection/contacts/`,
  runMatching: `${BASE}connection/contacts/run-matching/`,
  confirmContact: (id: number) => `${BASE}connection/contacts/${id}/confirm/`,
  searchContacts: `${BASE}connection/contacts/search/`,
  backfill: `${BASE}connection/backfill/`,
  sync: `${BASE}connection/sync/`,
  retry: (linkId: number) => `${BASE}connection/sync/${linkId}/retry/`,
  syncNow: `${BASE}connection/sync-now/`,
  reconciliation: `${BASE}connection/reconciliation/`,
  runReconciliation: `${BASE}connection/reconciliation/run/`,
} as const;

export const ACCT_KEYS = {
  all: ['accounting'] as const,
  providers: ['accounting', 'providers'] as const,
  connection: ['accounting', 'connection'] as const,
  mapping: ['accounting', 'mapping'] as const,
  contacts: (status: string, kind: string) => ['accounting', 'contacts', status, kind] as const,
  contactsAll: ['accounting', 'contacts'] as const,
  backfill: ['accounting', 'backfill'] as const,
  sync: ['accounting', 'sync'] as const,
  reconciliation: ['accounting', 'reconciliation'] as const,
};

export const accountingApi = {
  connect: (slug: ProviderSlug): Promise<{ auth_url: string }> => postData({ url: ACCT_URL.connect(slug), data: {} }),
  selectOrg: (tenantId: string): Promise<Connection> => postData({ url: ACCT_URL.selectOrg, data: { tenant_id: tenantId } }),
  disconnect: (): Promise<{ disconnected: boolean }> => postData({ url: ACCT_URL.disconnect, data: {} }),
  saveMapping: (data: MappingUpdate): Promise<Mapping> => putData({ url: ACCT_URL.mapping, data }),
  refreshOptions: (): Promise<Mapping> => postData({ url: ACCT_URL.refreshOptions, data: {} }),
  runMatching: (): Promise<{ summary: ContactSummary }> => postData({ url: ACCT_URL.runMatching, data: {} }),
  confirmContact: (id: number, body: ContactConfirmBody): Promise<ContactMatch> => postData({ url: ACCT_URL.confirmContact(id), data: body }),
  /** `kind` keeps QuickBooks' separate customer and vendor lists apart. */
  searchContacts: (q: string, kind?: ContactKind): Promise<{ results: ProviderContact[] }> =>
    fetchData(`${ACCT_URL.searchContacts}?q=${encodeURIComponent(q)}${kind ? `&kind=${kind}` : ''}`),
  startBackfill: (cutoverDate: string): Promise<Backfill> => postData({ url: ACCT_URL.backfill, data: { cutover_date: cutoverDate } }),
  retry: (linkId: number): Promise<LinkError> => postData({ url: ACCT_URL.retry(linkId), data: {} }),
  syncNow: (): Promise<{ queued: boolean }> => postData({ url: ACCT_URL.syncNow, data: {} }),
  runReconciliation: (): Promise<Reconciliation> => postData({ url: ACCT_URL.runReconciliation, data: {} }),
};

// ---------------------------------------------------------------- hooks

/** Providers + the current connection (Settings → Integrations cards). */
export function useAccountingProviders() {
  return useQuery<ProvidersResponse>({
    queryKey: ACCT_KEYS.providers,
    queryFn: () => fetchData(ACCT_URL.providers),
    staleTime: 30_000,
    retry: 1,
  });
}

/**
 * The company's accounting connection, or null. Fetched once and shared by
 * every screen that needs to know whether payments are managed in the
 * accounting system (invoice detail, invoice list).
 */
export function useAccountingConnection(opts: { enabled?: boolean } = {}) {
  return useQuery<Connection | null>({
    queryKey: ACCT_KEYS.connection,
    queryFn: async () => (await fetchData(ACCT_URL.connection)) ?? null,
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: opts.enabled !== false,
  });
}

/** Whether TruckWys may record payments, and who does it otherwise. */
export function usePaymentsManaged() {
  const { data } = useAccountingConnection();
  const managed = !!data?.payments_managed_externally;
  const provider = data ? providerConfig(data.provider) : null;
  return { managed, connection: data ?? null, provider, providerName: provider?.short ?? data?.provider_name ?? 'your accounting system' };
}

/** After any accounting write: refetch everything that reads the connection. */
export function invalidateAccounting(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ACCT_KEYS.all });
}

export function useInvalidateAccounting() {
  const qc = useQueryClient();
  return () => invalidateAccounting(qc);
}

// ---------------------------------------------------------------- errors

interface ApiErrorShape { status?: number; message?: string; data?: { code?: string; error?: string; detail?: string; errors?: Record<string, string | string[]>; record_url?: string | null; provider_name?: string } }

export const apiStatus = (e: unknown): number | undefined => (e as ApiErrorShape | null)?.status;
export const apiCode = (e: unknown): string | undefined => (e as ApiErrorShape | null)?.data?.code;

/** The backend's sentence (error/detail), or a fallback. */
export function apiMessage(e: unknown, fallback: string): string {
  const err = e as ApiErrorShape | null;
  const body = err?.data;
  const msg = body?.error || body?.detail || (e instanceof Error ? e.message : '');
  return msg && !/^HTTP error/.test(msg) && !/^Network Error$/i.test(msg) ? msg : fallback;
}

/** Per-field errors from a 400 `invalid_mapping` ({"tax_sales.STANDARD": "..."}). */
export function apiFieldErrors(e: unknown): Record<string, string> {
  const errs = (e as ApiErrorShape | null)?.data?.errors;
  if (!errs || typeof errs !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errs)) out[k] = Array.isArray(v) ? v.join(' ') : String(v);
  return out;
}

/** 409 from a payment write while an accounting system owns payments. */
export const isPaymentsManagedError = (e: unknown) =>
  apiStatus(e) === 409 && apiCode(e) === 'payments_managed_by_accounting';

export const paymentsManagedRecordUrl = (e: unknown): string | null =>
  (e as ApiErrorShape | null)?.data?.record_url ?? null;

// ---------------------------------------------------------------- copy

/** Friendly sentence for the OAuth callback's ?result=&reason=. */
export function callbackMessage(result: string | null, reason: string | null, providerName: string, org: 'organisation' | 'company' = 'organisation'): { tone: 'success' | 'warning' | 'danger'; title: string; body: string } | null {
  if (!result) return null;
  if (result === 'connected') {
    return { tone: 'success', title: `${providerName} is connected`, body: 'Next, map your accounts and VAT, confirm your contacts and choose a cut-over date.' };
  }
  if (result === 'choose_org') {
    return { tone: 'warning', title: `Choose your ${providerName} organisation`, body: `Your ${providerName} login has more than one organisation. Pick the one that holds this company's books.` };
  }
  const reasons: Record<string, string> = {
    denied: `The connection was cancelled in ${providerName}. Nothing was changed.`,
    state_invalid: 'The sign-in link expired or was opened in a different browser. Start the connection again from this page.',
    token_exchange_failed: `${providerName} didn't finish the sign-in. Wait a minute and try again.`,
    no_organisations: `Your ${providerName} login doesn't have access to any ${org}. Ask whoever runs your ${providerName} subscription to give you access, then try again.`,
    currency_not_supported: `This ${providerName} ${org}'s ${org === 'company' ? 'home' : 'base'} currency isn't ZAR. TruckWys only supports rand books for now.`,
    org_already_linked: org === 'company'
      ? `That ${providerName} company is already linked to another TruckWys company. Each ${providerName} company can only be linked once.`
      : `That ${providerName} organisation is already linked to another TruckWys company. An organisation can only be linked to one company.`,
    already_connected: 'This company already has an accounting system connected. Disconnect it first, then connect the new one.',
    not_configured: `${providerName} isn't set up on this server yet.`,
    browser_mismatch: 'Finish connecting in the same browser you started from. Start again from TruckWys.',
    org_mismatch: org === 'company'
      ? `You reconnected to a different ${providerName} company. Reconnect and pick the company TruckWys was syncing with.`
      : `You reconnected without the organisation TruckWys was syncing with. Reconnect and tick that organisation.`,
    invalid_org: `That ${providerName} ${org} can't be used. Start again and choose the ${org} that holds this company's books.`,
  };
  return {
    tone: 'danger',
    title: `Couldn't connect ${providerName}`,
    body: (reason && reasons[reason]) || `Something went wrong while connecting ${providerName}. Try again, and contact support if it keeps happening.`,
  };
}

const SECTION_LABEL: Record<string, string> = {
  revenue: 'Income',
  expense: 'Expense',
  tax_sales: 'VAT on sales',
  tax_purchases: 'VAT on purchases',
  receipts: 'Receipts bank account',
  tracking: 'Tracking',
};

/** "revenue:FUEL_SURCHARGE" -> "Fuel surcharge (revenue)". */
export function missingMappingLabel(key: string): string {
  const [section, item] = key.split(':');
  const head = SECTION_LABEL[section] ?? humanise(section);
  const lower = /^[A-Z][a-z]/.test(head) ? `${head.charAt(0).toLowerCase()}${head.slice(1)}` : head;
  return item ? `${humanise(item)} (${lower})` : head;
}

/** "FUEL_SURCHARGE" -> "Fuel surcharge". */
export function humanise(s: string | null | undefined): string {
  const t = String(s ?? '').trim().replace(/[_-]+/g, ' ').toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

export const MATCH_METHOD_LABEL: Record<string, string> = {
  external_id: 'linked before',
  vat: 'same VAT number',
  registration: 'same company registration number',
  email: 'same email address',
  name: 'similar name only',
  created: `created by TruckWys`,
  manual: 'picked by hand',
};

export const OBJECT_TYPE_LABEL: Record<string, string> = {
  INVOICE: 'Invoice',
  CREDIT_NOTE: 'Credit note',
  BILL: 'Supplier bill',
  CONTACT_CUSTOMER: 'Customer',
  CONTACT_SUPPLIER: 'Supplier',
  PAYMENT: 'Payment',
};
