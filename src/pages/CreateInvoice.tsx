import './quote-invoice-roles.css';
import './finance-brand.css';
import '@/components/finance/finance-ledger.css';
import SectionHeader from '@/components/layout/SectionHeader';
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Lock } from 'lucide-react';
import { postData, patchData, fetchData } from "@/lib/Api";
import { localDateISO } from '@/lib/dates';
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InfoTip } from '@/components/ui/InfoTip';
import { formatCurrency } from '@/lib/formatters';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import '@/components/data/load-error.css';
import { InvoiceLineEditor } from '@/components/finance/InvoiceLineEditor';
import { blankLine, linesForApi, linesFromInvoice, lineProblems, type EditorLine } from '@/lib/finance/lines';
import { TotalsBreakdown } from '@/components/finance/TotalsBreakdown';
import { computeTotals } from '@/lib/finance/tax';
import { errorCode, errorText, rowsOf, useFinanceSettings, useInvalidateInvoice, useInvoice, useTaxCodes, FIN_URL } from '@/lib/finance/api';
import type { Invoice, InvoiceWriteInput } from '@/lib/finance/types';

interface CustomerOption { id: number; name: string; company_name?: string; payment_terms_default?: string }

/** "NET30" → 30; anything else → null. */
const termsDays = (t?: string) => { const m = /^NET\s*(\d+)$/i.exec(t || ''); return m ? parseInt(m[1], 10) : null; };
const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return localDateISO(new Date(y, m - 1, d + days));
};

/**
 * New invoice, and editing a draft (/finance/invoices/:id/edit). Lines carry
 * the money; the server computes every total, the rail previews them with
 * the same rounding. Sent invoices are locked: they open read-only here with
 * the reason and a way back to issue a credit note.
 */
export default function CreateInvoice() {
  const { id } = useParams();
  const editing = !!id;
  const invoiceQuery = useInvoice(id);
  const invoice = invoiceQuery.data;
  if (editing) {
    if (loadFailed(invoiceQuery)) {
      return (
        <div className="fin-page">
          <SectionHeader title="Edit invoice" back={{ to: `/finance/invoices/${id}`, label: 'Invoice' }} />
          <LoadError what="this invoice" error={invoiceQuery.error ?? invoiceQuery.failureReason} busy={invoiceQuery.isFetching} onRetry={() => invoiceQuery.refetch()} />
        </div>
      );
    }
    if (!invoice) {
      return (
        <div className="fin-page" aria-busy="true" aria-label="Loading invoice">
          <SectionHeader title="Edit invoice" back={{ to: `/finance/invoices/${id}`, label: 'Invoice' }} />
          <div className="fin-skel fin-skel--card" aria-hidden="true" />
        </div>
      );
    }
    if (invoice.is_locked || String(invoice.status).toUpperCase() !== 'DRAFT') {
      return <LockedInvoice invoice={invoice} />;
    }
  }
  return <InvoiceForm key={invoice?.id ?? 'new'} invoice={invoice} />;
}

function LockedInvoice({ invoice }: { invoice: Invoice }) {
  const navigate = useNavigate();
  return (
    <div className="fin-page">
      <SectionHeader title={`Edit ${invoice.invoice_number}`} back={{ to: `/finance/invoices/${invoice.id}`, label: invoice.invoice_number }} />
      <div className="fl-notice" role="status">
        <Lock size={16} aria-hidden="true" />
        <div>
          <strong>This invoice can't be edited</strong>
          {invoice.lock_reason || "Sent invoices can't be edited — issue a credit note to correct one."}
        </div>
        <button type="button" className="tw-btn fl-notice__action" onClick={() => navigate(`/finance/invoices/${invoice.id}`)}>Open invoice</button>
      </div>
    </div>
  );
}

