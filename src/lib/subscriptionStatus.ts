// Maps Company.subscription_status (core/models/company.py) to what the UI
// shows — the top-bar status word/color/popover text, and whether quoting/
// invoicing are actually blocked (mirrors PlanLimitsMiddleware's own check:
// only 'suspended' and 'cancelled' block anything).

export function isSubscriptionBlocked(status?: string | null): boolean {
  return status === 'suspended' || status === 'cancelled';
}

export function subscriptionStatusLabel(status?: string | null): string {
  switch (status) {
    case 'trialing': return 'TRIAL';
    case 'grace_period': return 'OVERDUE';
    case 'suspended': return 'SUSPENDED';
    case 'cancelled': return 'CANCELLED';
    default: return 'ONLINE'; // 'active', 'none', or not yet loaded
  }
}

export function subscriptionStatusColor(status?: string | null): string {
  switch (status) {
    case 'grace_period': return 'var(--status-warning)';
    case 'suspended':
    case 'cancelled':
      return 'var(--status-danger)';
    default: return 'var(--status-success)';
  }
}

export function subscriptionStatusDetail(status?: string | null): string {
  switch (status) {
    case 'trialing':
      return "You're on a trial. Subscribe from Billing before it ends to keep quoting and invoicing without interruption.";
    case 'grace_period':
      return 'Your most recent payment attempt failed. You still have full access for now — update your billing details soon to avoid being suspended.';
    case 'suspended':
      return 'Your subscription payment failed and the grace period has expired. Quoting and invoicing are blocked until you update your billing details.';
    case 'cancelled':
      return 'Your subscription has been cancelled. Quoting and invoicing are blocked until you resubscribe.';
    default:
      return 'Your account is active and in good standing.';
  }
}
