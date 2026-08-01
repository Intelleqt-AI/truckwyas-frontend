import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fetchData } from "@/lib/Api";

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
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
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

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
        <span style={sectionTitleStyle}>{title}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
          {rows.length} charge{rows.length === 1 ? '' : 's'} · {formatRand(total)} total
        </span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
          No charges in this period
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <thead>
            <tr>
              {['Charge', 'Reference', 'Date', 'Amount', 'Status'].map(h => (
                <th key={h} style={{
                  padding: '10px 20px', textAlign: 'left' as const,
                  fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                  borderBottom: '1px solid var(--border-subtle)', fontWeight: 600,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((tx, i) => (
              <tr key={tx.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-primary)' }}>{tx.label}</td>
                <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {tx.reference || '—'}
                </td>
                <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {new Date(tx.created_at).toLocaleDateString('en-ZA')}
                </td>
                <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                  {formatRand(tx.amount)}
                </td>
                <td style={{ padding: '12px 20px' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: tx.status === 'complete' ? 'var(--accent-primary)' : tx.status === 'pending' ? 'var(--status-warning)' : 'var(--status-danger)',
                    textTransform: 'uppercase' as const,
                  }}>{tx.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <button onClick={() => navigate('/settings/billing')} style={{
        background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 11,
        fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', cursor: 'pointer', padding: 0, marginBottom: 16,
      }}>
        ← BACK TO BILLING
      </button>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Billing History</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Every charge to your card on file — the monthly plan and the per-delivery platform fee
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {PERIODS.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              background: period === p ? 'var(--accent-primary)' : 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: period === p ? 'var(--bg-deep)' : 'var(--text-secondary)',
              padding: '6px 12px',
              borderRadius: 2,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              letterSpacing: '0.06em',
              fontWeight: period === p ? 500 : 400,
              transition: 'all 0.2s ease',
            }}
          >
            {p.toUpperCase()}
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
