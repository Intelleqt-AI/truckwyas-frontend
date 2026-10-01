/**
 * Fast Pay (capital) API shapes, from the backend contract on branch
 * truckwys/fast-pay-risk. The server is the only source of every figure:
 * the UI formats these values and never derives fees or advances itself.
 * Money is rand (JSON numbers, 2 decimals); dates are ISO strings.
 */

export type ReasonDirection = '+' | '-' | '!';

/** Transporter-safe wording. */
export interface Reason {
  code: string;
  direction: ReasonDirection;
  text: string;
}

/** Desk wording, with the transporter wording alongside when there is one. */
export interface DeskReason extends Reason {
  transporter_text: string | null;
  params: Record<string, unknown>;
}

export type Decision = 'FUND' | 'PART_FUND' | 'QUEUE' | 'REFER' | 'DECLINE';

export type VerificationTier = 'V0' | 'V1' | 'V2' | 'V3';

export interface OfferAdvanceRef {
  id: number;
  status: AdvanceStatus;
  status_label: string;
}

/** One invoice's Fast Pay evaluation. */
export interface Offer {
  /** Persisted assessment id; null for list previews. */
  offer_id: number | null;
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  issue_date: string | null;
  due_date: string | null;
  invoice_total: number;
  invoice_balance: number;
  decision: Decision;
  eligible: boolean;
  advance_rate_pct: number;
  eligible_amount: number;
  /** Advanced now. */
  fundable_amount: number;
  /** Part-fund remainder waiting for capacity. */
  queued_amount: number;
  fee_pct: number;
  /** Excl. VAT. */
  fee_amount: number;
  /** VAT on the platform-fee part only. */
  fee_vat_amount: number;
  /** What the transporter receives now. */
  net_payout: number;
  /** Paid to the transporter when the customer pays, less deductions. */
  holdback_amount: number;
  expected_payment_date: string | null;
  verification_tier: VerificationTier;
  reasons: Reason[];
  explanation: string;
  valid_until: string | null;
  advance: OfferAdvanceRef | null;
  demo: boolean;
}

export type AdvanceStatus =
  | 'QUEUED' | 'REQUESTED' | 'SCORING' | 'APPROVED' | 'DENIED' | 'DISBURSED'
  | 'SETTLED' | 'CANCELLED' | 'BOUGHT_BACK' | 'WRITTEN_OFF' | 'ELIGIBLE';

export interface TimelineEntry {
  at: string;
  label: string;
}

export interface AdvanceRow {
  id: number;
  reference: string;
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  status: AdvanceStatus;
  status_label: string;
  amount: number;
  fee_amount: number;
  fee_vat_amount: number;
  net_amount: number;
  holdback_amount: number;
  topup_pending: number;
  queue_position: number | null;
  requested_at: string | null;
  approved_at: string | null;
  disbursed_at: string | null;
  settled_at: string | null;
  queued_at: string | null;
  denial_reason: string | null;
  reasons: Reason[];
  timeline: TimelineEntry[];
  can_cancel: boolean;
}

// ---- Transporter: status and application -------------------------------

export type ApplicationStatus = 'NOT_STARTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface ConsentRecord {
  purpose: string;
  text_version: string;
  granted_at: string;
}

export interface RequiredConsent {
  purpose: string;
  title: string;
  text: string;
}

export interface Application {
  status: ApplicationStatus;
  juristic_person: boolean | null;
  declared_annual_turnover: number | null;
  git_insurer: string | null;
  git_insurance_expiry: string | null;
  consents: ConsentRecord[];
  required_consents: RequiredConsent[];
  /** Plain-language checklist of what is still needed. */
  missing: string[];
  submitted_at: string | null;
}

export type ApplicationPatch = Partial<Pick<Application,
  'juristic_person' | 'declared_annual_turnover' | 'git_insurer' | 'git_insurance_expiry'>>;

export interface CreditLine {
  limit: number;
  used: number;
  available: number;
}

export type DeskRole = 'STAFF' | 'APPROVER' | 'VIEWER';

export interface DeskFunderRef {
  id: number;
  name: string;
}

export interface DeskAccess {
  access: boolean;
  role: DeskRole | null;
  funders: DeskFunderRef[];
}

export interface CapitalStatus {
  launched: boolean;
  can_request: boolean;
  demo: boolean;
  mode: 'A' | 'B';
  application: Application;
  line: CreditLine | null;
  provider_label: string;
  desk: DeskAccess;
}

export interface FastPayInvoices {
  offers: Offer[];
  ineligible: Offer[];
  totals: { eligible_count: number; fundable_total: number; net_total: number };
}

export interface RequestResult {
  advance: AdvanceRow;
  offer: Offer;
}

// ---- Capital desk -------------------------------------------------------

export interface Funder {
  id: number;
  name: string;
  code: string;
  status: string;
  operating_mode: string;
  pot_limit: number;
  cost_of_funds_pct: number;
  recourse: boolean;
  staff_may_approve: boolean;
  auto_approve_enabled: boolean;
}

export type RiskBand = 'green' | 'amber' | 'red';

