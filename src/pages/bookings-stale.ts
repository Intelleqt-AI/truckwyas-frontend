// Stale work: one rule for the whole app lives in src/lib/staleWork.ts (R6).
// Kept as a re-export so the Orders list and booking detail import it from
// beside them.
export { staleWork, staleWork as staleSince, staleLabel, staleAction, countStale } from '@/lib/staleWork';
export type { Stale } from '@/lib/staleWork';
