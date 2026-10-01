import type { StatusTone } from '@/components/ui/StatusChip';
import type { ConnectionStatus, DocumentSyncStatus } from '@/lib/accounting';

/** Chip tone + label for a connection's status. */
export function connectionChip(status: ConnectionStatus): { tone: StatusTone; label: string } {
  switch (status) {
    case 'ACTIVE': return { tone: 'success', label: 'Connected' };
    case 'NEEDS_REAUTH': return { tone: 'danger', label: 'Needs reconnecting' };
    case 'PENDING_ORG': return { tone: 'warning', label: 'Choose organisation' };
    default: return { tone: 'neutral', label: 'Disconnected' };
  }
}

/** Chip tone + label for an invoice's / credit note's sync to the accounting system. */
export function documentSyncChip(status: DocumentSyncStatus | string): { tone: StatusTone; label: string } {
  switch (status) {
    case 'SYNCED': return { tone: 'success', label: 'In sync' };
    case 'PENDING': return { tone: 'info', label: 'Waiting to send' };
    case 'ERROR': return { tone: 'danger', label: 'Failed, will retry' };
    case 'DEAD': return { tone: 'danger', label: 'Failed' };
    case 'BLOCKED': return { tone: 'warning', label: 'Blocked' };
    case 'VOIDED': return { tone: 'neutral', label: 'Voided' };
    default: return { tone: 'neutral', label: String(status || '—') };
  }
}
