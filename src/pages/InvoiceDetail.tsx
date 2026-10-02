import { useEffect, useState } from "react";
import { BellRing, Banknote, Send, FileSearch, Pencil, Lock, Ban, ExternalLink } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CAPITAL_LAUNCHED, CAPITAL_COMING_SOON } from '@/lib/features';
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteData, fetchData, patchData, postData } from "@/lib/Api";

import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";
import "./finance-brand.css";
import "./table-heading-roles.css";
import { InfoTip } from "@/components/ui/InfoTip";
import SectionHeader from "@/components/layout/SectionHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import LoadError, { loadFailed } from "@/components/data/LoadError";
import "@/components/data/load-error.css";
import { useBalancedColumns } from "@/components/fleet-detail/useBalancedColumns";
import { daysBetween, todayISO } from "@/components/reports/data";
import InvoiceSendPreview, { type InvoiceMessageKind } from "@/components/finance/InvoiceSendPreview";
import { canSendReminder, invoiceBalance, REMINDER_STATUSES } from "@/lib/invoiceStatus";
import "@/components/finance/finance-ledger.css";
import { CreditNoteDialog } from "@/components/finance/CreditNoteDialog";
import { FinDialog, ReasonDialog } from "@/components/finance/FinDialog";
import { PaymentEditDialog } from "@/components/finance/PaymentEditDialog";
import { isManualPayment } from "@/lib/finance/payments";
import { ACCT_KEYS, isPaymentsManagedError, paymentsManagedRecordUrl, usePaymentsManaged } from "@/lib/accounting";
import { AccountingSyncCard, AccountingSyncNotice, PaymentSourceBadge, PaymentsManagedNote } from "@/components/accounting/AccountingSyncCard";
import { TotalsBreakdown } from "@/components/finance/TotalsBreakdown";
import RowActions from "@/components/ui/RowActions";
import { ConfirmModal } from "@/components/ConfirmModal";
import { FIN_URL, errorText, invalidateInvoiceData } from "@/lib/finance/api";
import { formatQuantity, sumLines, taxCodeShort, toNumber } from "@/lib/finance/tax";
import type { Invoice, InvoiceLine, Payment } from "@/lib/finance/types";
import { revenueTypeLabel } from "@/lib/finance/types";

// External Fast Pay application link. The applied-state key is unchanged so
// invoices already marked "Applied" stay marked.
const FAST_PAY_STORAGE_KEY = "mc_applied_invoice_ids";

function loadAppliedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAST_PAY_STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveAppliedId(id: string, current: Set<string>): Set<string> {
  const next = new Set(current).add(id);
  localStorage.setItem(FAST_PAY_STORAGE_KEY, JSON.stringify([...next]));
  return next;
}
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


// "BANK_TRANSFER" → "Bank transfer"; short acronyms (EFT) stay as-is.
const methodLabel = (m: string) => (m.length <= 4 ? m : formatStatus(m));

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? 0 : n;
};

const safeDate = (d?: string | null) => {
  if (!d) return '—';
  const t = new Date(d);
  return isNaN(t.getTime()) ? d : formatDate(t);
};

