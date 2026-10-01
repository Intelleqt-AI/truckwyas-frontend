import { useEffect, useRef } from 'react';
import { isLiveConnected } from '@/lib/liveData';

/**
 * Fallback refresh for a screen's data, used only while live updates are off.
 *
 * Live updates come over the WebSocket (Django Channels): every save or
 * delete in the company marks the affected caches stale and the screen
 * refetches at once (components/LiveEvents.tsx, lib/liveData.ts). While that
 * socket is connected this hook does nothing. When it isn't (Redis or the
 * socket down, a network blip), it falls back to the old behaviour: re-run
 * `refetch` on an interval while the tab is visible, and on focus or when the
 * tab becomes visible again. A reconnect refreshes everything once, so the
 * gap is caught up either way.
 *
 * The callback is held in a ref so the interval is never torn down/recreated
 * on every render; pass any function, stable or not.
 */
export function useAutoRefresh(refetch: () => void, intervalMs = 30000) {
  const cb = useRef(refetch);
  useEffect(() => { cb.current = refetch; });

  useEffect(() => {
    const run = () => {
      if (isLiveConnected()) return;
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        cb.current();
      }
    };
    const timer = setInterval(run, intervalMs);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', run);
    };
  }, [intervalMs]);
}
