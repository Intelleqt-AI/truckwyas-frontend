import { useEffect, useState } from 'react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { toast } from '@/lib/toast';
import { useAuth } from '@/lib/AuthContext';
import {
  apiMessage, automationChangeLines, automationPatch, boundError, fieldErrors, type QuoteAutomation,
} from '@/lib/followups';
import {
  SettingsSwitch, settingsCardActionsStyle, settingsCardHeaderStyle, settingsCardStyle, settingsCardTitleStyle,
  settingsErrorStyle,
} from '@/pages/settings/settingsUi';
import { useIsAdmin, useQuoteAutomation, useSaveAutomation } from './useFollowUps';
import './followups.css';

type NumKey = 'fuel_surcharge_threshold_pct' | 'follow_up_after_days' | 'expiry_nudge_days';
type Draft = Omit<QuoteAutomation, NumKey> & Record<NumKey, string>;

const toDraft = (s: QuoteAutomation): Draft => ({
  ...s,
  fuel_surcharge_threshold_pct: String(s.fuel_surcharge_threshold_pct).replace('.', ','),
  follow_up_after_days: String(s.follow_up_after_days),
  expiry_nudge_days: String(s.expiry_nudge_days),
});

const fromDraft = (d: Draft): QuoteAutomation => ({
  ...d,
  fuel_surcharge_threshold_pct: Number(d.fuel_surcharge_threshold_pct.trim().replace(',', '.')),
  follow_up_after_days: Number(d.follow_up_after_days.trim()),
  expiry_nudge_days: Number(d.expiry_nudge_days.trim()),
});

/** Settings → Company details → "Quote follow-ups" (spec §1). Admins edit;
 *  everyone else sees the same card read-only. A change is confirmed before
 *  it is saved. */
