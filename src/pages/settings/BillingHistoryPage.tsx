import '@/pages/table-heading-roles.css';
import '@/pages/settings/settings-brand.css';
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fetchData } from "@/lib/Api";

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  marginBottom: 20,
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: '14px 20px',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  lineHeight: '24px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  margin: 0,
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

const formatRand = (amount?: string | number | null) =>
  `R${Number(amount ?? 0).toLocaleString('en-ZA')}`;

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
        <h3 style={sectionTitleStyle}>{title}</h3>
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
        <table className="table-heading-roles" style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <thead>
            <tr>
              {['Charge', 'Reference', 'Date', 'Amount', 'Status'].map(h => (
                <th key={h} style={{
                  padding: '10px 20px', textAlign: 'left' as const,
                  borderBottom: '1px solid var(--border-subtle)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((tx, i) => (
              <tr key={tx.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                <td style={{ padding: '12px 20px', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{tx.label}</td>
                <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                  {tx.reference || '—'}
                </td>
                <td style={{ padding: '12px 20px', fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                  {new Date(tx.created_at).toLocaleDateString('en-ZA')}
                </td>
                <td style={{ padding: '12px 20px', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatRand(tx.amount)}
                </td>
                <td style={{ padding: '12px 20px' }}>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', fontWeight: 500,
                    color: tx.status === 'complete' ? 'var(--accent-primary)' : tx.status === 'pending' ? 'var(--status-warning)' : 'var(--status-danger)',
                  }}>{statusDisplay(tx.status)}</span>
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
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <button className="settings-control" onClick={() => navigate('/settings/billing')} style={{
        background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, lineHeight: '20px',
        fontFamily: 'var(--font-sans)', fontWeight: 500, cursor: 'pointer', padding: '8px 0', minHeight: 44, marginBottom: 8,
      }}>
        ← Back to billing
      </button>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: 4 }}>Billing history</h2>
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
          Every charge to your card on file — the monthly plan and the per-delivery platform fee
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {PERIODS.map(p => (
          <button
            key={p}
            className="settings-control"
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            style={{
              background: period === p ? 'var(--accent-primary)' : 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: period === p ? 'var(--btn-action-color, var(--bg-deep))' : 'var(--text-secondary)',
              padding: '8px 12px',
              borderRadius: 6,
              minHeight: 40,
              fontSize: 14,
              lineHeight: '20px',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              fontWeight: period === p ? 500 : 400,
              transition: 'all 0.2s ease',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={sectionStyle}>
          <div style={{ padding: 20 }}>
            <div style={{ height: 16, background: 'var(--bg-deep)', borderRadius: 4, width: '40%' }} />
          </div>
        </div>
      ) : (
        <>
          <HistoryTable title="Plan purchased" rows={planCharges} />
          <HistoryTable title="Platform fee (0.25% per delivery)" rows={feeCharges} />
        </>
      )}
    </div>
  );
}
