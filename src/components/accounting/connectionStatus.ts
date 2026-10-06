import type { StatusTone } from '@/components/ui/StatusChip';
import { providerBlockers, type ConnectionStatus, type DocumentSyncStatus, type Readiness } from '@/lib/accounting';

/** Chip tone + label for a connection's status. */
export function connectionChip(status: ConnectionStatus, readiness?: Readiness | null, attention = 0, providerShort?: string): { tone: StatusTone; label: string } {
  if (status === 'ACTIVE' && readiness && !readiness.sync_enabled) {
    const ownStepsDone = readiness.mapping_complete && readiness.contacts_to_confirm === 0 && readiness.backfill_state === 'DONE';
    if (ownStepsDone && providerBlockers(readiness).length) return { tone: 'warning', label: 'Action needed' };
    return readiness.backfill_state === 'RUNNING' ? { tone: 'info', label: 'Sending history' } : { tone: 'warning', label: 'Setup needed' };
  }
  if (status === 'ACTIVE' && attention > 0) return { tone: 'warning', label: `${attention} ${attention === 1 ? 'needs' : 'need'} attention` };
  switch (status) {
    case 'ACTIVE': return { tone: 'success', label: 'Connected' };
    case 'NEEDS_REAUTH': return { tone: 'danger', label: 'Sign-in expired' };
    case 'PENDING_ORG': return { tone: 'warning', label: 'Organisation not chosen' };
    default: return { tone: 'neutral', label: 'Disconnected' };
  }
}

/** Chip tone + label for an invoice's / credit note's sync to the accounting system. */
export function documentSyncChip(status: DocumentSyncStatus | string): { tone: StatusTone; label: string } {
  switch (status) {
    case 'SYNCED': return { tone: 'success', label: 'In sync' };
    case 'PENDING': return { tone: 'info', label: 'Waiting to send' };
    case 'ERROR': return { tone: 'warning', label: 'Not up to date' };
    case 'DEAD': return { tone: 'danger', label: 'Failed' };
    case 'BLOCKED': return { tone: 'warning', label: 'Blocked' };
    case 'VOIDED': return { tone: 'neutral', label: 'Voided' };
    default: return { tone: 'neutral', label: String(status || '—') };
  }
}
