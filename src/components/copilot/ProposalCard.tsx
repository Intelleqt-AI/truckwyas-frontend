export interface ProposalField {
  label: string;
  value: string;
  old_value?: string; // present only on UPDATE — render old → new diff
}

export interface ProposalResult {
  id?: number;
  number?: string;
  route?: string;
  error?: string;
  [key: string]: any;
}

export interface Proposal {
  id: number;
  table: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'SEND';
  label: string;
  fields: ProposalField[];
  warning?: string;
  analysis_summary?: string | null;
  confirm_text?: string;
  status: 'pending' | 'executed' | 'dismissed' | 'failed' | 'expired';
  result?: ProposalResult | null;
}

const OP_COLORS: Record<Proposal['operation'], string> = {
  CREATE: 'var(--status-success)',
  UPDATE: 'var(--status-warning)',
  DELETE: 'var(--status-danger)',
  SEND: 'var(--accent-primary)',
};

const chipStyle = (color: string): React.CSSProperties => ({
  display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 11,
  color, letterSpacing: '0.04em',
});

interface Props {
  proposal: Proposal;
  onConfirm: () => void;
  onDismiss: () => void;
  busy: boolean;
}

// Rich confirm card for AI-proposed database writes (CREATE / UPDATE / DELETE).
// Pending proposals get Confirm/Dismiss buttons; settled ones render an inert
// status chip so rehydrated history stays readable but not actionable.
export default function ProposalCard({ proposal, onConfirm, onDismiss, busy }: Props) {
  const opColor = OP_COLORS[proposal.operation] || 'var(--text-tertiary)';
  const pending = proposal.status === 'pending';

  return (
    <div style={{
      marginTop: 10, width: '100%', background: 'var(--bg-surface)',
      border: `1px solid ${pending ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
      borderRadius: 4, padding: 13,
    }}>
      {/* Header: operation badge + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: opColor, border: `1px solid ${opColor}`,
          padding: '2px 7px', borderRadius: 8,
        }}>{proposal.operation}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{proposal.label}</span>
      </div>

      {/* Warning banner */}
      {!!proposal.warning && (
        <div style={{
          marginBottom: 10, padding: '7px 10px', fontSize: 12, lineHeight: 1.5,
          color: 'var(--status-warning)', borderRadius: 4,
          background: 'color-mix(in srgb, var(--status-warning) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--status-warning) 35%, transparent)',
        }}>{proposal.warning}</div>
      )}

      {/* AI analysis callout — why the copilot drafted this the way it did */}
      {!!proposal.analysis_summary && (
        <div style={{
          marginBottom: 10, padding: '8px 10px', fontSize: 12, lineHeight: 1.5,
          color: 'var(--text-secondary)', borderRadius: 4, background: 'var(--bg-inset, var(--bg-base))',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 4,
          }}>AI analysis</div>
          {proposal.analysis_summary}
        </div>
      )}

      {/* Fields table */}
      {proposal.fields?.length > 0 && (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 11 }}>
          <tbody>
            {proposal.fields.map((f, i) => (
              <tr key={i}>
                <td style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                  padding: '4px 14px 4px 0', verticalAlign: 'top',
                }}>{f.label}</td>
                <td style={{ fontSize: 13, color: 'var(--text-primary)', padding: '4px 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {f.old_value !== undefined && f.old_value !== null ? (
                    <>
                      <span style={{ textDecoration: 'line-through', color: 'var(--text-tertiary)' }}>{f.old_value}</span>
                      <span style={{ color: 'var(--text-tertiary)', margin: '0 6px' }}>→</span>
                      <span>{f.value}</span>
                    </>
                  ) : f.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Footer: actions when pending, inert status chip otherwise */}
      {pending ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-action" onClick={onConfirm} disabled={busy}
            style={{ background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none', opacity: busy ? 0.6 : 1 }}>
            {proposal.confirm_text || 'Confirm'}
          </button>
          <button className="btn-action" onClick={onDismiss} disabled={busy}
            style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', opacity: busy ? 0.6 : 1 }}>
            Dismiss
          </button>
        </div>
      ) : (
        <div>
          {proposal.status === 'executed' && (
            <span style={chipStyle('var(--status-success)')}>{proposal.operation === 'SEND' ? '✓ Sent' : '✓ Saved'}</span>
          )}
          {proposal.status === 'dismissed' && <span style={chipStyle('var(--text-tertiary)')}>Dismissed</span>}
          {proposal.status === 'expired' && <span style={chipStyle('var(--text-tertiary)')}>Expired</span>}
          {proposal.status === 'failed' && (
            <>
              <span style={chipStyle('var(--status-danger)')}>✕ Failed</span>
              {proposal.result?.error && (
                <div style={{ marginTop: 5, fontSize: 12, color: 'var(--status-danger)', lineHeight: 1.5 }}>{proposal.result.error}</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
