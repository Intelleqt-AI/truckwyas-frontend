import '@/pages/settings/settings-brand.css';
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { fetchData, patchData } from "@/lib/Api";
import { enablePush, disablePush, pushSupported, PushStatus } from "@/lib/push";
import { useAuth } from "@/lib/AuthContext";
import { SettingsToggleRow, settingsBadgeStyle, settingsCardStyle, settingsCardHeaderStyle, settingsCardTitleStyle, SettingsPageHeader } from "./settingsUi";

const sectionStyle = settingsCardStyle;
const sectionHeaderStyle = settingsCardHeaderStyle;
const sectionTitleStyle = settingsCardTitleStyle;
const sectionBodyStyle: React.CSSProperties = { padding: 0 };
const ToggleRow = SettingsToggleRow;

// Canonical schema — mirrors backend core/services/notification_prefs.py.
const DEFAULTS = {
  email: { quotes: true, invoices: true, payments: true, fleet_alerts: true, weekly_reports: false, fuel_alerts: true, margin_report: true },
  push: { new_bookings: true, payment_received: true, maintenance_due: true, driver_updates: false, quote_reminders: true },
  sms: { critical_alerts: false, payment_confirmations: false },
};

type Settings = typeof DEFAULTS;

/** Per-channel merge so a server response missing keys never renders a
 * toggle as undefined/off. */
function mergeSettings(server: any): Settings {
  const merged: any = {};
  for (const channel of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    merged[channel] = { ...DEFAULTS[channel], ...(server?.[channel] ?? {}) };
  }
  return merged;
}