function InvoiceForm({ invoice }: { invoice?: Invoice }) {
  const navigate = useNavigate();
  const invalidate = useInvalidateInvoice();
  const editing = !!invoice;
  const { codes, defaultCode, isLoading: codesLoading } = useTaxCodes();
  const settings = useFinanceSettings();

  const [customer, setCustomer] = useState(invoice?.customer != null ? String(invoice.customer) : '');
  const [issueDate, setIssueDate] = useState(String(invoice?.issue_date || localDateISO()).slice(0, 10));
  const [dueDate, setDueDate] = useState(String(invoice?.due_date || '').slice(0, 10));
  const [dueTouched, setDueTouched] = useState(!!invoice?.due_date);
  const [notes, setNotes] = useState(invoice?.notes || '');
  const [status, setStatus] = useState<'DRAFT' | 'SENT'>('DRAFT');
  const [lines, setLines] = useState<EditorLine[]>(() =>
    invoice ? linesFromInvoice(invoice.lines, invoice.subtotal, defaultCode) : [blankLine(defaultCode)]);
  const [linesTouched, setLinesTouched] = useState(false);
  const [error, setError] = useState('');

  // The tenant default arrives after the first render: apply it to untouched new lines.
  useEffect(() => {
    if (editing || linesTouched || codesLoading) return;
    setLines(ls => ls.map(l => ({ ...l, tax_code: defaultCode })));
  }, [defaultCode, codesLoading, editing, linesTouched]);

  const { data: customersData } = useQuery({ queryKey: ['customers'], queryFn: () => fetchData('api/v1/customers/') });
  const customers: CustomerOption[] = rowsOf(customersData);
  const selectedCustomer = customers.find(c => String(c.id) === customer);

  // Due date follows the customer's terms until the user picks one.
  useEffect(() => {
    if (dueTouched || !issueDate) return;
    const days = termsDays(selectedCustomer?.payment_terms_default);
    setDueDate(days != null ? addDays(issueDate, days) : '');
  }, [selectedCustomer?.payment_terms_default, issueDate, dueTouched]);

  const totals = useMemo(() => computeTotals(lines, codes), [lines, codes]);
  const problems = lineProblems(lines);
  const apiLines = linesForApi(lines);
  const canSubmit = !!customer && !!issueDate && apiLines.length > 0 && problems.length === 0;

  const mutation = useMutation({
    mutationFn: (data: InvoiceWriteInput) => editing
      ? patchData({ url: FIN_URL.invoice(invoice!.id), data })
      : postData({ url: FIN_URL.invoices, data }),
    onSuccess: (saved: Invoice | undefined) => {
      invalidate(invoice?.id ?? saved?.id);
      const target = saved?.id ?? invoice?.id;
      navigate(target ? `/finance/invoices/${target}` : '/finance/invoices');
    },
    onError: (e: unknown) => setError(errorCode(e) === 'invoice_locked'
      ? "This invoice was sent in the meantime, so it can't be edited. Issue a credit note instead."
      : errorText(e, editing ? "Couldn't save the invoice" : "Couldn't create the invoice")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    const data: InvoiceWriteInput = {
      customer: Number(customer),
      issue_date: issueDate,
      due_date: dueDate || null,
      notes,
      lines: apiLines,
    };
    if (!editing) data.status = status;
    mutation.mutate(data);
  };

  const changeLines = (ls: EditorLine[]) => { setLines(ls); setLinesTouched(true); };
  const backTo = editing ? `/finance/invoices/${invoice!.id}` : '/finance/invoices';
  const submitLabel = mutation.isPending
    ? (editing ? 'Saving…' : 'Creating…')
    : editing ? 'Save draft' : status === 'SENT' ? 'Create as sent' : 'Create draft';
  const numberHint = editing
    ? invoice!.has_provisional_number ? 'Provisional. The invoice number is assigned when it is sent.' : null
    : settings.data?.next_invoice_number_preview
      ? `Assigned when sent. Next number: ${settings.data.next_invoice_number_preview}`
      : 'Assigned when the invoice is sent.';
  const missing = [!customer && 'a customer', apiLines.length === 0 && 'at least one line'].filter(Boolean).join(' and ');

  return (
    <div className="fin-page">
      <SectionHeader
        title={editing ? `Edit ${invoice!.invoice_number}` : 'New invoice'}
        back={{ to: backTo, label: editing ? invoice!.invoice_number : 'Invoices' }}
        description={editing ? 'Draft. Lines and dates can change until it is sent.' : 'One-off charges. Loads bill themselves.'}
        actions={
          <button type="submit" form="create-invoice-form" className="tw-btn tw-btn--primary fin-phone-only" disabled={!canSubmit || mutation.isPending}>
            {submitLabel}
          </button>
        }
      />

      <form id="create-invoice-form" onSubmit={handleSubmit}>
        <div className="fin-create-grid">
          <div className="fin-main-col">
            <section className="card" aria-labelledby="create-invoice-details">
              <div className="fin-panel-head">
                <div className="fin-panel-head__text">
                  <h2 id="create-invoice-details" className="fin-panel-title">Details</h2>
                  {numberHint && <p className="fin-panel-desc">{numberHint}</p>}
                </div>
              </div>
              <div className="fin-form">
                <div className="fin-form__row fin-form__row--3">
                  <div>
                    <label id="create-invoice-customer-label" htmlFor="create-invoice-customer" className="fin-label">Customer</label>
                    <Select value={customer} onValueChange={setCustomer}>
                      <SelectTrigger id="create-invoice-customer" aria-labelledby="create-invoice-customer-label">
                        <SelectValue placeholder="Select a customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.company_name || c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="fin-date-field">
                    <label htmlFor="create-invoice-issue-date" className="fin-label">Issue date</label>
                    <DatePicker id="create-invoice-issue-date" value={issueDate} onChange={setIssueDate} />
                  </div>
                  <div className="fin-date-field">
                    <label htmlFor="create-invoice-due-date" className="fin-label">
                      Due date {!dueTouched && selectedCustomer && termsDays(selectedCustomer.payment_terms_default) != null && <span className="fin-label__hint">From terms</span>}
                    </label>
                    <DatePicker id="create-invoice-due-date" value={dueDate} onChange={v => { setDueDate(v); setDueTouched(true); }} />
                  </div>
                  {!editing && (
                    <div>
                      <label id="create-invoice-status-label" htmlFor="create-invoice-status" className="fin-label">Save as</label>
                      <Select value={status} onValueChange={v => setStatus(v as 'DRAFT' | 'SENT')}>
                        <SelectTrigger id="create-invoice-status" aria-labelledby="create-invoice-status-label"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DRAFT">Draft, to send later</SelectItem>
                          <SelectItem value="SENT">Sent, already with the customer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="fin-form__wide">
                    <label htmlFor="create-invoice-notes" className="fin-label">Notes <span className="fin-label__hint">Printed on the invoice</span></label>
                    <textarea id="create-invoice-notes" className="fin-control qi-input" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="e.g. PO 4500123, standby at Durban port" />
                  </div>
                </div>
              </div>
            </section>

            <section className="card fl-lines-card" aria-labelledby="create-invoice-lines">
              <div className="fin-panel-head">
                <div className="fin-panel-head__text">
                  <h2 id="create-invoice-lines" className="fin-panel-title">Lines</h2>
                  <p className="fin-panel-desc">{apiLines.length} {apiLines.length === 1 ? 'line' : 'lines'}, amounts excl. VAT</p>
                </div>
              </div>
              <InvoiceLineEditor lines={lines} onChange={changeLines} codes={codes} defaultCode={defaultCode} />
              {problems.length > 0 && (
                <ul className="fin-help fin-text-danger" style={{ paddingLeft: 18, marginTop: 12 }}>
                  {problems.map(p => <li key={p}>{p}</li>)}
                </ul>
              )}
            </section>
          </div>

          <aside className="fin-rail" aria-label="Invoice summary">
            <section className="card" aria-labelledby="create-invoice-total">
              <p id="create-invoice-total" className="fin-summary-card__label">
                Total incl. VAT
                <InfoTip>Worked out per line the way the server does it: discount first, then VAT on what is left, each rounded to the cent. The saved invoice shows the same figures.</InfoTip>
              </p>
              <p className="fin-summary-card__figure">{formatCurrency(totals.total)}</p>
              <TotalsBreakdown totals={totals} totalLabel="Total" />
              <dl className="fin-dl fin-summary-card__split">
                <div className="fin-dl__row"><dt>Customer</dt><dd>{selectedCustomer ? (selectedCustomer.company_name || selectedCustomer.name) : 'Not selected'}</dd></div>
              </dl>

              {error && <div className="fin-inset fin-text-danger" role="alert" style={{ fontSize: 13, lineHeight: '20px', marginTop: 12 }}>{error}</div>}

              <div className="fin-summary-card__actions">
                <button type="submit" className="tw-btn tw-btn--primary fin-rail-btn fin-hide-phone-create" style={{ width: '100%' }} disabled={!canSubmit || mutation.isPending}>
                  {submitLabel}
                </button>
                <button type="button" className="tw-btn tw-btn--ghost fin-rail-btn" style={{ width: '100%' }} onClick={() => navigate(backTo)}>
                  Cancel
                </button>
                {!canSubmit && missing && <p className="fin-help" style={{ margin: 0 }}>Needs {missing}.</p>}
              </div>
            </section>
          </aside>
        </div>
      </form>
    </div>
  );
}
