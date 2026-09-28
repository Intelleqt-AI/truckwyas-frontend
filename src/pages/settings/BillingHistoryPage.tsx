import '@/pages/table-heading-roles.css';
import '@/pages/settings/settings-brand.css';
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fetchData } from "@/lib/Api";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { SettingsShell } from "./SettingsShell";
import { settingsCardStyle, settingsCardHeaderStyle, settingsCardTitleStyle, settingsSecondaryButtonStyle, SettingsPageHeader } from "./settingsUi";
import { Segmented } from '@/components/ui/Segmented';
import { StatusChip } from '@/components/ui/StatusChip';

const sectionStyle = settingsCardStyle;
const sectionHeaderStyle: React.CSSProperties = { ...settingsCardHeaderStyle, justifyContent: 'space-between' };
const sectionTitleStyle = settingsCardTitleStyle;

const STATUS_COLOR: Record<string, string> = {
  complete: 'var(--status-success-text)',
  pending: 'var(--status-warning-text)',
};

// Presentation-only labels for known status payload values — unknown strings
// render verbatim (own-property lookup).
const STATUS_LABELS: Record<string, string> = {
  complete: 'Complete', pending: 'Pending', failed: 'Failed', refunded: 'Refunded',
};
const statusDisplay = (status: string) =>
  Object.prototype.hasOwnProperty.call(STATUS_LABELS, status) ? STATUS_LABELS[status] : status;

interface BillingTransaction {
  id: string;
  kind: 'subscription' | 'delivery_fee';
  label: string;
  reference?: string;
  created_at: string;
  amount: string | number;
  status: string;
}

// Exact ZAR with cents (brand: two decimals for exact totals).
const formatRand = (amount?: string | number | null) => formatCurrency(Number(amount ?? 0));

const PERIODS = ['All time', 'Today', 'This week', 'This month', 'This year'] as const;
type Period = typeof PERIODS[number];

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function matchesPeriod(isoDate: string, period: Period, now: Date): boolean {
  if (period === 'All time') return true;
  const d = new Date(isoDate);
  if (period === 'Today') return d.toDateString() === now.toDateString();
  if (period === 'This week') return d >= startOfWeek(now);
  if (period === 'This month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (period === 'This year') return d.getFullYear() === now.getFullYear();
  return true;
}

function HistoryTable({ title, rows }: { title: string; rows: BillingTransaction[] }) {
  const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <h2 style={sectionTitleStyle}>{title}</h2>
        <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
          {rows.length} charge{rows.length === 1 ? '' : 's'} · {formatRand(total)} total
        </span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>
          No charges in this period
        </div>
      ) : (
        <div className="settings-scroll-region" role="region" aria-label={title} tabIndex={0} style={{ overflowX: 'auto' }}>
        <table className="table-heading-roles settings-table">
          <thead>
            <tr>
              {['Charge', 'Reference', 'Date', 'Amount', 'Status'].map(h => (
                <th key={h} scope="col" className={h === 'Amount' ? 'num' : undefined} style={{ textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((tx, i) => (
              <tr key={tx.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                <td style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{tx.label}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                  {tx.reference || '—'}
                </td>
                <td style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {formatDate(tx.created_at)}
                </td>
                <td className="num" style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  {formatRand(tx.amount)}
                </td>
                <td>
                  <StatusChip tone={tx.status === 'complete' ? 'success' : tx.status === 'pending' ? 'warning' : tx.status === 'refunded' ? 'neutral' : 'danger'} label={statusDisplay(tx.status)} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

export default function BillingHistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<BillingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('All time');

  useEffect(() => {
    fetchData('api/v1/billing/history/')
      .then((data: any) => setHistory(data.results || data || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    return history.filter(tx => matchesPeriod(tx.created_at, period, now));
  }, [history, period]);

  const planCharges = filtered.filter(tx => tx.kind === 'subscription');
  const feeCharges = filtered.filter(tx => tx.kind === 'delivery_fee');

  return (
    <SettingsShell activeId="billing">
    <div style={{ maxWidth: 960 }}>
      {/* Title block sits at the same y as every other settings section; the
          way back lives beside it instead of pushing the h1 down. */}
      <SettingsPageHeader
        title="Billing history"
        description="Plan and per-delivery fees charged to your card"
        actions={
          <button type="button" className="settings-control" onClick={() => navigate('/settings/billing')} style={{ ...settingsSecondaryButtonStyle, flexShrink: 0 }}>
            Back to billing
          </button>
        }
      />

      <div style={{ marginBottom: 24, maxWidth: '100%', overflowX: 'auto' }}>
        <Segmented label="Period" value={period} onChange={setPeriod} options={PERIODS.map(p => ({ value: p, label: p }))} />
      </div>

      {loading ? (
        <div style={sectionStyle}>
          <div style={{ padding: 24 }}>
            <div style={{ height: 16, background: 'var(--bg-deep)', borderRadius: 'var(--radius-chip)', width: '40%' }} />
          </div>
        </div>
      ) : (
        <>
          <HistoryTable title="Plan purchased" rows={planCharges} />
          <HistoryTable title="Platform fee (0.25% per delivery)" rows={feeCharges} />
        </>
      )}
    </div>
    </SettingsShell>
  );
}
