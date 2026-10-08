import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { fetchData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { useAuth } from '@/lib/AuthContext';
import { formatMoney } from '@/lib/formatters';
import { longDate, randPerLitre } from '@/lib/dieselPrice';
import {
  alertPriceLine, apiMessage, floorChange, fuelAlertParam, marginChange, promptExample, sortAlertQuotes, statusWord,
  type PricingSetupItem,
} from '@/lib/followups';
import {
  useFuelAlert, useIsAdmin, usePricingSetup, usePricingSetupAction, useQuoteAutomation, useSaveAutomation,
} from './useFollowUps';
import './followups.css';

/** Where each pricing basic is changed (the existing company settings fields). */
const SETUP_FIELD_LINK: Record<string, string> = {
  target_margin: '/settings/company#pricing',
  operating_cost: '/settings/company#pricing',
  driver_allowance: '/settings/company#pricing',
  fuel_mode: '/settings/company#fuel',
};

/** §1 one-time prompt for existing companies (admins only). */
export function FuelClausePrompt() {
  const isAdmin = useIsAdmin();
  const { user } = useAuth();
  const q = useQuoteAutomation(isAdmin);
  const save = useSaveAutomation();
  const [busy, setBusy] = useState(false);
  const pending = isAdmin && !user?.is_demo && !!q.data?.fuel_surcharge_prompt_pending;
  const { data: live } = useQuery({
    queryKey: ['fuel-price-current'],
    queryFn: () => fetchData('api/v1/fuel-prices/current/').catch(() => null),
    staleTime: 10 * 60 * 1000,
    enabled: pending,
  });
  if (!pending) return null;
  const price = Number(live?.zone_price ?? live?.inland_price);
  const zone = String(live?.zone || 'INLAND').toUpperCase() === 'COASTAL' ? 'coastal' : 'inland';
  const when = longDate(live?.effective_from ?? null);
  const reference = Number.isFinite(price) && price > 0
    ? `Priced on diesel at ${randPerLitre(price)}/L (official ${zone}${when ? `, ${when}` : ''}). `
    : '';
  const decide = async (on: boolean) => {
    setBusy(true);
    try {
      await save({ fuel_surcharge_enabled: on });
      toast.success(on ? 'Fuel price clause turned on' : 'Saved. You can turn it on in Settings.');
    } catch (e) {
      toast.error(apiMessage(e, 'Saving failed. Please try again.'));
    }
    setBusy(false);
  };
  return (
    <section className="fu-notice" aria-labelledby="fu-clause-prompt">
      <h2 className="fu-notice__title" id="fu-clause-prompt">Add a fuel price clause to your quotes?</h2>
      <p className="fu-notice__text">Quotes would say: "{reference}{promptExample(q.data?.fuel_surcharge_threshold_pct)}"</p>
      <div className="fu-notice__actions">
        <button type="button" className="bk-btn bk-btn--primary" disabled={busy} onClick={() => decide(true)}>Turn on</button>
        <button type="button" className="bk-btn bk-btn--secondary" disabled={busy} onClick={() => decide(false)}>Not now</button>
      </div>
    </section>
  );
}

/** §6 "Check your pricing basics", for admins while setup is needed. */
export function PricingSetupNotice({ variant = 'card' }: { variant?: 'card' | 'step' }) {
  const isAdmin = useIsAdmin();
  const { user } = useAuth();
  const navigate = useNavigate();
  const q = usePricingSetup(isAdmin);
  const act = usePricingSetupAction();
  const [busy, setBusy] = useState(false);
  if (!isAdmin || user?.is_demo || !q.data?.needs_setup) return null;
  const rows: PricingSetupItem[] = q.data.items.filter(i => !i.set);
  if (!rows.length) return null;
  const run = async (body: Parameters<typeof act>[0], done: string) => {
    setBusy(true);
    try { await act(body); toast.success(done); } catch (e) { toast.error(apiMessage(e, 'Saving failed. Please try again.')); }
    setBusy(false);
  };
  return (
    <section className="fu-notice" aria-labelledby="fu-setup-title">
      <div className="fu-notice__head">
        <h2 className="fu-notice__title" id="fu-setup-title">Check your pricing basics <small>(2 minutes)</small></h2>
        {variant === 'card' && (
          <button type="button" className="fu-close" aria-label="Later" title="Later" disabled={busy}
            onClick={() => run({ action: 'dismiss' }, 'Hidden. Settings still shows what is not set.')}>
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <ul className="fu-setup">
        {rows.map(r => (
          <li key={r.key} className="fu-setup__row">
            <div>
              <div className="fu-setup__label">{r.label}</div>
              <div className="fu-setup__value">{r.display}</div>
            </div>
            <button type="button" className="bk-btn bk-btn--secondary bk-btn--sm"
              onClick={() => navigate(SETUP_FIELD_LINK[r.key] || '/settings/company#pricing')}>Change</button>
            <div className="fu-setup__default">{r.default_text}</div>
          </li>
        ))}
      </ul>
      <div className="fu-notice__actions">
        <button type="button" className="bk-btn bk-btn--primary" disabled={busy}
          onClick={() => run({ action: 'confirm', keys: q.data!.unset }, 'Pricing basics confirmed')}>These look right</button>
        <button type="button" className="bk-btn bk-btn--secondary" disabled={busy}
          onClick={() => run({ action: 'dismiss' }, 'Hidden. Settings still shows what is not set.')}>Later</button>
      </div>
    </section>
  );
}

/** §3 web: /bookings/quotes?fuel_alert={id} opens this panel above the list. */
export function FuelAlertPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const alertId = fuelAlertParam(location.search);
  const q = useFuelAlert(alertId);
  if (alertId == null) return null;
  const close = () => {
    const p = new URLSearchParams(location.search);
    p.delete('fuel_alert');
    const s = p.toString();
    navigate({ pathname: location.pathname, search: s ? `?${s}` : '' }, { replace: true });
  };
  const head = (body: React.ReactNode) => (
    <section className="fu-notice fu-notice--scroll" aria-labelledby="fu-alert-title" aria-busy={q.isLoading || undefined}>
      <div className="fu-notice__head">
        <div style={{ minWidth: 0 }}>{body}</div>
        <button type="button" className="fu-close" aria-label="Close" title="Close" onClick={close}><X size={16} aria-hidden="true" /></button>
      </div>
      {q.data?.quotes && q.data.quotes.length > 0 && (
        <table className="fu-alert__table">
          <thead>
            <tr><th>Quote</th><th>Customer</th><th className="num">Price excl. VAT</th><th className="num">Cost floor excl. VAT</th><th className="num">Margin</th><th><span className="sr-only">Target</span></th></tr>
          </thead>
          <tbody>
            {sortAlertQuotes(q.data.quotes).map(r => (
              <tr key={r.quote_id} className={r.still_open ? undefined : 'is-closed'}>
                <td>
                  <a href={r.link} onClick={e => { e.preventDefault(); navigate(r.link); }}>{r.quote_number}</a>
                  {!r.still_open && <span> · {statusWord(r.status_now)}</span>}
                </td>
                <td>{r.customer || '—'}</td>
                <td className="num" data-label="Price excl. VAT">{formatMoney(r.price, 0)}</td>
                <td className="num" data-label="Cost floor excl. VAT">{floorChange(r)}</td>
                <td className="num" data-label="Margin">{marginChange(r)}</td>
                <td>{r.under_target && r.still_open && <span className="fu-tag">Under target</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
  if (q.isLoading) return head(<p className="fu-notice__text" id="fu-alert-title" style={{ margin: 0 }}>Loading the fuel price alert…</p>);
  if (q.isError || !q.data) return head(<p className="fu-notice__text" id="fu-alert-title" style={{ margin: 0 }}>{apiMessage(q.error, 'This fuel price alert could not be loaded.')}</p>);
  return head(
    <>
      <h2 className="fu-notice__title" id="fu-alert-title">{q.data.message}</h2>
      <p className="fu-notice__text">{alertPriceLine(q.data)}</p>
    </>,
  );
}

/** Everything the quotes list shows above the board / list. */
export function QuoteListNotices() {
  // One question at a time: the pricing basics wait until the fuel clause
  // question is answered, so the board is never pushed far down.
  const isAdmin = useIsAdmin();
  const auto = useQuoteAutomation(isAdmin);
  const promptPending = isAdmin && (auto.isLoading || !!auto.data?.fuel_surcharge_prompt_pending);
  return (
    <>
      <FuelAlertPanel />
      <FuelClausePrompt />
      {!promptPending && <PricingSetupNotice />}
    </>
  );
}

/** §6 "Not set yet" chip beside a pricing basic in Settings, from items[].set. */
export function NotSetChip({ item }: { item: 'target_margin' | 'operating_cost' | 'driver_allowance' | 'fuel_mode' }) {
  const isAdmin = useIsAdmin();
  const q = usePricingSetup(isAdmin);
  const row = q.data?.items.find(i => i.key === item);
  if (!row || row.set) return null;
  return <span className="fu-chip" title={row.default_text}>Not set yet</span>;
}
