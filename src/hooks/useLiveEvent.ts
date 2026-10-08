import { useEffect, useRef } from 'react';
import { createCoalescedRefresh, type CoalescedRefreshOptions } from '@/lib/liveRefresh';

/** The `detail` of a tw:live-event: the WebSocket message (components/LiveEvents.tsx). */
export interface LiveEventDetail {
  event?: string;
  message?: string;
  data?: { id?: unknown; [key: string]: unknown };
}

/**
 * Refresh something when a live push arrives — the one way components listen
 * to `tw:live-event` (and optionally `tw:live-reconnected`).
 *
 * One window listener for the component's lifetime (callbacks live in refs,
 * so a re-render never re-registers it), and every matching event goes
 * through a coalesced refresh (lib/liveRefresh.ts): a burst of events is one
 * refresh, a failing refresh backs off, nothing runs while the tab is hidden.
 *
 * `refresh` may return a promise; a rejection counts as a failure for backoff.
 */
export function useLiveEvent(
  match: (detail: LiveEventDetail | undefined) => boolean,
  refresh: () => unknown,
  options: CoalescedRefreshOptions & { onReconnect?: boolean } = {},
) {
  const matchRef = useRef(match);
  const refreshRef = useRef(refresh);
  useEffect(() => { matchRef.current = match; refreshRef.current = refresh; });

  const { onReconnect = false, ...coalesce } = options;
  const optsRef = useRef(coalesce);

  useEffect(() => {
    const refresher = createCoalescedRefresh(() => refreshRef.current(), optsRef.current);
    const onLive = (e: Event) => {
      let hit = false;
      try { hit = matchRef.current((e as CustomEvent<LiveEventDetail | undefined>).detail); } catch { hit = false; }
      if (hit) refresher.request();
    };
    const onBack = () => refresher.request();
    window.addEventListener('tw:live-event', onLive);
    if (onReconnect) window.addEventListener('tw:live-reconnected', onBack);
    return () => {
      window.removeEventListener('tw:live-event', onLive);
      if (onReconnect) window.removeEventListener('tw:live-reconnected', onBack);
      refresher.dispose();
    };
  }, [onReconnect]);
}

/** Matches a live event whose name starts with `prefix` (e.g. 'quote.'). */
export const eventPrefix = (prefix: string) => (detail: LiveEventDetail | undefined) =>
  typeof detail?.event === 'string' && detail.event.startsWith(prefix);
