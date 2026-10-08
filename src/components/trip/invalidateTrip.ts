import type { QueryClient } from '@tanstack/react-query';

/** Invalidate everything that shows this job's (or its partner's) figures. */
export function invalidateTrip(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['load-economics'] });
  qc.invalidateQueries({ queryKey: ['load'] });
  qc.invalidateQueries({ queryKey: ['return-candidates'] });
  qc.invalidateQueries({ queryKey: ['loads'] });
  qc.invalidateQueries({ queryKey: ['loads-list'] });
}
