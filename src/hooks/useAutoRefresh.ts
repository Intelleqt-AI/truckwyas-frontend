import { useEffect, useRef } from 'react';

/**
 * Production-grade live-data refresh.
 *
 * Re-runs `refetch` on a fixed interval, but ONLY while the tab is visible
 * (so background tabs don't hammer the API), and also immediately on window
 * focus and when the tab becomes visible again. The callback is held in a ref
 * so the interval is never torn down/recreated on every render — pass any
 * function, stable or not.
 *
 * This is the same pattern world-class SaaS dashboards use for "live" data
 * without a websocket: cheap, reliable, and correct under tab switching.
 */
export function useAutoRefresh(refetch: () => void, intervalMs = 30000) {
  const cb = useRef(refetch);
  useEffect(() => { cb.current = refetch; });

  useEffect(() => {
    const run = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        cb.current();
      }
    };
    const timer = setInterval(run, intervalMs);
    const onFocus = () => cb.current();
    // Instant refresh when a real-time event is pushed over the WebSocket.
    const onLiveEvent = () => cb.current();
    window.addEventListener('focus', onFocus);
    window.addEventListener('tw:live-event', onLiveEvent as EventListener);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('tw:live-event', onLiveEvent as EventListener);
      document.removeEventListener('visibilitychange', run);
    };
  }, [intervalMs]);
}
