import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { fetchData } from '@/lib/Api';
import { invalidateAllTopics, invalidateTopics, setLiveConnected } from '@/lib/liveData';

/**
 * Global real-time event client. Mounted once (in OSLayout) for authenticated
 * sessions. Opens a WebSocket to the backend, shows a toast for each pushed
 * event, and dispatches a `tw:live-event` window event so every live screen
 * (via useAutoRefresh) refetches instantly — sub-second, no polling delay.
 *
 * Auto-reconnects with capped backoff. Silently does nothing if there's no
 * token or the socket can't be reached.
 */
function wsUrl(): string | null {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access') : null;
  if (!token) return null;
  const api = (import.meta as any).env?.VITE_API_URL || `${location.protocol}//${location.hostname}:8000/`;
  let base: string;
  try {
    const u = new URL(api, location.origin);
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    base = `${proto}//${u.host}`;
  } catch {
    base = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.hostname + ':8000';
  }
  return `${base}/ws/events/?token=${encodeURIComponent(token)}`;
}

function currentUserId(): string | null {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return u?.id != null ? String(u.id) : null;
  } catch {
    return null;
  }
}

const BURST_WINDOW_MS = 8000;

const EVENT_TITLES: Record<string, string> = {
  // Bookings / Loads
  'booking.created':    'New booking',
  'booking.assigned':   'Booking assigned',
  'booking.in_transit': 'Booking in transit',
  'booking.delivered':  'Booking delivered',
  'booking.cancelled':  'Booking cancelled',
  // Quotes
  'quote.created':   'New quote',
  'quote.sent':      'Quote sent',
  'quote.accepted':  'Quote accepted',
  'quote.declined':  'Quote declined',
  'quote.completed': 'Quote completed',
  'quote.expired':   'Quote expired',
  // Invoices
  'invoice.auto_created': 'Invoice raised',
  'invoice.paid':         'Invoice paid',
  'invoice.overdue':      'Invoice overdue',
  'invoice.status':       'Invoice updated',
  // Payments / fleet / drivers
  'payment.received':      'Payment received',
  'maintenance.due':       'Maintenance due',
  'driver.status_changed': 'Driver update',
  // Capital
  'advance.approved': 'Advance approved',
  'advance.disbursed': 'Funds disbursed',
  // Customers
  'customer.created': 'New customer',
};

export function LiveEvents() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  // data.changed topics collected over a short window: a burst of saves (an
  // import, a batch) refreshes each affected cache once, not once per row.
  const pendingTopicsRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef(0);
  const burstRef = useRef<Record<string, { id: string; count: number; at: number }>>({});
  // The user's push preferences: toasts for a category the user disabled are
  // suppressed (the event still refreshes screens via tw:live-event, and the
  // bell keeps the full history). Null until loaded — show everything.
  const pushPrefsRef = useRef<Record<string, boolean> | null>(null);

  useEffect(() => {
    const loadPrefs = () => {
      fetchData('/api/v1/notifications/settings/')
        .then((d: any) => { if (d?.push) pushPrefsRef.current = d.push; })
        .catch(() => { /* keep previous prefs */ });
    };
    loadPrefs();
    window.addEventListener('tw:settings-changed', loadPrefs);
    return () => window.removeEventListener('tw:settings-changed', loadPrefs);
  }, []);

  useEffect(() => {
    // `stopped` is closure-local so each effect instance has its own flag.
    // Using a shared ref causes a race in React StrictMode: cleanup sets the ref
    // to true, then the remount resets it to false before the old WS fires
    // onclose — creating a phantom third connection.
    let stopped = false;

    const connect = () => {
      const url = wsUrl();
      if (!url || stopped) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        // Only a genuine reconnect (retryRef > 0 means at least one prior
        // close+retry cycle happened) — not the page's very first connect —
        // dispatches this, so listeners can do a one-time catch-up fetch for
        // whatever might have been pushed while the socket was down. Cheaper
        // and more precise than polling on a timer: this only ever fires
        // right after a real gap, not on a fixed schedule.
        if (retryRef.current > 0) {
          window.dispatchEvent(new CustomEvent('tw:live-reconnected'));
          // Changes pushed while the socket was down were missed: refresh
          // everything once, then live updates take over again.
          invalidateAllTopics(queryClient);
        }
        retryRef.current = 0;
      };

      ws.onmessage = (e) => {
        let msg: any;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (!msg || msg.type === 'pong') return;
        // The server joined us to the company group: live updates are on, so
        // screens stop polling (useAutoRefresh).
        if (msg.type === 'connected') { setLiveConnected(true); return; }
        // A record changed (any save or delete, by anyone in the company):
        // refresh only the data it feeds. No toast, and not a tw:live-event,
        // so the bell and other notification listeners aren't woken by it.
        if (msg.type === 'event' && msg.event === 'data.changed') {
          (msg.data?.topics || []).forEach((t: string) => pendingTopicsRef.current.add(t));
          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              flushTimerRef.current = null;
              const topics = pendingTopicsRef.current;
              pendingTopicsRef.current = new Set();
              invalidateTopics(queryClient, topics);
            }, 250);
          }
          return;
        }
        if (msg.type === 'event') {
          window.dispatchEvent(new CustomEvent('tw:live-event', { detail: msg }));
          // The push goes to every connected browser in the company, including
          // the one that triggered it — the backend already excludes the actor
          // from getting a persisted Notification row, so mirror that here and
          // skip the toast too (no "you did X" popup for your own action).
          const isOwnAction = msg.data?.actor_id != null && String(msg.data.actor_id) === currentUserId();
          // Per-user toast gating: events carry the push category they map to
          // (backend notification_prefs.EVENT_CATEGORY); uncategorized events
          // always toast.
          const category = msg.data?.category;
          const prefs = pushPrefsRef.current;
          const mutedByPrefs = !!category && !!prefs && prefs[category] === false;
          if (msg.message && !isOwnAction && !mutedByPrefs) {
            const label = EVENT_TITLES[msg.event] || 'Update';
            // The message already says what happened; the label is only a fallback.
            const single = String(msg.message || label);
            const ntype = (msg.data?.type || '').toLowerCase();
            // Bursts of the same event collapse into one counted toast instead of a stack.
            const now = Date.now();
            const burst = burstRef.current[msg.event];
            if (burst && now - burst.at < BURST_WINDOW_MS && toast.isActive(burst.id)) {
              burst.count += 1;
              burst.at = now;
              toast.update(burst.id, { render: `${label} (${burst.count})` });
            } else {
              const id = String(msg.data?.event_id || `${msg.event}-${now}`);
              burstRef.current[msg.event] = { id, count: 1, at: now };
              if (ntype === 'success') toast.success(single, { toastId: id });
              else if (ntype === 'alert') toast.error(single, { toastId: id });
              else toast.info(single, { toastId: id });
            }
          }
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        setLiveConnected(false);
        if (stopped) return;
        const delay = Math.min(30000, 1000 * 2 ** retryRef.current);
        retryRef.current += 1;
        setTimeout(connect, delay);
      };

      ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
    };

    connect();

    return () => {
      stopped = true;
      try { wsRef.current?.close(); } catch { /* noop */ }
      wsRef.current = null;
      setLiveConnected(false);
      if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
    };
  }, [queryClient]);

  return null;
}
