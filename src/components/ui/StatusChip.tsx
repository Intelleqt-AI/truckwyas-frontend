import type { HTMLAttributes } from 'react';

/**
 * v3 status chip (DESIGN-PRINCIPLES §4). One chip for the whole product:
 * a neutral outline chip with a 6px coloured dot and a secondary-text label.
 * The colour lives only in the dot, so a table of statuses stays calm and the
 * same word ("Sent") always reads the same on every page.
 *
 *   <StatusChip tone="success" label="Paid" />
 *   <StatusChip status={invoice.status} />          // tone + label from the map
 *   <StatusChip status="IN_TRANSIT" label="On the road" />
 *
 * Styles: `.tw-status` in src/styles/theme.css (global, so it also renders
 * correctly inside portals and on public pages).
 */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type Entry = { tone: StatusTone; label: string };

/**
 * One meaning per word, product-wide. Keys are normalised: upper-case with
 * spaces and hyphens turned into underscores ("In transit" -> IN_TRANSIT).
 *
 *  - neutral: nothing has happened yet, or it is closed with no judgement
 *  - info:    it is moving (sent, in transit, viewed)
 *  - success: it is done and good (paid, delivered, active, approved)
 *  - warning: it needs attention soon (partially paid, maintenance, expiring)
 *  - danger:  it is wrong or late (overdue, rejected, failed, suspended)
 */
const STATUS_MAP: Record<string, Entry> = {
  // Documents: quotes and invoices
  DRAFT: { tone: 'neutral', label: 'Draft' },
  PENDING: { tone: 'neutral', label: 'Pending' },
  SENT: { tone: 'info', label: 'Sent' },
  VIEWED: { tone: 'info', label: 'Viewed' },
  OPENED: { tone: 'info', label: 'Viewed' },
  QUOTED: { tone: 'info', label: 'Quoted' },
  PARTIALLY_PAID: { tone: 'warning', label: 'Partially paid' },
  PART_PAID: { tone: 'warning', label: 'Partially paid' },
  PAID: { tone: 'success', label: 'Paid' },
  OVERDUE: { tone: 'danger', label: 'Overdue' },
  ACCEPTED: { tone: 'success', label: 'Accepted' },
  APPROVED: { tone: 'success', label: 'Approved' },
  WON: { tone: 'success', label: 'Won' },
  CONVERTED: { tone: 'success', label: 'Converted' },
  DECLINED: { tone: 'danger', label: 'Declined' },
  REJECTED: { tone: 'danger', label: 'Rejected' },
  LOST: { tone: 'danger', label: 'Lost' },
  EXPIRED: { tone: 'neutral', label: 'Expired' },
  CANCELLED: { tone: 'neutral', label: 'Cancelled' },
  CANCELED: { tone: 'neutral', label: 'Cancelled' },
  VOID: { tone: 'neutral', label: 'Void' },
  REFUNDED: { tone: 'neutral', label: 'Refunded' },
  // Loads and bookings
  BOOKED: { tone: 'neutral', label: 'Booked' },
  CONFIRMED: { tone: 'neutral', label: 'Confirmed' },
  ASSIGNED: { tone: 'neutral', label: 'Assigned' },
  SCHEDULED: { tone: 'neutral', label: 'Scheduled' },
  LOADING: { tone: 'info', label: 'Loading' },
  PICKED_UP: { tone: 'info', label: 'Picked up' },
  IN_TRANSIT: { tone: 'info', label: 'In transit' },
  IT: { tone: 'info', label: 'In transit' },
  ON_ROUTE: { tone: 'info', label: 'In transit' },
  EN_ROUTE: { tone: 'info', label: 'In transit' },
  DELIVERED: { tone: 'success', label: 'Delivered' },
  COMPLETED: { tone: 'success', label: 'Completed' },
  COMPLETE: { tone: 'success', label: 'Completed' },
  INVOICED: { tone: 'success', label: 'Invoiced' },
  DELAYED: { tone: 'warning', label: 'Delayed' },
  FAILED: { tone: 'danger', label: 'Failed' },
  // Fleet, people and accounts
  ACTIVE: { tone: 'success', label: 'Active' },
  AVAILABLE: { tone: 'success', label: 'Available' },
  ON_JOB: { tone: 'info', label: 'On a job' },
  IN_USE: { tone: 'info', label: 'In use' },
  BUSY: { tone: 'info', label: 'On a job' },
  MAINTENANCE: { tone: 'warning', label: 'Maintenance' },
  IN_MAINTENANCE: { tone: 'warning', label: 'Maintenance' },
  SERVICE_DUE: { tone: 'warning', label: 'Service due' },
  EXPIRING: { tone: 'warning', label: 'Expiring' },
  INACTIVE: { tone: 'neutral', label: 'Inactive' },
  ON_LEAVE: { tone: 'warning', label: 'On leave' },
  OFF_DUTY: { tone: 'neutral', label: 'Off duty' },
  INVITED: { tone: 'neutral', label: 'Invited' },
  SUSPENDED: { tone: 'danger', label: 'Suspended' },
  LOCKED: { tone: 'danger', label: 'Locked' },
  BLOCKED: { tone: 'danger', label: 'Blocked' },
  OUT_OF_SERVICE: { tone: 'danger', label: 'Out of service' },
  // Integrations and jobs
  CONNECTED: { tone: 'success', label: 'Connected' },
  DISCONNECTED: { tone: 'neutral', label: 'Not connected' },
  SYNCED: { tone: 'success', label: 'Synced' },
  ERROR: { tone: 'danger', label: 'Error' },
};

const normalise = (s: string) => s.trim().toUpperCase().replace(/[\s-]+/g, '_');

/** Sentence-case fallback label for an unknown status: "ON_HOLD" -> "On hold". */
function humanise(s: string): string {
  const t = s.trim().replace(/[_-]+/g, ' ').toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

/** Tone and label for a status string. Unknown statuses are neutral. */
export function statusMeta(status: string | null | undefined): Entry {
  if (!status) return { tone: 'neutral', label: '—' };
  return STATUS_MAP[normalise(String(status))] ?? { tone: 'neutral', label: humanise(String(status)) };
}

/** Just the tone, for places that colour something other than a chip (a dot, a bar). */
export function statusTone(status: string | null | undefined): StatusTone {
  return statusMeta(status).tone;
}

export interface StatusChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Explicit tone. When omitted, it comes from `status` through the shared map. */
  tone?: StatusTone;
  /** Visible text. When omitted, it comes from `status` through the shared map. */
  label?: string;
  /** A raw API status ("SENT", "in_transit", "Partially paid"). */
  status?: string | null;
  /** 20px chip for dense tables (default 22px). */
  size?: 'sm' | 'md';
}

export function StatusChip({ tone, label, status, size = 'md', className, ...rest }: StatusChipProps) {
  const meta = statusMeta(status);
  const t = tone ?? meta.tone;
  const text = label ?? meta.label;
  const cls = ['tw-status', `tw-status--${t}`, size === 'sm' ? 'tw-status--sm' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} data-tone={t} {...rest}>
      <span className="tw-status__dot" aria-hidden="true" />
      <span className="tw-status__label">{text}</span>
    </span>
  );
}

export default StatusChip;