// Sentence-case a status/token for display: "PARTIALLY_PAID" → "Partially paid".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [appliedIds, setAppliedIds] = useState<Set<string>>(loadAppliedIds);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('EFT');
  const [paymentReference, setPaymentReference] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);
  // Due date edit (Draft to Overdue; locked once paid or cancelled).
  const [editingDue, setEditingDue] = useState(false);
  const [dueDraft, setDueDraft] = useState('');
  const [savingDue, setSavingDue] = useState(false);
  const [dueError, setDueError] = useState<string | null>(null);
  // Outgoing messages are previewed and confirmed before they are sent.
  const [preview, setPreview] = useState<InvoiceMessageKind | null>(null);
  // Ledger actions: credit note, void, delete draft, note, payment edit/delete.
  const [creditOpen, setCreditOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const flash = (msg: string, isError = false) => { setToast({ msg, isError }); setTimeout(() => setToast(null), isError ? 5000 : 3000); };
  const refreshLedger = () => invalidateInvoiceData(queryClient, id);
  // While an accounting system (Xero, QuickBooks) is connected it owns
  // payments: TruckWys shows them but never records or edits them.
  const { managed: paymentsManaged, providerName: acctName, connection: acctConnection } = usePaymentsManaged();
  const [managedRecordUrl, setManagedRecordUrl] = useState<string | null>(null);
  useEffect(() => { if (paymentsManaged) setShowPaymentForm(false); }, [paymentsManaged]);
  /** A payment write was refused because the accounting system owns payments (409). */
  const onPaymentsManaged = (error: unknown) => {
    setShowPaymentForm(false);
    setEditingPayment(null);
    setManagedRecordUrl(paymentsManagedRecordUrl(error));
    queryClient.invalidateQueries({ queryKey: ACCT_KEYS.connection });
    flash(errorText(error, 'Payments are recorded in your accounting system while it is connected.'), true);
  };

  const invoiceQuery = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => fetchData(`api/v1/invoices/${id}/`),
    enabled: !!id,
    // A 404 is an answer, not a failure: no retries, straight to "not found".
    retry: (n, e) => (e as { status?: number } | null)?.status !== 404 && n < 2,
  });
  const { data: invoice, isLoading, isError, refetch } = invoiceQuery;
  const invoiceFailed = loadFailed(invoiceQuery);
  const invoiceError = (invoiceQuery.error ?? invoiceQuery.failureReason) as { status?: number } | null;

  // Capital eligibility — shared cache with invoices list
  const { data: capitalData } = useQuery({
    queryKey: ['capital-eligible'],
    queryFn: () => fetchData('api/v1/capital/eligible/').catch(() => null),
  });
  const eligibleInvoices: any[] = capitalData?.invoices || [];
  const capitalEntry = eligibleInvoices.find((e: any) => String(e.id) === String(id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ineligibleInvoices: any[] = capitalData?.ineligible_invoices || [];
  const ineligibleEntry = !capitalEntry
    ? ineligibleInvoices.find((e: any) => String(e.id) === String(id))
    : null;

  // Payments aren't embedded on the invoice serializer — fetch them.
  const { data: paymentsResp } = useQuery({
    queryKey: ['invoice-payments', id],
    queryFn: () => fetchData(`api/v1/payments/?invoice=${id}`),
    enabled: !!id,
  });
  const allPayments = Array.isArray(paymentsResp) ? paymentsResp : (paymentsResp?.results ?? []);
  // Only show payments that belong to this invoice (guards against the list
  // endpoint returning payments for other invoices).
  const payments = allPayments.filter((p: any) => p?.invoice == null || String(p.invoice) === String(id));

  // Two columns end within 48px (R6): the document's facts (bill to, dates,
  // terms) may move to the top of the rail when that balances the page; below
  // the one-column breakpoint they always open the document.
  const bal = useBalancedColumns(
    { toSide: ['facts'] },
    `${id}-${invoice ? invoice.updated_at ?? 'ok' : 'none'}-${payments.length}-${showPaymentForm}-${capitalData ? 'c' : ''}`,
  );

  const handleSaveDueDate = async () => {
    if (!id || !dueDraft) return;
    setSavingDue(true);
    setDueError(null);
    try {
      await patchData({ url: `api/v1/invoices/${id}/`, data: { due_date: dueDraft } });
      setEditingDue(false);
      setToast({ msg: 'Due date changed' });
      setTimeout(() => setToast(null), 3000);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (error) {
      setDueError(error instanceof Error ? error.message : "Couldn't change the due date");
    } finally {
      setSavingDue(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!id) return;
    setSending(true);
    try {
      await postData({ url: `api/v1/invoices/${id}/send_invoice/` });
      setToast({ msg: 'Invoice sent' });
      setTimeout(() => setToast(null), 3000);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['capital-eligible'] });
    } catch (error) {
      console.error('Failed to send invoice:', error);
      setToast({ msg: error instanceof Error ? error.message : 'Failed to send invoice', isError: true });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      let pdfUrl: string | null = null;

      if (invoice?.pdf_file) {
        const file: string = invoice.pdf_file;
        if (file.startsWith('http://') || file.startsWith('https://')) {
          pdfUrl = file;
        } else {
          const base = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:8000';
          pdfUrl = `${base}/media/${file}`;
        }
      } else {
        const result: any = await postData({ url: `api/v1/invoices/${id}/generate_pdf/`, data: {} });
        pdfUrl = result?.pdf_url ?? null;
        if (pdfUrl) refetch();
      }

      if (pdfUrl) {
        // Fetch as blob so the `download` attribute works cross-origin
        // (browsers ignore `download` on cross-origin hrefs).
        const resp = await fetch(pdfUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `Invoice_${invoice?.invoice_number || id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
        setToast({ msg: 'PDF downloaded' });
      } else {
        setToast({ msg: 'Failed to get PDF URL', isError: true });
      }
    } catch {
      setToast({ msg: 'Failed to generate PDF', isError: true });
    } finally {
      setTimeout(() => {
        setToast(null);
        setDownloading(false);
      }, 3000);
    }
  };

  const handleSendReminder = async () => {
    if (!id) return;
    setSendingReminder(true);
    try {
      await postData({ url: `api/v1/invoices/${id}/send_reminder/`, data: {} });
      setToast({ msg: 'Reminder sent' });
      setTimeout(() => setToast(null), 3000);
      refetch();
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setToast({ msg: 'Reminder recorded. The customer will be contacted.' });
      } else {
        setToast({ msg: error instanceof Error ? error.message : 'Failed to send reminder', isError: true });
      }
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSendingReminder(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!id || !paymentAmount || !paymentDate) {
      setToast({ msg: 'Enter the amount and payment date', isError: true });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setRecordingPayment(true);
    try {
      await postData({
        url: 'api/v1/payments/',
        data: {
          invoice: id,
          amount: parseFloat(paymentAmount),
          payment_date: paymentDate,
          payment_method: paymentMethod,
          reference: paymentReference,
          reference_number: paymentReference,
        }
      });
      setToast({ msg: 'Payment recorded' });
      setShowPaymentForm(false);
      setPaymentAmount('');
      setPaymentDate('');
      setPaymentReference('');
      setTimeout(() => setToast(null), 3000);
      refreshLedger();
    } catch (error) {
      if (isPaymentsManagedError(error)) { onPaymentsManaged(error); return; }
      const msg = error instanceof Error ? error.message : 'Failed to record payment';
      setToast({ msg, isError: true });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleVoid = async (reason: string) => {
    await postData({ url: FIN_URL.invoiceVoid(id!), data: { reason } });
    setVoidOpen(false);
    flash('Invoice voided');
    refreshLedger();
  };

  const handleDeleteDraft = async () => {
    try {
      await deleteData({ url: FIN_URL.invoice(id!) });
      invalidateInvoiceData(queryClient);
      navigate('/finance/invoices');
    } catch (error) {
      flash(errorText(error, "Couldn't delete the draft"), true);
    }
  };

  const handleDeletePayment = async (p: Payment) => {
    try {
      await deleteData({ url: FIN_URL.payment(p.id) });
      flash('Payment deleted');
      refreshLedger();
    } catch (error) {
      if (isPaymentsManagedError(error)) { setDeletingPayment(null); onPaymentsManaged(error); return; }
      flash(errorText(error, "Couldn't delete the payment"), true);
    }
  };

  // A failed request is not a missing invoice: only a 404 says "not found".
  if (invoiceFailed && invoiceError?.status !== 404) {
    return (
      <div className="fin-page">
        <SectionHeader title="Invoice" back={{ to: '/finance/invoices', label: 'Invoices' }} />
        <LoadError what="this invoice" error={invoiceError} busy={invoiceQuery.isFetching} onRetry={() => refetch()} />
      </div>
    );
  }
  // Loading: the back link and a head placeholder render at once; only the
  // content waits, so a click never blanks the page.
  if (isLoading && !invoiceFailed) {
    return (
      <div className="fin-page" aria-busy="true" aria-label="Loading invoice">
        <SectionHeader title="Invoice" back={{ to: '/finance/invoices', label: 'Invoices' }} />
        <div className="fin-skel fin-skel--card" aria-hidden="true" />
      </div>
    );
  }
  // Not found (404): the head and back link stay, as in the loading state;
  // the message and its one action share a row, like the load-error state.
  if (isError || !invoice) {
    return (
      <div className="fin-page">
        <SectionHeader title="Invoice not found" back={{ to: '/finance/invoices', label: 'Invoices' }} />
        <div className="load-error fin-missing" role="status">
          <FileSearch className="load-error__icon" size={20} aria-hidden="true" />
          <div className="load-error__text">
            <p className="load-error__title">There is no invoice at this link</p>
            <p className="load-error__hint">It may have been deleted, or the link is wrong.</p>
          </div>
          <button type="button" className="tw-btn load-error__retry" onClick={() => navigate('/finance/invoices')}>All invoices</button>
        </div>
      </div>
    );
  }

  const status: string = String(invoice.status || '').toUpperCase();
  const inv = invoice as Invoice;
  // CANCELLED is shown as "Void" on invoices.
  const isVoid = status === 'CANCELLED' || !!inv.voided_at;
  const isDraft = status === 'DRAFT';
  const statusLabel = isVoid ? 'Void' : undefined;
  const credited = toNumber(inv.credited_amount);
  const creditNotes = Array.isArray(inv.credit_notes) ? inv.credit_notes : [];
  const issuedCredits = creditNotes.filter(c => String(c.status).toUpperCase() !== 'VOID');
  const ledgerLines: InvoiceLine[] = Array.isArray(inv.lines) ? [...inv.lines].sort((a, b) => a.position - b.position) : [];
  const hasLedgerLines = ledgerLines.length > 0;
  const total = parseFloat(invoice.total_amount || invoice.amount || '0');
  const hasBalance = invoice.balance !== undefined && invoice.balance !== null;
  const balance = num(invoice.balance);
  const showBalance = hasBalance && status !== 'PAID' && status !== 'DRAFT' && status !== 'CREDITED' && !isVoid;
  const applied = appliedIds.has(String(id));
  const canSend = !isVoid && (status === 'DRAFT' || status === 'SENT' || status === 'VIEWED');
  const canEditDraft = isDraft && !inv.is_locked;
  // Credit what is left of a sent invoice; the server has the final say.
  // Never on drafts or void invoices; a financed invoice belongs to the financier (the server refuses, 409).
  const canCredit = !isDraft && !isVoid && !inv.is_financed && status !== 'CREDITED' && total - credited > 0.005;
  // Void: no payments, no credit notes, not financed (the API's rule).
  const canVoid = !isDraft && !isVoid && !inv.is_financed && payments.length === 0 && num(invoice.paid_amount) === 0 && issuedCredits.length === 0;
  // Any sent invoice with an unpaid balance past its due date, including
  // part-paid ones (shared definition in lib/invoiceStatus).
  const canRemind = canSendReminder(invoice);
  // Never on drafts or void invoices (the API refuses both).
  const isPayable = !isDraft && (status === 'SENT' || status === 'VIEWED' || status === 'OVERDUE' || status === 'PARTIALLY_PAID') && !isVoid;
  // Managed elsewhere: "Record in Xero" opens this invoice there instead.
  const managedHere = paymentsManaged || !!managedRecordUrl;
  const canRecordPayment = isPayable && !managedHere;
  const recordInProviderUrl = inv.accounting_sync?.url || managedRecordUrl || acctConnection?.web_url || null;
  const canRecordInProvider = isPayable && managedHere;
  const openRecordInProvider = () => { if (recordInProviderUrl) window.open(recordInProviderUrl, '_blank', 'noopener,noreferrer'); };
  const totalPaid = (payments || []).reduce((sum: number, p: any) => sum + num(p.amount), 0);
  const paidToDate = invoice.paid_amount != null ? num(invoice.paid_amount) : null;
  const vat = (invoice.vat_amount ?? invoice.tax_amount) != null ? num(invoice.vat_amount ?? invoice.tax_amount) : null;
  const taxRate = invoice.tax_rate != null ? num(invoice.tax_rate) : null;
  // Whole calendar days in SA time, the same count as the Debtors report.
  const daysPastDue = invoice.due_date ? daysBetween(String(invoice.due_date), todayISO()) : null;
  const daysLate = showBalance ? daysPastDue : null;
  // A draft whose due date has already passed: said once, calmly, before it is sent.
  const draftPastDue = status === 'DRAFT' && daysPastDue != null && daysPastDue > 0;
  // The due date is locked once the invoice is sent; drafts change it here or in the editor.
  const canEditDue = isDraft;
  const startDueEdit = () => { setDueDraft(String(invoice.due_date || '').slice(0, 10)); setDueError(null); setEditingDue(true); };
  // Part-paid: the document ends with "Paid to date" and "Balance due".
  // Balance = total - paid - credited, so a credited invoice also ends with the steps.
  const partPaid = showBalance && Math.abs(balance - total) > 0.005;
  const paidInDoc = partPaid ? (paidToDate ?? total - balance - credited) : null;
  // The charge lines. An invoice made from a load with no itemised lines
  // shows that load as its one line, for the subtotal.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawLines: any[] = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const itemised = hasLedgerLines || rawLines.length > 0;
  // VAT per tax code from the saved lines (the server's rounded figures).
  const lineTotals = hasLedgerLines ? sumLines(ledgerLines.map(l => ({ net: l.net_amount, vat: l.vat_amount, discount: l.discount_amount, tax_code: l.tax_code }))) : null;
  const anyDiscount = ledgerLines.some(l => toNumber(l.discount_amount) > 0);
  const lines: { description: string; note?: string; quantity: number; unit: number }[] = itemised
    ? rawLines.map((item) => ({
        description: item.description || item.item_description || '—',
        quantity: num(item.quantity) || 1,
        unit: num(item.unit_price ?? item.price),
      }))
    : [{
        description: 'Transport',
        note: invoice.load_number ? `${invoice.load_number}, not itemised` : 'One amount, not itemised',
        quantity: 1,
        unit: invoice.subtotal != null ? num(invoice.subtotal) : total - (vat ?? 0),
      }];
  const terms = invoice.payment_terms ? String(invoice.payment_terms).replace(/^(?:NET)?\s*(\d+)$/i, '$1 days') : null;
  // The API may store the rate as a fraction (0.15) or a percentage (15).
  const vatRateText = taxRate != null ? (() => { const r = taxRate > 0 && taxRate <= 1 ? taxRate * 100 : taxRate; return formatPercent(r, Number.isInteger(Math.round(r * 100) / 100) ? 0 : 1); })() : null;


  // In date order. An invoice added to TruckWys after it was issued or sent
  // (imported, or captured late) says so, instead of "Created" appearing
  // after "Sent to customer" as if the dates disagreed.
  const at = (d?: string | null) => { const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const createdAt = at(invoice.created_at);
  const earlierFact = [at(invoice.sent_at), at(invoice.issue_date)].filter((t): t is number => t != null);
  const dayOf = (t: number) => Math.floor(t / 86_400_000);
  const recordedLate = createdAt != null && earlierFact.some(t => dayOf(createdAt) > dayOf(t));
  const activity = [
    recordedLate
      // Short label and value (R7): neither wraps in the rail.
      ? { label: 'Recorded', value: `${safeDate(invoice.created_at)}, after it was ${invoice.sent_at ? 'sent' : 'issued'}`, at: createdAt }
      : { label: 'Created', value: safeDate(invoice.created_at), at: createdAt },
    { label: 'Sent to customer', value: invoice.sent_at ? safeDate(invoice.sent_at) : 'Not sent', at: at(invoice.sent_at) },
    ...(invoice.viewed_at ? [{ label: 'Viewed by customer', value: safeDate(invoice.viewed_at), at: at(invoice.viewed_at) }] : []),
    {
      label: 'Reminders',
      value: invoice.reminder_count
        ? `${invoice.reminder_count} sent, last on ${safeDate(invoice.last_reminder_at)}`
        : 'None sent',
      at: invoice.reminder_count ? at(invoice.last_reminder_at) : null,
    },
    ...(invoice.paid_at ? [{ label: 'Paid', value: safeDate(invoice.paid_at), at: at(invoice.paid_at) }] : []),
  ]
    // Dated events in order; undated facts ("Not sent", "None sent") last, as listed.
    .map((r, i) => ({ ...r, i }))
    .sort((a, b) => (a.at == null ? 1 : 0) - (b.at == null ? 1 : 0) || (a.at != null && b.at != null ? a.at - b.at : 0) || a.i - b.i);

  // Past due: chasing is the job, so the reminder is the primary action.
  const primary = canRemind ? 'remind' : canSend ? 'send' : canRecordPayment ? 'pay' : canRecordInProvider && recordInProviderUrl ? 'pay-external' : null;
  const moreActions = [
    ...(primary === 'remind' && canSend
      ? [{ label: sending ? 'Sending…' : 'Resend invoice', onSelect: () => setPreview('invoice'), disabled: sending }]
      : []),
    // Not yet late: a (friendly) reminder stays available from the menu, as before.
    ...(primary !== 'remind' && REMINDER_STATUSES.has(status) && invoiceBalance(invoice) > 0
      ? [{ label: sendingReminder ? 'Sending…' : 'Send reminder', onSelect: () => setPreview('reminder'), disabled: sendingReminder }]
      : []),
    ...(primary !== 'pay' && canRecordPayment
      ? [{ label: 'Record payment', onSelect: () => setShowPaymentForm(true), disabled: showPaymentForm }]
      : []),
    ...(primary !== 'pay-external' && canRecordInProvider
      ? [{
          label: `Record payment in ${acctName}`,
          hint: recordInProviderUrl ? `Payments sync from ${acctName} automatically.` : `This invoice hasn't reached ${acctName} yet.`,
          onSelect: openRecordInProvider,
          disabled: !recordInProviderUrl,
        }]
      : []),
    ...(primary !== null
      ? [{ label: downloading ? 'Downloading…' : 'Download PDF', onSelect: handleDownloadPDF, disabled: downloading }]
      : []),
    ...(!isDraft && !isVoid ? [{ label: 'Edit note', onSelect: () => setNotesOpen(true) }] : []),
    ...(canCredit ? [{ label: 'Issue credit note', onSelect: () => setCreditOpen(true) }] : []),
    ...(canVoid ? [{ label: 'Void invoice', onSelect: () => setVoidOpen(true), danger: true }] : []),
    ...(isDraft ? [{ label: 'Delete draft', onSelect: () => setConfirmDelete(true), danger: true }] : []),
  ];

  // Bill to, dates and terms: the top of the document, or the rail's first
  // card. In the rail the customer is left out: the head already names it.
  const facts = (inRail: boolean) => (
    <div className="fin-docfacts">
      <dl className="fin-doc__facts">
        {!inRail && (
          <div>
            <dt>Bill to</dt>
            <dd title={invoice.customer_name}>{invoice.customer_name || '—'}</dd>
          </div>
        )}
        <div>
          <dt>Issued</dt>
          <dd>{safeDate(invoice.issue_date || invoice.created_at)}</dd>
        </div>
        <div>
          <dt className="fin-due-label">
            Due
            {canEditDue && (
              <button type="button" className="fin-due-edit-btn" onClick={startDueEdit} aria-label="Edit due date" title="Edit due date">
                <Pencil size={12} aria-hidden="true" />
              </button>
            )}
          </dt>
          <dd>
            {safeDate(invoice.due_date)}
            {daysLate != null && daysLate > 0 && (
              <span className="fin-doc__late fin-text-danger">{daysLate} {daysLate === 1 ? 'day' : 'days'} late</span>
            )}
          </dd>
        </div>
        {terms && (
          <div>
            <dt>Terms</dt>
            <dd>{terms}</dd>
          </div>
        )}
      </dl>
      {draftPastDue && (
        <p className="fin-docfacts__note">
          Draft · due date {safeDate(invoice.due_date)} has passed. Sent as it is, it arrives {daysPastDue} {daysPastDue === 1 ? 'day' : 'days'} overdue.
          {' '}<button type="button" className="fin-link" onClick={startDueEdit}>Change due date</button>
        </p>
      )}
    </div>
  );

  return (
    <div className="fin-page fin-page--invoice">
      {/* Edit due date: a small modal (the date picker's calendar opens above it). */}
      <Dialog open={editingDue} onOpenChange={(open) => { if (!savingDue) setEditingDue(open); }}>
        <DialogContent className="fin-due-dialog" aria-describedby="fin-due-dialog-sub">
          <DialogPrimitive.Title className="fin-due-dialog__title">Change due date</DialogPrimitive.Title>
          <p id="fin-due-dialog-sub" className="fin-due-dialog__sub">
            {invoice.invoice_number} · issued {safeDate(invoice.issue_date || invoice.created_at)}
          </p>
          <label htmlFor="invoice-due-date" className="fin-due-dialog__label">Due date</label>
          <DatePicker id="invoice-due-date" value={dueDraft} onChange={(v) => { setDueDraft(v); setDueError(null); }} />
          <p className={`fin-due-dialog__help${dueError ? ' is-error' : ''}`} role={dueError ? 'alert' : undefined}>
            {dueError || 'Reminders and overdue status follow the new date.'}
          </p>
          <div className="fin-due-dialog__actions">
            <button type="button" className="tw-btn" onClick={() => setEditingDue(false)} disabled={savingDue}>Cancel</button>
            <button type="button" className="tw-btn tw-btn--primary" onClick={handleSaveDueDate}
              disabled={savingDue || !dueDraft || dueDraft === String(invoice.due_date || '').slice(0, 10)}>
              {savingDue ? 'Saving…' : 'Save'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {toast && (
        <div className={`fin-toast${toast.isError ? ' fin-toast--error' : ''}`} role={toast.isError ? 'alert' : 'status'}>
          {toast.msg}
        </div>
      )}

      {preview && (
        <InvoiceSendPreview
          kind={preview}
          invoice={invoice}
          sending={preview === 'reminder' ? sendingReminder : sending}
          onCancel={() => setPreview(null)}
          onConfirm={async () => {
            if (preview === 'reminder') await handleSendReminder();
            else await handleSendInvoice();
            setPreview(null);
          }}
        />
      )}

      {creditOpen && (
        <CreditNoteDialog
          invoice={inv}
          onClose={() => setCreditOpen(false)}
          onIssued={(note) => {
            setCreditOpen(false);
            flash(note?.credit_note_number ? `Credit note ${note.credit_note_number} issued` : 'Credit note issued');
            refreshLedger();
          }}
        />
      )}
      {voidOpen && (
        <ReasonDialog
          title={`Void ${invoice.invoice_number}`}
          description="The invoice stays on record, marked void, and is no longer owed. Use this for an invoice sent by mistake; to correct one, issue a credit note."
          placeholder="e.g. Sent to the wrong customer"
          confirmLabel="Void invoice"
          danger
          onSubmit={handleVoid}
          onClose={() => setVoidOpen(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete draft"
          message={`Delete draft ${invoice.invoice_number}? It has not been sent, so nothing else changes. This cannot be undone.`}
          confirmLabel="Delete draft"
          danger
          onConfirm={handleDeleteDraft}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {notesOpen && (
        <NoteDialog
          invoiceId={invoice.id}
          initial={invoice.notes || ''}
          onClose={() => setNotesOpen(false)}
          onSaved={() => { setNotesOpen(false); flash('Note saved'); refreshLedger(); }}
        />
      )}
      {editingPayment && (
        <PaymentEditDialog
          payment={editingPayment}
          onClose={() => setEditingPayment(null)}
          onSaved={() => { setEditingPayment(null); flash('Payment updated'); refreshLedger(); }}
          onPaymentsManaged={onPaymentsManaged}
        />
      )}
      {deletingPayment && (
        <ConfirmModal
          title="Delete payment"
          message={`Delete the payment of ${formatCurrency(num(deletingPayment.amount))} on ${safeDate(deletingPayment.payment_date)}? The invoice balance goes back up by that amount.`}
          confirmLabel="Delete payment"
          danger
          onConfirm={() => handleDeletePayment(deletingPayment)}
          onCancel={() => setDeletingPayment(null)}
        />
      )}

      <SectionHeader
        title={invoice.invoice_number}
        titleAdornment={<span className="fin-head-chip"><StatusChip status={status} label={statusLabel} /></span>}
        back={{ to: '/finance/invoices', label: 'Invoices' }}
        description={<>
          {/* Phones: the status sits here, so the ID and the primary share the title row. */}
          <span className="fin-head-chip--sub"><StatusChip status={status} label={statusLabel} size="sm" /><span aria-hidden="true" className="section-header__sep" style={{ marginLeft: 6 }}>·</span></span>
          {invoice.customer_name}
          {/* The number itself says it is a load ("LOAD-…"). */}
          {/* Phones: when the charges line already names the load, it is not repeated here. */}
          {invoice.load_number && <span className={itemised ? undefined : 'fin-hide-phone'}>{' · '}<span className="fin-id" title="Load">{invoice.load_number}</span></span>}
        </>}
        actions={<>
          {/* One primary action; everything else sits behind one menu. A
              draft also offers Edit beside it (lines change until it is sent). */}
          {canEditDraft && (
            <button type="button" className="tw-btn" onClick={() => navigate(`/finance/invoices/${id}/edit`)}>Edit draft</button>
          )}
          {primary === 'remind' ? (
            <HeadAction icon={<BellRing size={16} strokeWidth={1.75} aria-hidden="true" />} label={sendingReminder ? 'Sending…' : 'Send reminder'} short={sendingReminder ? 'Sending…' : 'Remind'}
              onClick={() => setPreview('reminder')} disabled={sendingReminder} />
          ) : primary === 'send' ? (
            <HeadAction icon={<Send size={16} strokeWidth={1.75} aria-hidden="true" />}
              label={sending ? 'Sending…' : status === 'VIEWED' || status === 'SENT' ? 'Resend to customer' : 'Send to customer'}
              short={sending ? 'Sending…' : status === 'VIEWED' || status === 'SENT' ? 'Resend' : 'Send'}
              onClick={() => setPreview('invoice')} disabled={sending} />
          ) : primary === 'pay' ? (
            <HeadAction icon={<Banknote size={16} strokeWidth={1.75} aria-hidden="true" />} label="Record payment" short="Record payment"
              onClick={() => setShowPaymentForm(true)} disabled={showPaymentForm}
              extra={{ 'aria-expanded': showPaymentForm, 'aria-controls': 'record-payment' }} />
          ) : primary === 'pay-external' ? (
            <HeadAction icon={<ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />} label={`Record payment in ${acctName}`} short={`Record in ${acctName}`}
              onClick={openRecordInProvider} extra={{ title: `Opens this invoice in ${acctName}. Payments sync from ${acctName} automatically.` }} />
          ) : (
            <button type="button" className="tw-btn" onClick={handleDownloadPDF} disabled={downloading}>
              {downloading ? 'Downloading…' : 'Download PDF'}
            </button>
          )}
        </>}
        // Everything but the primary lives in the head's one "⋯" menu (all widths).
        menuItems={moreActions}
      />

      {/* One invoice document (party, dates, lines, totals) and a sticky side
          rail, so the two columns read as document + rail, not as a gap.
          Dates are facts in the document, not KPI tiles; each figure once. */}
      <div className="fin-detail-grid">
        <div className="fin-main-col" ref={bal.mainRef}>
        <AccountingSyncNotice sync={inv.accounting_sync} what="invoice" />
        {/* Why this invoice can't change: void, financed, or sent (locked). */}
        {isVoid ? (
          <div className="fl-notice fl-notice--danger" role="status">
            <Ban size={16} aria-hidden="true" />
            <div>
              <strong>Void{inv.voided_at ? ` since ${safeDate(inv.voided_at)}` : ''}</strong>
              {inv.void_reason ? `Reason: ${inv.void_reason}. ` : ''}A void invoice is kept for the record and is not owed.
            </div>
          </div>
        ) : inv.is_financed ? (
          <div className="fl-notice fl-notice--warning" role="status">
            <Lock size={16} aria-hidden="true" />
            <div>
              <strong>Financed through Fast Pay</strong>
              {inv.lock_reason || 'This invoice has been financed, so it is locked: it can’t be edited or voided. Payments go to the financier.'}
            </div>
          </div>
        ) : inv.is_locked ? (
          <div className="fl-notice" role="status">
            <Lock size={16} aria-hidden="true" />
            <div>
              <strong>Locked</strong>
              {inv.lock_reason ? `${inv.lock_reason}. ` : ''}Sent invoices can't be edited — issue a credit note to correct one.
            </div>
            {canCredit && <button type="button" className="tw-btn fl-notice__action" onClick={() => setCreditOpen(true)}>Issue credit note</button>}
          </div>
        ) : null}
        <section className="card fin-table-card fin-doc" aria-labelledby="invoice-doc-title">
          <h2 id="invoice-doc-title" className="fin-sr">Invoice {invoice.invoice_number}</h2>
          {bal.inMain('facts') && facts(false)}

          {/* Charges: the itemised lines (with tax code and VAT per line), or
              (an invoice charged as one amount from its load) a single line
              that says so, then the totals, so every invoice reads as a
              complete document. */}
          <div className="fin-doc__lines">
            <div className="fin-doc__head">
              <h3 className="fin-panel-title">Charges</h3>
              <p className="fin-panel-desc">
                {hasLedgerLines
                  ? `${ledgerLines.length} ${ledgerLines.length === 1 ? 'line' : 'lines'}, amounts excl. VAT`
                  : itemised ? `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}, excl. VAT` : 'One amount, excl. VAT'}
              </p>
            </div>
            <div className="fin-table-scroll">
              {hasLedgerLines ? (
                <table className="fin-table fin-doc__table table-heading-roles">
                  <thead>
                    <tr>
                      <th className="fin-cell-fill">Description</th>
                      <th className="num m-hide">Qty</th>
                      <th className="num m-hide">Unit price</th>
                      {anyDiscount && <th className="num m-hide">Discount</th>}
                      <th className="m-hide">Tax</th>
                      <th className="num m-hide">VAT</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerLines.map((l) => (
                      <tr key={l.id}>
                        <td className="fin-strong fin-cell-fill">
                          <div className="fin-doc__desc" title={l.description}>{l.description}</div>
                          {l.revenue_type && l.revenue_type !== 'FREIGHT' && <span className="fl-line-type">{revenueTypeLabel(l.revenue_type)}</span>}
                          {/* Phones: quantity, price, tax and VAT under the description. */}
                          <span className="fin-cell-sub fin-mobile-only">
                            {formatQuantity(l.quantity)} × {formatCurrency(l.unit_price)}
                            {toNumber(l.discount_amount) > 0 ? `, less ${formatCurrency(l.discount_amount)}` : ''}
                            {' · '}{taxCodeShort(l.tax_code)}, VAT {formatCurrency(l.vat_amount)}
                          </span>
                        </td>
                        <td className="num m-hide">{formatQuantity(l.quantity)}</td>
                        <td className="num m-hide">{formatCurrency(l.unit_price)}</td>
                        {anyDiscount && <td className="num m-hide">{toNumber(l.discount_amount) > 0 ? `−${formatCurrency(l.discount_amount)}` : '—'}</td>}
                        <td className="m-hide"><span className="fl-tax">{taxCodeShort(l.tax_code)}</span></td>
                        <td className="num m-hide">{formatCurrency(l.vat_amount)}</td>
                        <td className="num">{formatCurrency(l.net_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="fin-table fin-doc__table table-heading-roles">
                  <thead>
                    <tr>
                      <th className="fin-cell-fill">Description</th>
                      <th className="num m-hide">Quantity</th>
                      <th className="num m-hide">Unit price</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((item, idx) => (
                      <tr key={idx}>
                        <td className="fin-strong fin-cell-fill">
                          <div className="fin-doc__desc" title={item.description}>{item.description}</div>
                          {item.note && <span className="fin-cell-sub">{item.note}</span>}
                          {/* Phones: quantity and unit price under the description. */}
                          {itemised && <span className="fin-cell-sub fin-mobile-only">{item.quantity} × {formatCurrency(item.unit)}</span>}
                        </td>
                        <td className="num m-hide">{item.quantity}</td>
                        <td className="num m-hide">{formatCurrency(item.unit)}</td>
                        <td className="num">{formatCurrency(item.quantity * item.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <dl className="fin-doc__totals">
              {num(invoice.discount) > 0 && (
                <>
                  <div><dt>Before discount</dt><dd>{formatCurrency(num(invoice.subtotal) + num(invoice.discount))}</dd></div>
                  <div><dt>Discount</dt><dd>−{formatCurrency(num(invoice.discount))}</dd></div>
                </>
              )}
              {invoice.subtotal != null && (
                <div><dt>Subtotal excl. VAT</dt><dd>{formatCurrency(num(invoice.subtotal))}</dd></div>
              )}
              {lineTotals && lineTotals.byCode.length > 1 ? (
                lineTotals.byCode.map(b => (
                  <div key={b.code}><dt>{taxCodeShort(b.code)} on {formatCurrency(b.net)}</dt><dd>{formatCurrency(b.vat)}</dd></div>
                ))
              ) : vat != null && (
                <div>
                  <dt>{lineTotals && lineTotals.byCode[0] && lineTotals.byCode[0].code !== 'STANDARD'
                    ? `VAT (${taxCodeShort(lineTotals.byCode[0].code).toLowerCase()})`
                    : `VAT${vatRateText ? ` (${vatRateText})` : lineTotals ? ' (15%)' : ''}`}</dt>
                  <dd>{formatCurrency(vat)}</dd>
                </div>
              )}
              <div className={partPaid ? 'is-rule' : 'is-rule is-total'}><dt>{showBalance && !partPaid ? 'Total due' : 'Total, incl. VAT'}</dt><dd>{formatCurrency(total)}</dd></div>
              {partPaid && (paidInDoc ?? 0) > 0.005 && (
                <div><dt>Paid to date</dt><dd>−{formatCurrency(paidInDoc ?? 0)}</dd></div>
              )}
              {partPaid && credited > 0.005 && (
                <div><dt>Credited</dt><dd>−{formatCurrency(credited)}</dd></div>
              )}
              {partPaid && (
                <div className="is-total"><dt>Balance due</dt><dd>{formatCurrency(balance)}</dd></div>
              )}
              {!partPaid && credited > 0.005 && (
                <div><dt>Credited</dt><dd>−{formatCurrency(credited)}</dd></div>
              )}
            </dl>
          </div>
          {/* The system note "Auto-generated from Load …" only restates the load
              already named in the head, so it is not shown; real notes are. */}
          {invoice.notes && !/^auto-generated from load\b/i.test(String(invoice.notes).trim()) && (
            <p className="fin-note fin-doc__note">Note: {invoice.notes}</p>
          )}
        </section>

        </div>

        {/* Side rail: sticky, same top as the document. */}
        <aside className="fin-rail" ref={bal.sideRef} aria-label="Invoice details, payments and activity">
          {!bal.inMain('facts') && (
            <section className="card fin-facts-card" aria-label="Invoice dates and terms">{facts(true)}</section>
          )}
          <AccountingSyncCard sync={inv.accounting_sync} what="invoice" localNumber={inv.invoice_number} />
          {showPaymentForm && !managedHere && (
            <section className="card" id="record-payment" aria-labelledby="record-payment-title">
              <div className="fin-panel-head">
                <div className="fin-panel-head__text">
                  <h2 id="record-payment-title" className="fin-panel-title">Record a payment</h2>
                  <p className="fin-panel-desc">Balance due {formatCurrency(balance)}, incl. VAT.</p>
                </div>
              </div>
              <div className="fin-form" style={{ gap: 12 }}>
                <div>
                  <label className="fin-label" htmlFor="pay-amount">Amount (ZAR)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="pay-amount"
                      className="fin-control"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      style={{ flex: 1, minWidth: 0, fontVariantNumeric: 'tabular-nums' }}
                    />
                    <button
                      type="button"
                      className="btn-action fin-btn-secondary"
                      onClick={() => setPaymentAmount(String(invoice.balance))}
                      aria-label="Use full balance"
                    >
                      Full balance
                    </button>
                  </div>
                </div>
                <div>
                  <label className="fin-label">Payment date</label>
                  <DatePicker
                    value={paymentDate}
                    onChange={setPaymentDate}
                    maxDate={new Date()}
                  />
                </div>
                <div>
                  <label className="fin-label" id="pay-method-label">Method</label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger aria-labelledby="pay-method-label">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EFT">EFT</SelectItem>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="CARD">Card</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="fin-label" htmlFor="pay-ref">Reference (optional)</label>
                  <input
                    id="pay-ref"
                    className="fin-control"
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowPaymentForm(false)} className="btn-action fin-btn-secondary">
                    Cancel
                  </button>
                  <button onClick={handleRecordPayment} disabled={recordingPayment} className="btn-action">
                    {recordingPayment ? 'Saving…' : 'Save payment'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {((payments && payments.length > 0) || canRecordInProvider) && (
            <section className="card fin-table-card" aria-labelledby="payments-title">
              <div className="fin-panel-head">
                <div className="fin-panel-head__text">
                  <h2 id="payments-title" className="fin-panel-title">Payments</h2>
                  <p className="fin-panel-desc">
                    {managedHere
                      ? `${formatCurrency(totalPaid)} paid. Record new payments in ${acctName}; they appear here within a few minutes.`
                      : `${payments.length} recorded, by payment date`}
                  </p>
                </div>
                {managedHere && canRecordInProvider && <PaymentsManagedNote providerName={acctName} recordUrl={recordInProviderUrl} />}
              </div>

              <ul className={`fin-paylist${managedHere ? ' acct-paylist-top' : ''}`}>
                {payments.map((payment: any, idx: number) => {
                  const ref = payment.reference_number || payment.reference || payment.payment_number;
                  return (
                    <li key={payment.id ?? idx} className="fin-paylist__row">
                      <span className="fin-paylist__main">
                        <span className="fin-date">{safeDate(payment.payment_date || payment.date)}</span>
                        <span className="fin-paylist__sub">
                          {methodLabel(payment.payment_method || payment.method || 'EFT')}
                          {ref && <> · <span className="fin-id">{ref}</span></>}
                          {managedHere && <PaymentSourceBadge source={payment.source} managed />}
                        </span>
                        {!managedHere && <PaymentSourceBadge source={payment.source} />}
                      </span>
                      <span className="fl-pay-actions">
                        <span className="fin-paylist__amt">{formatCurrency(num(payment.amount))}</span>
                        {/* Only payments recorded here can change; synced ones belong to their source. */}
                        {payment.id != null && isManualPayment(payment) && !managedHere && (
                          <RowActions
                            label={`Payment of ${formatCurrency(num(payment.amount))} on ${safeDate(payment.payment_date)}`}
                            items={[
                              { label: 'Edit payment', onSelect: () => setEditingPayment(payment) },
                              { label: 'Delete payment', onSelect: () => setDeletingPayment(payment), danger: true },
                            ]}
                          />
                        )}
                      </span>
                    </li>
                  );
                })}
                {/* The total only when the document does not already show it. */}
                {payments.length > 1 && (paidInDoc == null || Math.abs(totalPaid - paidInDoc) > 0.005) && (
                  <li className="fin-paylist__row fin-paylist__row--total">
                    <span>Total paid</span>
                    <span className="fin-paylist__amt">{formatCurrency(totalPaid)}</span>
                  </li>
                )}
              </ul>
            </section>
          )}


          {creditNotes.length > 0 && (
            <section className="card fin-table-card" aria-labelledby="credit-notes-title">
              <div className="fin-panel-head">
                <div className="fin-panel-head__text">
                  <h2 id="credit-notes-title" className="fin-panel-title">Credit notes</h2>
                  <p className="fin-panel-desc">{formatCurrency(credited)} credited, incl. VAT</p>
                </div>
              </div>
              <ul className="fin-paylist">
                {creditNotes.map(c => {
                  const voided = String(c.status).toUpperCase() === 'VOID';
                  return (
                    <li key={c.id} className="fin-paylist__row">
                      <span className="fin-paylist__main">
                        <Link to={`/finance/credit-notes/${c.id}`} className="fin-id acct-ink-link">{c.credit_note_number}</Link>
                        <span className="fin-paylist__sub">{safeDate(c.issue_date)}{voided ? ' · Void' : ''}</span>
                      </span>
                      <span className="fin-paylist__amt" style={voided ? { textDecoration: 'line-through', color: 'var(--text-tertiary)' } : undefined}>
                        −{formatCurrency(c.total_amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Where the balance comes from, once anything has been paid or credited. */}
          {!isDraft && !isVoid && !partPaid && (credited > 0.005 || num(invoice.paid_amount) > 0.005) && (
            <section className="card" aria-labelledby="balance-title">
              <div className="fin-panel-head" style={{ marginBottom: 4 }}>
                <div className="fin-panel-head__text">
                  <h2 id="balance-title" className="fin-panel-title">Balance</h2>
                </div>
              </div>
              <dl className="fin-dl">
                <div className="fin-dl__row"><dt>Invoice total</dt><dd>{formatCurrency(total)}</dd></div>
                <div className="fin-dl__row"><dt>Paid</dt><dd>−{formatCurrency(num(invoice.paid_amount))}</dd></div>
                <div className="fin-dl__row"><dt>Credited</dt><dd>−{formatCurrency(credited)}</dd></div>
                <div className="fin-dl__row is-total"><dt>Balance</dt><dd>{formatCurrency(balance)}</dd></div>
              </dl>
            </section>
          )}

          <section className="card" aria-labelledby="activity-title">
            <div className="fin-panel-head" style={{ marginBottom: 4 }}>
              <div className="fin-panel-head__text">
                <h2 id="activity-title" className="fin-panel-title">Activity</h2>
              </div>
            </div>
            <dl className="fin-dl">
              {activity.map(r => (
                <div key={r.label} className="fin-dl__row">
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {(capitalEntry || ineligibleEntry) && (
            <section className="card" aria-labelledby="fastpay-title">
              <div className="fin-panel-head">
                <div className="fin-panel-head__text">
                  <h2 id="fastpay-title" className="fin-panel-title fin-panel-title--tip">
                    Fast Pay
                    {!CAPITAL_LAUNCHED && <InfoTip align="end">{CAPITAL_COMING_SOON}</InfoTip>}
                  </h2>
                  {!CAPITAL_LAUNCHED && <p className="fin-panel-desc">Not live yet</p>}
                </div>
              </div>
              {capitalEntry && (
                applied ? (
                  <div className="fin-inset">
                    <p className="fin-note"><strong>Applied for Fast Pay</strong>Your earlier application is on record.</p>
                  </div>
                ) : (
                  <button type="button" className="btn-action fin-btn-secondary" style={{ width: '100%' }}
                    disabled={!CAPITAL_LAUNCHED} title={CAPITAL_LAUNCHED ? undefined : CAPITAL_COMING_SOON}>
                    {CAPITAL_LAUNCHED ? 'Apply for Fast Pay' : 'Apply for Fast Pay (coming soon)'}
                  </button>
                )
              )}
              {ineligibleEntry && (
                <div className="fin-inset">
                  <p className="fin-note"><strong>This invoice would not qualify</strong>{ineligibleEntry.reason}</p>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

/** The invoice head's one primary. Phones show a short label ("Send",
 *  "Remind") so it stays on the title row beside the invoice number; the
 *  full label stays its accessible name and its label in "⋯". The leading
 *  icon is only drawn when SectionHeader falls back to an icon button. */
function HeadAction({ icon, label, short, onClick, disabled, extra }: {
  icon: React.ReactNode; label: string; short: string; onClick: () => void; disabled?: boolean;
  extra?: React.ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-expanded'?: boolean; 'aria-controls'?: string };
}) {
  return (
    <button type="button" className="tw-btn tw-btn--primary fin-act" onClick={onClick} disabled={disabled}
      aria-label={label} data-short={short} {...extra}>
      {icon}
      <span className="fin-act__long">{label}</span>
    </button>
  );
}

/** Notes stay editable on a sent (locked) invoice; nothing else does. */
function NoteDialog({ invoiceId, initial, onClose, onSaved }: { invoiceId: number; initial: string; onClose: () => void; onSaved: () => void }) {
  const [notes, setNotes] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await patchData({ url: FIN_URL.invoice(invoiceId), data: { notes } });
      onSaved();
    } catch (err) {
      setError(errorText(err, "Couldn't save the note"));
      setBusy(false);
    }
  };
  return (
    <FinDialog title="Edit note" description="The note prints on the invoice. The amounts can't change once it is sent." onClose={onClose} busy={busy}>
      <form className="fin-form" onSubmit={save}>
        <div>
          <label className="fin-label" htmlFor="inv-note">Note</label>
          <textarea id="inv-note" className="fin-control" rows={4} value={notes} onChange={e => setNotes(e.target.value)} data-autofocus />
        </div>
        {error && <p className="fin-help fin-text-danger" role="alert" style={{ margin: 0 }}>{error}</p>}
        <div className="fin-dialog__foot">
          <button type="button" className="tw-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="tw-btn tw-btn--primary" disabled={busy || notes === initial}>{busy ? 'Saving…' : 'Save note'}</button>
        </div>
      </form>
    </FinDialog>
  );
}
