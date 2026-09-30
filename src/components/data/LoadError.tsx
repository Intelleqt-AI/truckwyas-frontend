import { AlertCircle } from 'lucide-react';
import './load-error.css';

interface LoadErrorProps {
  /** What failed to load, lower case and plural where it reads naturally: "invoices", "this invoice". */
  what: string;
  /** Re-run the request (react-query `refetch`). */
  onRetry: () => void;
  /** The query's error or failureReason; used only to pick the right hint. Never shown raw. */
  error?: unknown;
  /** A request is in flight (react-query `isFetching`): the button shows progress and is disabled. */
  busy?: boolean;
  /** Smaller layout for a tile, side card or table cell. */
  compact?: boolean;
  className?: string;
}

function hintFor(error: unknown, busy: boolean): string {
  const status = (error as { status?: number } | null | undefined)?.status;
  if (status === 403) return "Your role doesn't have access to this.";
  if (status === 404) return 'It may have been deleted or moved.';
  if (status === 429) return 'Too many requests right now. Wait a moment, then retry.';
  if (busy) return 'Trying again automatically.';
  if (status == null) return 'Check your connection, then retry.';
  return 'The server had a problem. Retry, or try again in a few minutes.';
}

/**
 * The one honest failure state for data that didn't arrive. Shown in place of
 * the content (list, board, figures), never alongside an empty state or zero
 * figures that would suggest the data is simply empty. Technical details stay
 * in the console.
 */
export default function LoadError({ what, onRetry, error, busy = false, compact = false, className }: LoadErrorProps) {
  const status = (error as { status?: number } | null | undefined)?.status;
  const canRetry = status !== 403 && status !== 404;
  return (
    <div
      className={`load-error${compact ? ' load-error--compact' : ''}${className ? ` ${className}` : ''}`}
      role="alert"
      aria-live="polite"
      aria-busy={busy || undefined}
    >
      <AlertCircle className="load-error__icon" size={compact ? 16 : 20} aria-hidden="true" />
      <div className="load-error__text">
        <p className="load-error__title">Couldn’t load {what}</p>
        <p className="load-error__hint">{hintFor(error, busy)}</p>
      </div>
      {canRetry && (
        <button type="button" className="tw-btn load-error__retry" onClick={() => onRetry()} disabled={busy}>
          {busy ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  );
}

/** Minimal slice of a react-query result this module reads. */
export interface QueryLike {
  data?: unknown;
  isError: boolean;
  failureCount: number;
}

/**
 * True when there is nothing to show because the request failed: either every
 * retry has given up, or the first attempt already failed and automatic
 * retries are still running. Data from an earlier success wins (the page shows
 * it with a stale notice instead).
 */
export function loadFailed(q: QueryLike): boolean {
  return q.data === undefined && (q.isError || q.failureCount > 0);
}
