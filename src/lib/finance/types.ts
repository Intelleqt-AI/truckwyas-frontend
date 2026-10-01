import type { AccountingSync } from '@/lib/accounting';

/**
 * Finance API types (Foundation phase): invoices with lines, credit notes,
 * payments, suppliers, expenses, customer tax fields and finance settings.
 * Decimals arrive as strings ("1480.50"); read them with `toNumber` in
 * lib/finance/tax.ts, never with `+x` (which turns "" into 0 silently).
 *
 * Base path for every endpoint: api/v1/.
 */

export type TaxCode = 'STANDARD' | 'ZERO_RATED' | 'EXEMPT' | 'NO_VAT';

/** A decimal as the API sends it ("15.00"). */
export type Decimal = string;

export interface TaxCodeOption {
  code: TaxCode;
  label: string;
  /** Percent as a decimal string, e.g. "15.00". */
  rate: Decimal;
}

export interface TaxCodesResponse {
  codes: TaxCodeOption[];
  default_tax_code: TaxCode;
}

export interface InvoiceLine {
  id: number;
  position: number;
  description: string;
  quantity: Decimal;
  unit_price: Decimal;
  /** Rand, excl. VAT. */
  discount_amount: Decimal;
  tax_code: TaxCode;
  tax_rate: Decimal;
  net_amount: Decimal;
  vat_amount: Decimal;
  total_amount: Decimal;
  load: number | null;
  /** Net (excl. VAT) already credited on this line by issued credit notes. */
  credited_net_amount?: Decimal;
}

/** One line as sent on create / PATCH (drafts only). The server computes totals. */
export interface InvoiceLineInput {
  description: string;
  quantity: Decimal;
  unit_price: Decimal;
  discount_amount?: Decimal;
  discount_percent?: Decimal;
  tax_code: TaxCode;
  /** Kept from the saved line when a draft is edited. */
  load?: number | null;
}

export type InvoiceStatus =
  | 'DRAFT' | 'SENT' | 'VIEWED' | 'OVERDUE' | 'PARTIALLY_PAID' | 'PAID' | 'CREDITED' | 'CANCELLED';

export interface CreditNoteSummary {
  id: number;
  credit_note_number: string;
  issue_date: string;
  total_amount: Decimal;
  status: CreditNoteStatus;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  /** Drafts carry a provisional number ("DRAFT-1A2B3C"); the real one is assigned on send. */
  has_provisional_number: boolean;
  customer: number | null;
  customer_name: string;
  load: number | null;
  load_number?: string | null;
  status: InvoiceStatus | string;
  issue_date: string;
  due_date: string | null;
  payment_terms?: string | null;
  terms_days: number;
  notes?: string;
  lines: InvoiceLine[];
  /** Sum of line net amounts (excl. VAT, after discount). */
  subtotal: Decimal;
  /** Sum of line discounts (excl. VAT). */
  discount: Decimal;
  vat_amount: Decimal;
  total_amount: Decimal;
  paid_amount: Decimal;
  credited_amount: Decimal;
  /** total - paid - credited. */
  balance: Decimal;
  is_locked: boolean;
  is_financed: boolean;
  lock_reason: string | null;
  totals_source: 'LINES' | 'LEGACY';
  voided_at: string | null;
  void_reason: string;
  credit_notes: CreditNoteSummary[];
  /** Where this invoice stands in the connected accounting system (null when none). */
  accounting_sync?: AccountingSync | null;
  created_at?: string;
  updated_at?: string;
  sent_at?: string | null;
}

export interface InvoiceWriteInput {
  customer: number | string;
  load?: number | null;
  issue_date: string;
  due_date?: string | null;
  payment_terms?: string;
  notes?: string;
  status?: 'DRAFT' | 'SENT';
  lines: InvoiceLineInput[];
}

export type CreditNoteStatus = 'ISSUED' | 'VOID';

export interface CreditNoteLine {
  id: number;
  description: string;
  quantity: Decimal;
  unit_price: Decimal;
  tax_code: TaxCode;
  tax_rate: Decimal;
  net_amount: Decimal;
  vat_amount: Decimal;
  total_amount: Decimal;
  invoice_line: number | null;
}

export interface CreditNote {
  id: number;
  credit_note_number: string;
  invoice: number;
  invoice_number: string;
  customer: number;
  customer_name: string;
  issue_date: string;
  reason: string;
  status: CreditNoteStatus;
  lines: CreditNoteLine[];
  subtotal: Decimal;
  vat_amount: Decimal;
  total_amount: Decimal;
  created_at: string;
  voided_at: string | null;
  /** Where this credit note stands in the connected accounting system (null when none). */
  accounting_sync?: AccountingSync | null;
}

export interface CreditNoteLineInput {
  description: string;
  quantity: Decimal;
  unit_price: Decimal;
  tax_code: TaxCode;
  invoice_line?: number;
}

export type CreditNoteCreateInput =
  | { invoice: number; reason: string; issue_date?: string; full: true }
  | { invoice: number; reason: string; issue_date?: string; lines: CreditNoteLineInput[] };

export type PaymentSource = 'MANUAL' | 'XERO' | 'QBO' | 'BANK';

export interface Payment {
  id: number;
  payment_number?: string;
  invoice: number | null;
  invoice_number?: string;
  customer?: number | null;
  customer_name?: string;
  amount: Decimal;
  payment_date: string;
  payment_method?: string;
  reference_number?: string;
  /** Older payments carry `reference`. */
  reference?: string;
  notes?: string;
  source?: PaymentSource;
  external_id?: string | null;
}

export interface PaymentUpdateInput {
  amount?: Decimal;
  payment_date?: string;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
}

export interface Supplier {
  id: number;
  name: string;
  vat_number: string;
  registration_number: string;
  email: string;
  phone: string;
  category: string;
  is_active: boolean;
  expense_count: number;
  created_at: string;
}

export type SupplierInput = Omit<Supplier, 'id' | 'expense_count' | 'created_at'>;

/** The Foundation fields on an expense (the page keeps its own base type). */
export interface ExpenseTaxFields {
  supplier?: number | null;
  supplier_name?: string | null;
  tax_code?: TaxCode;
  /** Input VAT included in `amount` (gross). */
  vat_amount?: Decimal | null;
  /** amount - vat_amount (read-only). */
  net_amount?: Decimal | null;
  load?: number | null;
}

/** The Foundation fields on a customer. */
export interface CustomerTaxFields {
  vat_number?: string;
  registration_number?: string;
  /** ISO-2, default 'ZA'. */
  country?: string;
  legal_name_key?: string;
}

export interface FinanceSettings {
  invoice_prefix: string;
  invoice_next_number: number;
  credit_note_prefix: string;
  credit_note_next_number: number;
  number_padding: number;
  next_invoice_number_preview: string;
  next_credit_note_number_preview: string;
  vat_registered: boolean;
  default_tax_code: TaxCode;
  can_edit: boolean;
}

export type FinanceSettingsInput = Partial<Pick<FinanceSettings,
  'invoice_prefix' | 'invoice_next_number' | 'credit_note_prefix' | 'credit_note_next_number' | 'number_padding'
>>;

/** DRF list responses are paginated ({results}) or plain arrays. */
export type ListResponse<T> = T[] | { count?: number; next?: string | null; results: T[] };
