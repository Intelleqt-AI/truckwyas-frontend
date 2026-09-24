import { Check, X } from 'lucide-react';
import './proposal-presentation.css';

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

const OP_LABELS: Record<Proposal['operation'], string> = { CREATE: 'Create', UPDATE: 'Update', DELETE: 'Delete', SEND: 'Send' };

const OP_COLORS: Record<Proposal['operation'], string> = {
  CREATE: 'var(--cpp-success, var(--status-success))',
  UPDATE: 'var(--cpp-warning, var(--status-warning))',
  DELETE: 'var(--cpp-danger, var(--status-danger))',
  SEND: 'var(--accent-primary)',
};

const chipStyle = (color: string): React.CSSProperties => ({
  display: 'var(--cpp-chip-display, inline-block)' as React.CSSProperties['display'], alignItems: 'center', gap: 8, fontFamily: 'var(--cpp-font, var(--font-mono))', fontSize: "var(--cpp-support-size, 11px)",
  color, letterSpacing: 'var(--cpp-tracking, 0.04em)',
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
    <div className="copilot-proposal" style={{
      marginTop: "var(--cpp-space, 10px)", width: '100%', background: 'var(--bg-surface)',
      border: `1px solid ${pending ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
      borderRadius: "var(--cpp-card-radius, 4px)", padding: "var(--cpp-card-inset, 13px)",
    }}>
      {/* Header: operation badge + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: "var(--cpp-space, 10px)" }}>
        <span style={{
          fontFamily: 'var(--cpp-font, var(--font-mono))', fontSize: "var(--cpp-support-size, 10px)", fontWeight: "var(--cpp-label-weight, 700)" as React.CSSProperties['fontWeight'], textTransform: 'var(--cpp-case, uppercase)' as React.CSSProperties['textTransform'],
          letterSpacing: 'var(--cpp-tracking, 0.08em)', color: opColor, border: `1px solid ${opColor}`,
          padding: "var(--cpp-badge-inset, 2px 7px)", borderRadius: "var(--cpp-badge-radius, 8px)",
        }}>{OP_LABELS[proposal.operation] || proposal.operation}</span>
        <span className="copilot-proposal-title" style={{ fontSize: "var(--cpp-section-size, 13px)", lineHeight: 'var(--cpp-section-line, inherit)', fontWeight: 600, color: 'var(--text-primary)' }}>{proposal.label}</span>
      </div>

      {/* Warning banner */}
      {!!proposal.warning && (
        <div style={{
          marginBottom: "var(--cpp-space, 10px)", padding: "var(--cpp-callout-inset, 7px 10px)", fontSize: "var(--cpp-body-size, 12px)", lineHeight: "var(--cpp-line, 1.5)",
          color: "var(--status-warning-text, var(--status-warning))", borderRadius: 4,
          background: 'color-mix(in srgb, var(--status-warning) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--status-warning) 35%, transparent)',
        }}>{proposal.warning}</div>
      )}

      {/* AI analysis callout — why the copilot drafted this the way it did */}
      {!!proposal.analysis_summary && (
        <div style={{
          marginBottom: "var(--cpp-space, 10px)", padding: "var(--cpp-callout-inset, 8px 10px)", fontSize: "var(--cpp-body-size, 12px)", lineHeight: "var(--cpp-line, 1.5)",
          color: 'var(--text-secondary)', borderRadius: 4, background: 'var(--bg-inset, var(--bg-base))',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{
            fontFamily: 'var(--cpp-font, var(--font-mono))', fontSize: "var(--cpp-support-size, 10px)", textTransform: 'var(--cpp-case, uppercase)' as React.CSSProperties['textTransform'],
            letterSpacing: 'var(--cpp-tracking, 0.06em)', color: 'var(--text-tertiary)', marginBottom: 4,
          }}>AI analysis</div>
          {proposal.analysis_summary}
        </div>
      )}

      {/* Fields table */}
      {proposal.fields?.length > 0 && (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: "var(--cpp-space, 11px)" }}>
          <tbody>
            {proposal.fields.map((f, i) => (
              <tr key={i}>
                <td style={{
                  fontFamily: 'var(--cpp-font, var(--font-mono))', fontSize: "var(--cpp-support-size, 11px)", color: 'var(--text-tertiary)',
                  textTransform: 'var(--cpp-case, uppercase)' as React.CSSProperties['textTransform'], letterSpacing: 'var(--cpp-tracking, 0.05em)', whiteSpace: 'var(--cpp-label-wrap, nowrap)' as React.CSSProperties['whiteSpace'],
                  padding: "var(--cpp-label-inset, 4px 14px 4px 0)", verticalAlign: 'top',
                }}>{f.label}</td>
                <td style={{ fontSize: "var(--cpp-body-size, 13px)", color: 'var(--text-primary)', padding: "var(--cpp-value-inset, 4px 0)", lineHeight: "var(--cpp-line, 1.5)", whiteSpace: 'pre-wrap' }}>
                  {f.old_value !== undefined && f.old_value !== null ? (
                    <>
                      <span style={{ textDecoration: 'line-through', color: 'var(--text-tertiary)' }}>{f.old_value}</span>
                      <span style={{ color: 'var(--text-tertiary)', margin: "var(--cpp-change-gap, 0 6px)" }}>→</span>
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
            style={{ background: 'var(--accent-primary)', color: 'var(--cpp-on-accent, var(--bg-deep))', border: 'none', opacity: busy ? 0.6 : 1 }}>
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
            <span style={chipStyle('var(--cpp-success, var(--status-success))')}><Check size={16} aria-hidden="true" />{proposal.operation === 'SEND' ? 'Sent' : 'Saved'}</span>
          )}
          {proposal.status === 'dismissed' && <span style={chipStyle('var(--text-tertiary)')}>Dismissed</span>}
          {proposal.status === 'expired' && <span style={chipStyle('var(--text-tertiary)')}>Expired</span>}
          {proposal.status === 'failed' && (
            <>
              <span style={chipStyle('var(--cpp-danger, var(--status-danger))')}><X size={16} aria-hidden="true" />Failed</span>
              {proposal.result?.error && (
                <div style={{ marginTop: "var(--cpp-error-gap, 5px)", fontSize: "var(--cpp-body-size, 12px)", color: "var(--status-danger-text, var(--status-danger))", lineHeight: "var(--cpp-line, 1.5)" }}>{proposal.result.error}</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
