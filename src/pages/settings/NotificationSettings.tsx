import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { fetchData, patchData } from "@/lib/Api";
import { enablePush, disablePush, pushSupported, PushStatus } from "@/lib/push";

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
  marginBottom: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: '16px 20px 12px',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

const sectionBodyStyle: React.CSSProperties = { padding: '4px 0 8px' };

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ label, description, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px',
      borderBottom: '1px solid var(--border-row)',
      opacity: disabled ? 0.5 : 1,
    }}>
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: description ? 2 : 0 }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{description}</div>}
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        style={{
          width: 36, height: 20, borderRadius: 10, border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: checked ? 'var(--accent-primary)' : 'var(--border-active)',
          position: 'relative', flexShrink: 0, transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-surface)',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

// Canonical schema — mirrors backend core/services/notification_prefs.py.
const DEFAULTS = {
  email: { quotes: true, invoices: true, payments: true, fleet_alerts: true, weekly_reports: false },
  push: { new_bookings: true, payment_received: true, maintenance_due: true, driver_updates: false },
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
        toast.error('Could not load your notification settings. Showing defaults — retry before saving.');
      });
  };

  useEffect(load, []);

  const setChannel = (channel: keyof Settings, key: string, val: boolean) =>
    setSettings(p => ({ ...p, [channel]: { ...p[channel], [key]: val } }));

  const anyPushOn = Object.values(settings.push).some(Boolean);

  const handleSave = async () => {
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
              toast.warn('Browser notifications are blocked for this site — enable them in your browser settings to receive push notifications.');
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
      toast.error('Saving notification settings failed — your changes are NOT saved. Check your connection and try again.');
    }
    setSaving(false);
  };

  const pushHint =
    !pushSupported() ? 'This browser does not support push notifications.'
    : pushStatus === 'denied' ? 'Notifications are blocked for this site in your browser settings.'
    : pushStatus === 'server-not-configured' ? 'Browser push is not configured on the server yet — in-app toasts still follow these toggles.'
    : pushStatus === 'subscribed' ? 'This browser will receive push notifications, even when the tab is closed.'
    : undefined;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
          Notification Settings
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Choose what you get notified about and how
        </div>
        {loadFailed && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--status-danger)' }}>
            Settings failed to load.{' '}
            <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, fontSize: 12, textDecoration: 'underline' }}>
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Email */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Email Notifications</span>
        </div>
        <div style={sectionBodyStyle}>
          <ToggleRow label="Quote activity" description="New quotes, updates, and expirations" checked={settings.email.quotes} onChange={v => setChannel('email', 'quotes', v)} />
          <ToggleRow label="Invoice updates" description="When invoices are created or become overdue" checked={settings.email.invoices} onChange={v => setChannel('email', 'invoices', v)} />
          <ToggleRow label="Payment received" description="Confirmation when payments clear" checked={settings.email.payments} onChange={v => setChannel('email', 'payments', v)} />
          <ToggleRow label="Fleet alerts" description="Maintenance due and vehicle issues" checked={settings.email.fleet_alerts} onChange={v => setChannel('email', 'fleet_alerts', v)} />
          <ToggleRow label="Weekly summary" description="Performance digest every Monday" checked={settings.email.weekly_reports} onChange={v => setChannel('email', 'weekly_reports', v)} />
        </div>
      </div>

      {/* Push */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Push Notifications</span>
        </div>
        <div style={sectionBodyStyle}>
          <ToggleRow label="New bookings" checked={settings.push.new_bookings} onChange={v => setChannel('push', 'new_bookings', v)} />
          <ToggleRow label="Payment received" checked={settings.push.payment_received} onChange={v => setChannel('push', 'payment_received', v)} />
          <ToggleRow label="Maintenance due" checked={settings.push.maintenance_due} onChange={v => setChannel('push', 'maintenance_due', v)} />
          <ToggleRow label="Driver status updates" checked={settings.push.driver_updates} onChange={v => setChannel('push', 'driver_updates', v)} />
          {pushHint && (
            <div style={{ padding: '10px 20px', fontSize: 11, color: 'var(--text-tertiary)' }}>{pushHint}</div>
          )}
        </div>
      </div>

      {/* SMS — no provider wired up yet; visible but disabled */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>SMS Notifications</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase' as const,
            letterSpacing: '0.08em', color: 'var(--text-tertiary)',
            border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '2px 6px',
          }}>Coming soon</span>
        </div>
        <div style={sectionBodyStyle}>
          <ToggleRow label="Critical alerts only" description="System-wide urgent notifications" checked={settings.sms.critical_alerts} onChange={v => setChannel('sms', 'critical_alerts', v)} disabled />
          <ToggleRow label="Payment confirmations" checked={settings.sms.payment_confirmations} onChange={v => setChannel('sms', 'payment_confirmations', v)} disabled />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-action" onClick={handleSave} disabled={saving} style={{ opacity: saving ? 0.6 : 1 }}>
          {saved ? 'SAVED' : saving ? 'SAVING...' : 'SAVE CHANGES'}
        </button>
      </div>
    </div>
  );
}