export interface Book {
  funder: { id: number; name: string; status: string; operating_mode: string; pot_limit: number; cost_of_funds_pct: number; recourse: boolean };
  as_of: string;
  pot_limit: number;
  outstanding: number;
  reserved: number;
  committed: number;
  headroom: number;
  utilisation_pct: number;
  small_book: boolean;
  risk_index: {
    value: number | null;
    band: RiskBand | null;
    components: { el_pct: number; concentration_penalty: number; stress_ratio: number };
    note: string;
  };
  concentration: { hhi: number; n_eff: number | null; top1_pct: number; top10_pct: number; top10_band: 'ok' | 'soft' | 'hard' };
  sectors: { sector: string; label: string; exposure: number; pct_of_pot: number; cap: number }[];
  grades: { grade: string; exposure: number; pct: number }[];
  top_debtors: { debtor_id: number; name: string; grade: string | null; sector: string; exposure: number; cap: number; utilisation_pct: number; hold: boolean }[];
  transporters: { company_id: number; name: string; grade: string | null; exposure: number; line_limit: number; utilisation_pct: number }[];
  stress: { scenario: string; loss: number; protection: number; status: 'ok' | 'watch' | 'breach'; note: string }[];
  expected_loss: { amount: number; pct: number };
  alerts_open: { red: number; amber: number; info: number };
  queue: { count: number; amount: number };
  pending_approvals: { count: number; amount: number };
}

export interface ScoreSummary {
  grade: string;
  points: number;
  pd_12m: number;
  expected_dtp_days: number | null;
  reasons: DeskReason[];
  model_version: string;
  created_at: string;
  cold_start: boolean;
  hard_stop: boolean;
}

export interface DeskAdvance extends AdvanceRow {
  company: { id: number; name: string };
  debtor: { id: number; name: string; grade: string | null } | null;
  decision: Decision;
  invoice_grade: string;
  el_pct: number;
  fraud_score: number;
  desk_reasons: DeskReason[];
  debtor_score: ScoreSummary | null;
  transporter_score: ScoreSummary | null;
  approved_by: string | null;
  disbursed_by: string | null;
  approver_label: string;
  assessment_id: number | null;
  /** Only on the detail endpoint. */
  assessment?: Record<string, unknown>;
}

export type AlertSeverity = 'INFO' | 'AMBER' | 'RED';

export interface DeskAlert {
  id: number;
  kind: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  opened_at: string;
  resolved_at: string | null;
  data: Record<string, unknown>;
}

export interface LedgerEntry {
  id: number;
  created_at: string;
  entry_type: string;
  amount: number;
  reserved_delta: number;
  outstanding_delta: number;
  company: string | null;
  debtor: string | null;
  invoice_number: string | null;
  advance_reference: string | null;
  actor: string | null;
  reference: string | null;
  memo: string | null;
}

export interface Ledger {
  balances: { reserved: number; outstanding: number; committed: number };
  reconciliation: { ok: boolean; breaks: { facility_id: number; company: string; field: string; ledger: number; cached: number }[] };
  entries: LedgerEntry[];
}

/**
 * History rows on the debtor / transporter detail. The contract leaves these
 * open; the UI reads the ScoreSummary fields for scores and the limit-row
 * fields for limits, and shows "—" for anything missing.
 */
export type ScoreHistoryEntry = Partial<ScoreSummary> & { created_at?: string };
export type LimitHistoryEntry = Partial<DeskLimit> & { created_at?: string };

export interface DebtorCard {
  debtor_id: number;
  name: string;
  registration_number: string | null;
  vat_number: string | null;
  sector: string;
  sector_label: string;
  is_government: boolean;
  country: string;
  cipc_status: string | null;
  cession_status: string | null;
  hold: boolean;
  hold_reason: string | null;
  exposure: number;
  cap: number;
  score: ScoreSummary | null;
}

export interface DebtorDetail extends DebtorCard {
  score_history: ScoreHistoryEntry[];
  limit_history: LimitHistoryEntry[];
  transporters: { company: string; exposure: number }[];
}

export interface TransporterCard {
  company_id: number;
  name: string;
  application_status: string;
  hold: boolean;
  exposure: number;
  line_limit: number;
  score: ScoreSummary | null;
}

export interface TransporterDetail extends TransporterCard {
  score_history: ScoreHistoryEntry[];
  limit_history: LimitHistoryEntry[];
}

export type PolicyParams = Record<string, unknown>;

export interface PolicyVersion {
  id: number;
  version: number | string;
  params: PolicyParams;
  approved_at: string | null;
  approved_by: string | null;
  created_by: string | null;
  notes: string | null;
  created_at?: string | null;
}

export interface PolicyState {
  current: PolicyVersion | null;
  pending: PolicyVersion[];
  history: PolicyVersion[];
  defaults: PolicyParams;
}

export type LimitScope = 'DEBTOR' | 'TRANSPORTER' | 'PAIR' | 'SECTOR';

export interface DeskLimit {
  id: number;
  scope: LimitScope;
  debtor_id: number | null;
  debtor_name: string | null;
  company_id: number | null;
  company_name: string | null;
  sector: string | null;
  amount: number | null;
  hold: boolean;
  reason: string;
  created_by: string | null;
  created_at: string;
}

export interface LimitInput {
  scope: LimitScope;
  debtor_id?: number;
  company_id?: number;
  sector?: string;
  amount: number | null;
  hold: boolean;
  reason: string;
}

export interface DataRoomExport {
  id: number;
  period: string;
  created_at: string;
  files: string[];
  summary: Record<string, unknown> | string | null;
}
