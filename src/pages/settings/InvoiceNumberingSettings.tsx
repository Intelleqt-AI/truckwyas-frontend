import '@/pages/settings/settings-brand.css';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { patchData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import '@/components/data/load-error.css';
import { FIN_URL, errorText, useFinanceSettings } from '@/lib/finance/api';
import type { FinanceSettings, FinanceSettingsInput } from '@/lib/finance/types';
import {
  SettingsPageHeader, settingsCardActionsStyle, settingsCardBodyStyle, settingsCardHeaderStyle, settingsCardStyle,
  settingsCardTitleStyle, settingsErrorStyle, settingsHelpStyle, settingsInputStyle, settingsLabelStyle, settingsBadgeStyle,
} from './settingsUi';

interface Form { invoice_prefix: string; invoice_next_number: string; credit_note_prefix: string; credit_note_next_number: string; number_padding: string }

const toForm = (s: FinanceSettings): Form => ({
  invoice_prefix: s.invoice_prefix ?? '',
  invoice_next_number: String(s.invoice_next_number ?? ''),
  credit_note_prefix: s.credit_note_prefix ?? '',
  credit_note_next_number: String(s.credit_note_next_number ?? ''),
  number_padding: String(s.number_padding ?? ''),
});

/** "INV-" + 42 padded to 5 → "INV-00042": the local preview while typing. */
const preview = (prefix: string, next: string, pad: string) => {
  const n = parseInt(next, 10);
  const p = Math.min(Math.max(parseInt(pad, 10) || 0, 0), 12);
  return Number.isFinite(n) && n > 0 ? `${prefix}${String(n).padStart(p, '0')}` : '—';
};

const wholePositive = (v: string) => /^\d+$/.test(v.trim()) && parseInt(v, 10) > 0;

/**
 * Invoice and credit note numbering. Drafts carry a provisional number; the
 * next number here is used when an invoice is sent. Admins edit (the API
 * returns can_edit); everyone else reads. A next number lower than one
 * already used is refused by the server, and its message is shown.
 */
export function InvoiceNumberingSettings() {
  const qc = useQueryClient();
  const query = useFinanceSettings();
  const settings = query.data;
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (settings) setForm(toForm(settings)); }, [settings]);

  const canEdit = !!settings?.can_edit;
  const set = (k: keyof Form, v: string) => { setForm(f => (f ? { ...f, [k]: v } : f)); setError(''); };

  if (loadFailed(query)) {
    return (
      <div style={{ maxWidth: 'var(--form-max, 720px)' }}>
        <SettingsPageHeader title="Invoice numbering" description="How invoices and credit notes are numbered" />
        <LoadError what="the numbering settings" error={query.error ?? query.failureReason} busy={query.isFetching} onRetry={() => query.refetch()} />
      </div>
    );
  }
  if (!settings || !form) {
    return (
      <div style={{ maxWidth: 'var(--form-max, 720px)' }} aria-busy="true">
        <SettingsPageHeader title="Invoice numbering" description="How invoices and credit notes are numbered" />
        <div className="fin-skel fin-skel--card" style={{ height: 320, marginTop: 0, background: 'var(--bg-raised)', borderRadius: 'var(--radius-card)' }} aria-hidden="true" />
      </div>
    );
  }

  const initial = toForm(settings);
  const changed = (Object.keys(form) as (keyof Form)[]).filter(k => form[k] !== initial[k]);
  const problems = [
    !wholePositive(form.invoice_next_number) && 'The next invoice number must be a whole number above 0.',
    !wholePositive(form.credit_note_next_number) && 'The next credit note number must be a whole number above 0.',
    !/^\d+$/.test(form.number_padding.trim()) || parseInt(form.number_padding, 10) > 12 ? 'Digits must be a whole number from 0 to 12.' : false,
  ].filter(Boolean) as string[];

  const save = async () => {
    if (!changed.length || problems.length) return;
    setSaving(true); setError('');
    const data: FinanceSettingsInput = {};
    for (const k of changed) {
      if (k === 'invoice_prefix' || k === 'credit_note_prefix') data[k] = form[k];
      else data[k] = parseInt(form[k], 10);
    }
    try {
      const saved: FinanceSettings = await patchData({ url: FIN_URL.settings, data });
      if (saved) qc.setQueryData(['finance', 'settings'], saved);
      qc.invalidateQueries({ queryKey: ['finance', 'settings'] });
      toast.success('Numbering saved');
    } catch (e) {
      setError((e as { status?: number })?.status === 403
        ? 'Only an admin can change numbering.'
        : errorText(e, "Couldn't save the numbering settings"));
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof Form, label: string, opts: { numeric?: boolean; help?: string; placeholder?: string } = {}) => (
    <div>
      <label htmlFor={`num-${k}`} style={settingsLabelStyle}>{label}</label>
      <input id={`num-${k}`} className="settings-control" style={settingsInputStyle} value={form[k]} disabled={!canEdit}
        inputMode={opts.numeric ? 'numeric' : undefined} placeholder={opts.placeholder}
        onChange={e => set(k, opts.numeric ? e.target.value.replace(/[^\d]/g, '') : e.target.value)} />
      {opts.help && <div style={settingsHelpStyle}>{opts.help}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 'var(--form-max, 720px)' }}>
      <SettingsPageHeader title="Invoice numbering" description="How invoices and credit notes are numbered" />

      <div style={settingsCardStyle}>
        <div style={settingsCardHeaderStyle}>
          <h2 style={settingsCardTitleStyle}>Invoices</h2>
          {!canEdit && <span style={settingsBadgeStyle}>Admins can change this</span>}
        </div>
        <div style={settingsCardBodyStyle}>
          <div className="cs-grid cs-grid--2" style={{ marginBottom: 16 }}>
            {field('invoice_prefix', 'Prefix', { placeholder: 'INV-' })}
            {field('invoice_next_number', 'Next number', { numeric: true, help: "Can't be lower than a number already used." })}
          </div>
          <Preview label="Next invoice" value={changed.length ? preview(form.invoice_prefix, form.invoice_next_number, form.number_padding) : settings.next_invoice_number_preview} />
          <div style={{ ...settingsHelpStyle, marginTop: 12 }}>
            Drafts show a provisional number (like DRAFT-1A2B3C). The real number is given when the invoice is sent, so numbers have no gaps.
          </div>
        </div>
      </div>

      <div style={settingsCardStyle}>
        <div style={settingsCardHeaderStyle}><h2 style={settingsCardTitleStyle}>Credit notes</h2></div>
        <div style={settingsCardBodyStyle}>
          <div className="cs-grid cs-grid--2" style={{ marginBottom: 16 }}>
            {field('credit_note_prefix', 'Prefix', { placeholder: 'CN-' })}
            {field('credit_note_next_number', 'Next number', { numeric: true })}
          </div>
          <Preview label="Next credit note" value={changed.length ? preview(form.credit_note_prefix, form.credit_note_next_number, form.number_padding) : settings.next_credit_note_number_preview} />
        </div>
      </div>

      <div style={settingsCardStyle}>
        <div style={settingsCardHeaderStyle}><h2 style={settingsCardTitleStyle}>Format</h2></div>
        <div style={settingsCardBodyStyle}>
          <div className="cs-grid cs-grid--2">
            {field('number_padding', 'Digits', { numeric: true, help: 'Numbers are padded with zeros to this length: 5 gives 00042.' })}
            <div>
              <span style={settingsLabelStyle}>VAT</span>
              <div style={{ ...settingsInputStyle, display: 'flex', alignItems: 'center', background: 'transparent', border: 0, paddingLeft: 0 }}>
                {settings.vat_registered ? 'VAT registered: invoices are tax invoices' : 'Not VAT registered'}
              </div>
            </div>
          </div>
          {problems.length > 0 && canEdit && <div style={settingsErrorStyle} role="alert">{problems[0]}</div>}
          {error && <div style={settingsErrorStyle} role="alert">{error}</div>}
          {canEdit && (
            <div style={settingsCardActionsStyle}>
              <button type="button" className="tw-btn" onClick={() => { setForm(initial); setError(''); }} disabled={saving || !changed.length}>Discard</button>
              <button type="button" className="tw-btn tw-btn--primary" onClick={save} disabled={saving || !changed.length || problems.length > 0}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, padding: '12px 16px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-nested, 8px)' }}>
      <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value || '—'}</span>
    </div>
  );
}

export default InvoiceNumberingSettings;
