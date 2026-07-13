import { useState, useEffect } from "react";
import { fetchData, patchData } from "@/lib/Api";

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
  marginBottom: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: '16px 20px 12px',
  borderBottom: '1px solid var(--border-subtle)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
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
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px',
      borderBottom: '1px solid var(--border-row)',
    }}>
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: description ? 2 : 0 }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
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

const DEFAULTS = {
  email: { quotes: true, invoices: true, payments: true, fleet_alerts: true, weekly_reports: false },
  push: { new_bookings: true, payment_received: true, maintenance_due: true, driver_updates: false },
  sms: { critical_alerts: false, payment_confirmations: false },
};

export function NotificationSettings() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchData('/api/v1/notifications/settings/').then((d: any) => {
      if (d) setSettings({ ...DEFAULTS, ...d });
    }).catch(() => {});
  }, []);

  const setChannel = (channel: keyof typeof settings, key: string, val: boolean) =>
    setSettings(p => ({ ...p, [channel]: { ...p[channel], [key]: val } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await patchData({ url: '/api/v1/notifications/settings/', data: settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
          Notification Settings
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Choose what you get notified about and how
        </div>
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
        </div>
      </div>

      {/* SMS */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>SMS Notifications</span>
        </div>
        <div style={sectionBodyStyle}>
          <ToggleRow label="Critical alerts only" description="System-wide urgent notifications" checked={settings.sms.critical_alerts} onChange={v => setChannel('sms', 'critical_alerts', v)} />
          <ToggleRow label="Payment confirmations" checked={settings.sms.payment_confirmations} onChange={v => setChannel('sms', 'payment_confirmations', v)} />
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
