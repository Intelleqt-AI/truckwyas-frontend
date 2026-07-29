import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { fetchData } from '@/lib/Api';

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
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
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

      ws.onopen = () => { retryRef.current = 0; };

      ws.onmessage = (e) => {
        let msg: any;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (!msg || msg.type === 'connected' || msg.type === 'pong') return;
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
            const text = label === msg.message ? label : `${label} — ${msg.message}`;
            const ntype = (msg.data?.type || '').toLowerCase();
            // event_id (uuid per event) as toastId dedupes replayed frames.
            const opts = msg.data?.event_id ? { toastId: msg.data.event_id } : undefined;
            if (ntype === 'success') toast.success(text, opts);
            else if (ntype === 'alert') toast.error(text, opts);
            else toast.info(text, opts);
          }
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
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
    };
  }, []);

  return null;
}