export function QuoteFollowUpsCard() {
  const isAdmin = useIsAdmin();
  const { user } = useAuth();
  const isDemo = !!user?.is_demo;
  const q = useQuoteAutomation();
  const save = useSaveAutomation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ lines: string[]; patch: Partial<QuoteAutomation> } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (q.data && !draft) setDraft(toDraft(q.data)); }, [q.data, draft]);

  if (q.isError) {
    return (
      <div style={settingsCardStyle} id="quote-follow-ups">
        <div style={settingsCardHeaderStyle}><h2 style={settingsCardTitleStyle}>Quote follow-ups</h2></div>
        <p className="fu-row__help" style={{ padding: 'var(--card-pad, 20px)', margin: 0 }}>
          Couldn't load these settings.{' '}
          <button type="button" className="fu-link" onClick={() => q.refetch()}>Retry</button>
        </p>
      </div>
    );
  }
  if (!q.data || !draft) return null;

  const readOnly = !isAdmin || isDemo;
  const readOnlyTitle = isDemo ? 'Fixed in demo mode' : 'Only an admin can change these';
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft(p => (p ? { ...p, [k]: v } : p));
    if (errors[k as string]) setErrors(p => ({ ...p, [k as string]: '' }));
  };
  const blurCheck = (k: NumKey) => setErrors(p => ({ ...p, [k]: boundError(k, draft[k]) || '' }));

  const onSave = () => {
    const errs: Record<string, string> = {};
    (['fuel_surcharge_threshold_pct', 'follow_up_after_days', 'expiry_nudge_days'] as NumKey[]).forEach(k => {
      const e = boundError(k, draft[k]);
      if (e) errs[k] = e;
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const patch = automationPatch(q.data!, fromDraft(draft));
    if (!Object.keys(patch).length) { toast.success('No changes to save'); return; }
    setConfirm({ lines: automationChangeLines(q.data!, patch), patch });
  };

  const doSave = async (patch: Partial<QuoteAutomation>) => {
    setSaving(true);
    try {
      const res = await save(patch);
      setDraft(toDraft(res));
      setErrors({});
      toast.success('Quote follow-ups saved');
    } catch (e) {
      const fe = fieldErrors(e);
      if (Object.keys(fe).length) setErrors(fe);
      toast.error(apiMessage(e, 'Saving failed. Your changes are not saved.'));
    }
    setSaving(false);
  };

  const num = (k: NumKey, label: string, suffix: string, width = 64) => (
    <span className="fu-num">
      <input
        id={`fu-${k}`}
        className="fu-num__input settings-control"
        style={{ width }}
        inputMode={k === 'fuel_surcharge_threshold_pct' ? 'decimal' : 'numeric'}
        aria-label={label}
        aria-invalid={errors[k] ? true : undefined}
        aria-describedby={errors[k] ? `fu-${k}-err` : undefined}
        value={draft[k]}
        disabled={readOnly}
        title={readOnly ? readOnlyTitle : undefined}
        onChange={e => set(k, e.target.value)}
        onBlur={() => blurCheck(k)}
      />
      <span className="fu-num__suffix">{suffix}</span>
    </span>
  );
  const err = (k: NumKey) => errors[k]
    ? <div id={`fu-${k}-err`} role="alert" style={{ ...settingsErrorStyle, marginTop: 4 }}>{errors[k]}</div>
    : null;

  return (
    <div style={{ ...settingsCardStyle, scrollMarginTop: 16 }} id="quote-follow-ups">
      <div style={settingsCardHeaderStyle}><h2 style={settingsCardTitleStyle}>Quote follow-ups</h2></div>
      <div className="fu-card">
        <div className="fu-row">
          <div className="fu-row__head">
            <span className="fu-row__label">Fuel price clause on quotes</span>
            <SettingsSwitch label="Fuel price clause on quotes" checked={draft.fuel_surcharge_enabled}
              onChange={v => set('fuel_surcharge_enabled', v)} disabled={readOnly} title={readOnly ? readOnlyTitle : undefined} />
          </div>
          {draft.fuel_surcharge_enabled && (
            <div className="fu-row__line">
              <label htmlFor="fu-fuel_surcharge_threshold_pct">Change the fuel part when the official price moves more than</label>
              {num('fuel_surcharge_threshold_pct', 'Fuel price change', '%')}
            </div>
          )}
          {err('fuel_surcharge_threshold_pct')}
          <p className="fu-row__help">Your quotes say the diesel price they were priced on. If the official price moves more than this before the trip, the invoice adds or takes off the difference.</p>
        </div>

        <div className="fu-row">
          <div className="fu-row__head">
            <span className="fu-row__label">Fuel price alerts</span>
            <SettingsSwitch label="Fuel price alerts" checked={draft.fuel_alerts_enabled}
              onChange={v => set('fuel_alerts_enabled', v)} disabled={readOnly} title={readOnly ? readOnlyTitle : undefined} />
          </div>
          <p className="fu-row__help">Tell us when a new official price affects open quotes.</p>
        </div>

        <div className="fu-row">
          <div className="fu-row__head">
            <span className="fu-row__label">Follow-up reminders</span>
            <SettingsSwitch label="Follow-up reminders" checked={draft.follow_ups_enabled}
              onChange={v => set('follow_ups_enabled', v)} disabled={readOnly} title={readOnly ? readOnlyTitle : undefined} />
          </div>
          {draft.follow_ups_enabled && (
            <>
              <div className="fu-row__line">
                <label htmlFor="fu-follow_up_after_days">Remind me after</label>
                {num('follow_up_after_days', 'Days with no answer', 'days with no answer', 56)}
              </div>
              {err('follow_up_after_days')}
              <div className="fu-row__line">
                <label htmlFor="fu-expiry_nudge_days">and</label>
                {num('expiry_nudge_days', 'Days before a quote expires', 'days before a quote expires', 56)}
              </div>
              {err('expiry_nudge_days')}
            </>
          )}
        </div>

        {isAdmin && (
          <div className="fu-row">
            <div className="fu-row__head">
              <span className="fu-row__label">Weekly margin email</span>
              <SettingsSwitch label="Weekly margin email" checked={draft.weekly_margin_email_enabled}
                onChange={v => set('weekly_margin_email_enabled', v)} disabled={readOnly} title={readOnly ? readOnlyTitle : undefined} />
            </div>
            <p className="fu-row__help">Mondays at 07:00. Sent to admins.</p>
          </div>
        )}

        {!readOnly && (
          <div style={{ ...settingsCardActionsStyle, marginTop: 0, padding: '0 var(--card-pad, 20px) var(--card-pad, 20px)' }}>
            <button type="button" className="btn-action settings-control" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save follow-ups'}
            </button>
          </div>
        )}
        {readOnly && !isDemo && <p className="fu-row__help" style={{ padding: '0 var(--card-pad, 20px) var(--card-pad, 20px)', margin: 0 }}>Only an admin can change these.</p>}
      </div>
      {confirm && (
        <ConfirmModal
          title="Save these changes?"
          message={<ul className="fu-confirm-list">{confirm.lines.map(l => <li key={l}>{l}</li>)}</ul>}
          confirmLabel="Save"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const p = confirm.patch; setConfirm(null); void doSave(p); }}
        />
      )}
    </div>
  );
}
