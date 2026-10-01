import { useEffect, useMemo, useState } from 'react';
import { Circle } from 'lucide-react';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { DatePicker } from '@/components/ui/date-picker';
import { serverMessage, useSubmitApplication, useUpdateApplication } from '@/lib/capital/api';
import type { Application, ApplicationPatch, ApplicationStatus } from '@/lib/capital/types';
import { toast } from '@/lib/toast';
import { day, money } from './capitalUi';

const STATUS: Record<ApplicationStatus, { tone: StatusTone; label: string }> = {
  NOT_STARTED: { tone: 'neutral', label: 'Not started' },
  SUBMITTED: { tone: 'info', label: 'With the provider' },
  APPROVED: { tone: 'success', label: 'Approved' },
  REJECTED: { tone: 'danger', label: 'Not approved' },
};

export function ApplicationStatusChip({ status }: { status: ApplicationStatus }) {
  const m = STATUS[status] ?? { tone: 'neutral' as StatusTone, label: status };
  return <StatusChip tone={m.tone} label={m.label} size="sm" />;
}

/**
 * The Fast Pay application: what is still needed, the company facts the
 * provider asks for, and the consents with their full text. Approved
 * applications collapse to a short summary.
 */
export function ApplicationCard({ app, provider, demo }: { app: Application; provider: string; demo: boolean }) {
  const update = useUpdateApplication();
  const submit = useSubmitApplication();
  const editable = app.status === 'NOT_STARTED' || app.status === 'REJECTED';

  const [form, setForm] = useState({
    juristic_person: !!app.juristic_person,
    turnover: app.declared_annual_turnover != null ? String(app.declared_annual_turnover) : '',
    insurer: app.git_insurer ?? '',
    expiry: app.git_insurance_expiry ?? '',
  });
  useEffect(() => {
    setForm({
      juristic_person: !!app.juristic_person,
      turnover: app.declared_annual_turnover != null ? String(app.declared_annual_turnover) : '',
      insurer: app.git_insurer ?? '',
      expiry: app.git_insurance_expiry ?? '',
    });
  }, [app.juristic_person, app.declared_annual_turnover, app.git_insurer, app.git_insurance_expiry]);

  const granted = useMemo(() => new Set(app.consents.map((c) => c.purpose)), [app.consents]);
  const [consents, setConsents] = useState<Set<string>>(() => new Set(granted));
  useEffect(() => { setConsents(new Set(granted)); }, [granted]);
  const [error, setError] = useState('');

  const patch: ApplicationPatch = {};
  if (form.juristic_person !== !!app.juristic_person) patch.juristic_person = form.juristic_person;
  const turnoverNum = form.turnover.trim() === '' ? null : Number(form.turnover.replace(/[\s,]/g, ''));
  if (turnoverNum !== app.declared_annual_turnover && !(turnoverNum != null && Number.isNaN(turnoverNum))) patch.declared_annual_turnover = turnoverNum;
  if ((form.insurer.trim() || null) !== (app.git_insurer || null)) patch.git_insurer = form.insurer.trim() || null;
  if ((form.expiry || null) !== (app.git_insurance_expiry || null)) patch.git_insurance_expiry = form.expiry || null;
  const dirty = Object.keys(patch).length > 0;
  const allConsents = app.required_consents.every((c) => consents.has(c.purpose));

  const save = async () => {
    setError('');
    try {
      await update.mutateAsync(patch);
      toast.success('Application details saved');
    } catch (e) {
      setError(serverMessage(e, 'The details could not be saved. Try again.'));
    }
  };

  const send = async () => {
    setError('');
    try {
      if (dirty) await update.mutateAsync(patch);
      await submit.mutateAsync({ consents: app.required_consents.map((c) => c.purpose).filter((p) => consents.has(p)) });
      toast.success(`Application sent to ${provider}`);
    } catch (e) {
      setError(serverMessage(e, 'The application could not be sent. Try again.'));
    }
  };

  const busy = update.isPending || submit.isPending;

  if (app.status === 'APPROVED' || app.status === 'SUBMITTED') {
    return (
      <section className="card" aria-labelledby="fp-app-title">
        <div className="fin-panel-head" style={{ marginBottom: 4 }}>
          <div className="fin-panel-head__text">
            <h2 id="fp-app-title" className="fin-panel-title">Application</h2>
          </div>
          <ApplicationStatusChip status={app.status} />
        </div>
        <dl className="fin-dl">
          <div className="fin-dl__row"><dt>Submitted</dt><dd>{day(app.submitted_at)}</dd></div>
          <div className="fin-dl__row"><dt>Declared turnover</dt><dd>{app.declared_annual_turnover != null ? money(app.declared_annual_turnover) : '—'}</dd></div>
          <div className="fin-dl__row"><dt>Goods-in-transit cover</dt><dd>{app.git_insurer || '—'}{app.git_insurance_expiry ? `, to ${day(app.git_insurance_expiry)}` : ''}</dd></div>
        </dl>
        {app.status === 'SUBMITTED' && (
          <p className="fin-note" style={{ marginTop: 12 }}>{provider.charAt(0).toUpperCase() + provider.slice(1)} is reviewing your application.</p>
        )}
        {app.missing.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className="fin-note"><strong>Still needed</strong></p>
            <ul className="cap-checklist" style={{ marginTop: 8 }}>
              {app.missing.map((m) => <li key={m}><Circle size={14} aria-hidden="true" />{m}</li>)}
            </ul>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="fp-app-title">
      <div className="fin-panel-head">
        <div className="fin-panel-head__text">
          <h2 id="fp-app-title" className="fin-panel-title">Apply for Fast Pay</h2>
          <p className="fin-panel-desc">Reviewed by {provider}</p>
        </div>
        <ApplicationStatusChip status={app.status} />
      </div>

      <div className="fin-form">
        {app.missing.length > 0 && (
          <div>
            <p className="fin-label">Still needed</p>
            <ul className="cap-checklist">
              {app.missing.map((m) => <li key={m}><Circle size={14} aria-hidden="true" />{m}</li>)}
            </ul>
          </div>
        )}

        <label className="cap-check">
          <input type="checkbox" checked={form.juristic_person} disabled={!editable || busy}
            onChange={(e) => setForm((f) => ({ ...f, juristic_person: e.target.checked }))} />
          We are a registered company or close corporation
        </label>

        <div className="fin-form__row">
          <div>
            <label className="fin-label" htmlFor="fp-turnover">Annual turnover (R)</label>
            <input id="fp-turnover" className="fin-control" inputMode="decimal" value={form.turnover} disabled={!editable || busy}
              onChange={(e) => setForm((f) => ({ ...f, turnover: e.target.value }))} placeholder="e.g. 4 500 000" />
          </div>
          <div>
            <label className="fin-label" htmlFor="fp-insurer">Goods-in-transit insurer</label>
            <input id="fp-insurer" className="fin-control" value={form.insurer} disabled={!editable || busy}
              onChange={(e) => setForm((f) => ({ ...f, insurer: e.target.value }))} />
          </div>
        </div>
        <div className="fin-form__row">
          <div className="fin-date-field">
            <label className="fin-label" htmlFor="fp-git-expiry">Cover expires</label>
            <DatePicker id="fp-git-expiry" value={form.expiry} onChange={(v) => setForm((f) => ({ ...f, expiry: v }))} />
          </div>
          <div />
        </div>

        {app.required_consents.length > 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            <p className="fin-label" style={{ margin: 0 }}>Consents</p>
            {app.required_consents.map((c) => {
              const given = app.consents.find((g) => g.purpose === c.purpose);
              return (
                <div key={c.purpose} className="cap-consent">
                  <p className="cap-consent__title">{c.title}</p>
                  <p className="cap-consent__text">{c.text}</p>
                  <label className="cap-check">
                    <input type="checkbox" checked={consents.has(c.purpose)} disabled={!editable || busy}
                      onChange={(e) => setConsents((s) => {
                        const n = new Set(s);
                        if (e.target.checked) n.add(c.purpose); else n.delete(c.purpose);
                        return n;
                      })} />
                    {given ? `Agreed on ${day(given.granted_at)}` : 'I agree'}
                  </label>
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="fin-help fin-text-danger" role="alert" style={{ margin: 0 }}>{error}</p>}

        <div className="cap-form-foot">
          <button type="button" className="tw-btn" onClick={save} disabled={!editable || !dirty || busy}>
            {update.isPending && !submit.isPending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="tw-btn tw-btn--primary" onClick={send}
            disabled={!editable || busy || !allConsents || demo}
            title={demo ? 'No money moves in the demo' : !allConsents ? 'Agree to each consent first' : undefined}>
            {submit.isPending ? 'Sending…' : 'Send application'}
          </button>
        </div>
      </div>
    </section>
  );
}

export default ApplicationCard;
