// Stale work (R5 rule): an order still Assigned, Loading or In transit past its
// delivery date, or older than 30 days, is not current work. Shared by the
// Orders list and the booking detail so both flag the same loads.
const DAY_MS = 86_400_000;
const STALE_STATUSES = ['ASSIGNED', 'LOADING', 'IN_TRANSIT'];
export function staleSince(l: { status: string; delivery_date?: string; created_at?: string; pickup_date?: string }, now = Date.now()) {
  if (!STALE_STATUSES.includes(l.status)) return null;
  const due = l.delivery_date ? Date.parse(l.delivery_date) : NaN;
  if (!Number.isNaN(due) && due < now) return { iso: l.delivery_date!, days: Math.floor((now - due) / DAY_MS), pastDue: true };
  const start = l.pickup_date || l.created_at;
  const t = start ? Date.parse(start) : NaN;
  if (!Number.isNaN(t) && now - t > 30 * DAY_MS) return { iso: start!, days: Math.floor((now - t) / DAY_MS), pastDue: false };
  return null;
}