export function NotificationSettings() {
  const { user: authUser } = useAuth();
  const isDemo = !!authUser?.is_demo;
  const isAdmin = String(authUser?.role || '').toUpperCase() === 'ADMIN';
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);

  const load = () => {
    setLoadFailed(false);
    fetchData('/api/v1/notifications/settings/')
      .then((d: any) => setSettings(mergeSettings(d)))
      .catch(() => {
        setLoadFailed(true);
        toast.error('Could not load your notification settings. Showing defaults, so retry before saving.');
      });
  };

  useEffect(load, []);

  const setChannel = (channel: keyof Settings, key: string, val: boolean) =>
    setSettings(p => ({ ...p, [channel]: { ...p[channel], [key]: val } }));

  const anyPushOn = Object.values(settings.push).some(Boolean);

  const handleSave = async () => {
    if (isDemo) return;
    setSaving(true);
    try {
      const result = await patchData({ url: '/api/v1/notifications/settings/', data: settings });
      setSettings(mergeSettings(result));
      window.dispatchEvent(new CustomEvent('tw:settings-changed'));

      // Browser push subscription follows the push toggles: any ON -> ensure
      // this browser is subscribed (permission prompt rides this click);
      // all OFF -> drop this browser's subscription.
      if (pushSupported()) {
        try {
          if (anyPushOn) {
            const status = await enablePush();
            setPushStatus(status);
            if (status === 'denied') {
              toast.warn('Browser notifications are blocked for this site. Enable them in your browser settings to receive push notifications.');
            }
          } else {
            await disablePush();
            setPushStatus('not-subscribed');
          }
        } catch {
          setPushStatus(null);
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error('Saving notification settings failed. Your changes are not saved. Check your connection and try again.');
    }
    setSaving(false);
  };

  const pushHint =
    !pushSupported() ? 'This browser does not support push notifications.'
    : pushStatus === 'denied' ? 'Notifications are blocked for this site in your browser settings.'
    : pushStatus === 'server-not-configured' ? 'Browser push is not configured on the server yet. In-app toasts still follow these toggles.'
    : pushStatus === 'subscribed' ? 'This browser will receive push notifications, even when the tab is closed.'
    : undefined;

  return (
    // Settings forms cap at 720px so each toggle sits near its label.
    <div style={{ maxWidth: 'var(--form-max, 720px)' }}>
      <SettingsPageHeader title="Notifications" description="Choose what you get notified about and how" />
      <div>
        {loadFailed && (
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: '20px', color: 'var(--status-danger-text)' }}>
            Settings failed to load.{' '}
            <button type="button" className="settings-control" onClick={load} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: '20px', textDecoration: 'underline' }}>
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Email */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Email notifications</h2>
        </div>
        <div style={sectionBodyStyle}>
          <ToggleRow label="Quote activity" description="New quotes, updates, and expirations" checked={settings.email.quotes} onChange={v => setChannel('email', 'quotes', v)} disabled={isDemo} disabledTitle="Fixed in demo mode" />
          <ToggleRow label="Invoice updates" description="When invoices are created or become overdue" checked={settings.email.invoices} onChange={v => setChannel('email', 'invoices', v)} disabled={isDemo} disabledTitle="Fixed in demo mode" />
          <ToggleRow label="Payment received" description="Confirmation when payments clear" checked={settings.email.payments} onChange={v => setChannel('email', 'payments', v)} disabled={isDemo} disabledTitle="Fixed in demo mode" />
          <ToggleRow label="Fleet alerts" description="Maintenance due and vehicle issues" checked={settings.email.fleet_alerts} onChange={v => setChannel('email', 'fleet_alerts', v)} disabled={isDemo} disabledTitle="Fixed in demo mode" />
          <ToggleRow label="Weekly summary" description="Performance digest every Monday" checked={settings.email.weekly_reports} onChange={v => setChannel('email', 'weekly_reports', v)} disabled={isDemo} disabledTitle="Fixed in demo mode" />
          <ToggleRow label="Fuel price alerts" description="When the official fuel price changes and open quotes are affected." checked={settings.email.fuel_alerts} onChange={v => setChannel('email', 'fuel_alerts', v)} disabled={isDemo} disabledTitle="Fixed in demo mode" />
          {isAdmin && <ToggleRow label="Weekly margin email" description="Mondays at 07:00. Admins only." checked={settings.email.margin_report} onChange={v => setChannel('email', 'margin_report', v)} disabled={isDemo} disabledTitle="Fixed in demo mode" />}
        </div>
      </div>

      {/* Push */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Push notifications</h2>
        </div>
        <div style={sectionBodyStyle}>
          <ToggleRow label="New bookings" checked={settings.push.new_bookings} onChange={v => setChannel('push', 'new_bookings', v)} disabled={isDemo} disabledTitle="Fixed in demo mode" />
          <ToggleRow label="Payment received" checked={settings.push.payment_received} onChange={v => setChannel('push', 'payment_received', v)} disabled={isDemo} disabledTitle="Fixed in demo mode" />
          <ToggleRow label="Maintenance due" checked={settings.push.maintenance_due} onChange={v => setChannel('push', 'maintenance_due', v)} disabled={isDemo} disabledTitle="Fixed in demo mode" />
          <ToggleRow label="Driver status updates" checked={settings.push.driver_updates} onChange={v => setChannel('push', 'driver_updates', v)} disabled={isDemo} disabledTitle="Fixed in demo mode" />
          <ToggleRow label="Quote reminders" description="Quotes about to expire, quotes with no answer, fuel price alerts." checked={settings.push.quote_reminders} onChange={v => setChannel('push', 'quote_reminders', v)} disabled={isDemo} disabledTitle="Fixed in demo mode" />
          {pushHint && (
            <div style={{ padding: '12px var(--card-pad, 20px)', borderTop: '1px solid var(--border-row)', fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>{pushHint}</div>
          )}
        </div>
      </div>

      {/* SMS — no provider wired up yet; visible but disabled */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>SMS notifications</h2>
          <span style={settingsBadgeStyle}>Coming soon</span>
        </div>
        <div style={sectionBodyStyle}>
          <ToggleRow label="Critical alerts only" description="System-wide urgent notifications" checked={settings.sms.critical_alerts} onChange={v => setChannel('sms', 'critical_alerts', v)} disabled />
          <ToggleRow label="Payment confirmations" checked={settings.sms.payment_confirmations} onChange={v => setChannel('sms', 'payment_confirmations', v)} disabled />
        </div>
      </div>

      {/* One save pattern across Settings (R9): the sticky save bar, as on
          Company details. It saves every card on this page. */}
      <div className="cs-savebar">
        <span className="cs-savebar__note">{saved ? 'Saved.' : 'Applies to the alerts you receive.'}</span>
        <button
          className="btn-action settings-control"
          onClick={handleSave}
          disabled={saving || isDemo}
          title={isDemo ? 'Fixed in demo mode' : undefined}
          style={{ opacity: (saving || isDemo) ? 0.6 : 1, cursor: isDemo ? 'not-allowed' : undefined }}
        >
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
