import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

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

const EVENT_TITLES: Record<string, string> = {
  'booking.created': 'New booking',
  'booking.status': 'Booking updated',
  'advance.created': 'Advance requested',
  'advance.status': 'Capital',
  'invoice.status': 'Invoice updated',
};

export function LiveEvents() {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;

    const connect = () => {
      const url = wsUrl();
      if (!url || stoppedRef.current) return;
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
          // Tell every live screen to refresh now.
          window.dispatchEvent(new CustomEvent('tw:live-event', { detail: msg }));
          const title = EVENT_TITLES[msg.event] || 'Update';
          if (msg.message) toast(title, { description: msg.message });
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (stoppedRef.current) return;
        const delay = Math.min(30000, 1000 * 2 ** retryRef.current);
        retryRef.current += 1;
        setTimeout(connect, delay);
      };

      ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
    };

    connect();

    return () => {
      stoppedRef.current = true;
      try { wsRef.current?.close(); } catch { /* noop */ }
      wsRef.current = null;
    };
  }, []);

  return null;
}
