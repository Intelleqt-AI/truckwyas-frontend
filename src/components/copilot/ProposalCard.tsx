import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
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

const OP_TONES: Record<Proposal['operation'], StatusTone> = {
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'danger',
  SEND: 'info',
};

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
  const pending = proposal.status === 'pending';

  return (
    <div className={`copilot-proposal${pending ? ' is-pending' : ''}`}>
      {/* Header: operation chip + label */}
      <div className="copilot-proposal__head">
        <StatusChip tone={OP_TONES[proposal.operation] || 'neutral'} label={OP_LABELS[proposal.operation] || proposal.operation} />
        <span className="copilot-proposal-title">{proposal.label}</span>
      </div>

      {/* Warning banner */}
      {!!proposal.warning && (
        <div className="copilot-proposal__warning">{proposal.warning}</div>
      )}

      {/* AI analysis callout — why the copilot drafted this the way it did */}
      {!!proposal.analysis_summary && (
        <div className="copilot-proposal__analysis">
          <div className="copilot-proposal__label">AI analysis</div>
          {proposal.analysis_summary}
        </div>
      )}

      {/* Fields table */}
      {proposal.fields?.length > 0 && (
        <table className="copilot-proposal__fields">
          <tbody>
            {proposal.fields.map((f, i) => (
              <tr key={i}>
                <th scope="row">{f.label}</th>
                <td>
                  {f.old_value !== undefined && f.old_value !== null ? (
                    <>
                      <span className="copilot-proposal__old">{f.old_value}</span>
                      <span className="copilot-proposal__arrow" aria-label="changes to">→</span>
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
        <div className="copilot-proposal__actions">
          <button type="button" className="tw-btn tw-btn--primary" onClick={onConfirm} disabled={busy}>
            {proposal.confirm_text || 'Confirm'}
          </button>
          <button type="button" className="tw-btn" onClick={onDismiss} disabled={busy}>
            Dismiss
          </button>
        </div>
      ) : (
        <div className="copilot-proposal__status">
          {proposal.status === 'executed' && <StatusChip tone="success" label={proposal.operation === 'SEND' ? 'Sent' : 'Saved'} />}
          {proposal.status === 'dismissed' && <StatusChip tone="neutral" label="Dismissed" />}
          {proposal.status === 'expired' && <StatusChip tone="neutral" label="Expired" />}
          {proposal.status === 'failed' && (
            <>
              <StatusChip tone="danger" label="Failed" />
              {proposal.result?.error && <div className="copilot-proposal__error">{proposal.result.error}</div>}
            </>
          )}
        </div>
      )}
      {/* A dismiss that failed on the server keeps the card pending and says why. */}
      {pending && proposal.result?.error && <div className="copilot-proposal__error" role="alert">{proposal.result.error}</div>}
    </div>
  );
}
