import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import './stale-data-notice.css';

interface StaleDataNoticeProps {
  /** Epoch ms of the last successful load (react-query `dataUpdatedAt`). */
  updatedAt: number;
  /** The most recent refresh failed while older data is still on screen. */
  refreshFailed?: boolean;
  onRetry?: () => void;
  /** Data older than this is treated as stale even without an error. */
  staleAfterMs?: number;
}

const formatTime = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-ZA', {
    timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false,
  });

/**
 * Silent while the figures are current. Appears only when what the user is
 * looking at may be out of date, so it never competes with the data itself.
 */
export default function StaleDataNotice({ updatedAt, refreshFailed = false, onRetry, staleAfterMs = 5 * 60_000 }: StaleDataNoticeProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!updatedAt) return null;
  const stale = now - updatedAt > staleAfterMs;
  if (!refreshFailed && !stale) return null;

  return (
    <div className="stale-data-notice" role="status">
      <AlertTriangle size={16} aria-hidden="true" />
      <span>
        {refreshFailed ? "Couldn't refresh." : 'These figures may be out of date.'}{' '}
        Showing data from {formatTime(updatedAt)}.
      </span>
      {onRetry && (
        <button type="button" className="stale-data-notice__retry" onClick={onRetry}>
          Refresh now
        </button>
      )}
    </div>
  );
}
