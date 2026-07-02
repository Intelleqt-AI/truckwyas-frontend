import { useEffect, useRef } from 'react';
import { fetchData } from '@/lib/Api';

/**
 * Auto sign-out after a period of no real user interaction.
 *
 * When `enabled`, listens for genuine user activity (mouse / keyboard / scroll /
 * touch) and calls `onTimeout` once `timeoutMs` elapses without any. An active
 * user is never signed out; an idle one is. When `enabled` is false, nothing is
 * attached — behaviour is exactly as before (this is how "Session timeout" OFF
 * disables it, live, without a reload).
 *
 * Two details make it robust:
 *  - Cross-tab: activity is mirrored through `localStorage` so interacting in any
 *    tab keeps every tab alive (an idle background tab can't sign you out).
 *  - Heartbeat: real activity refreshes the backend's `last_activity` (at most
 *    once per HEARTBEAT_INTERVAL_MS) so the server-side idle backstop stays in
 *    step with genuine activity and never expires an active user.
 */

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;
const ACTIVITY_KEY = 'tw-last-activity';        // shared across tabs
const ACTIVITY_THROTTLE_MS = 1000;              // coalesce rapid events
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;    // ping backend at most this often
const CHECK_INTERVAL_MS = 30 * 1000;            // how often we test the deadline

interface Options {
  enabled: boolean;
  timeoutMs: number;
  onTimeout: () => void;
}

export function useIdleLogout({ enabled, timeoutMs, onTimeout }: Options) {
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onTimeoutRef.current = onTimeout; });

  useEffect(() => {
    if (!enabled) return;

    let lastActivity = Date.now();
    let lastThrottle = 0;
    let lastHeartbeat = Date.now();
    let fired = false;

    const persist = (ts: number) => {
      try { localStorage.setItem(ACTIVITY_KEY, String(ts)); } catch { /* storage may be unavailable */ }
    };

    // Seed from any activity another tab already recorded.
    const stored = Number(localStorage.getItem(ACTIVITY_KEY));
    if (stored && stored > lastActivity) lastActivity = stored;
    else persist(lastActivity);

    const markActive = () => {
      const now = Date.now();
      if (now - lastThrottle < ACTIVITY_THROTTLE_MS) return;   // coalesce bursts
      lastThrottle = now;
      lastActivity = now;
      persist(now);
      // Keep the backend's last_activity aligned with REAL activity so its
      // idle-timeout backstop never signs out a genuinely-active user.
      if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeat = now;
        fetchData('api/v1/auth/me/').catch(() => { /* a dead session is handled by the 401 interceptor */ });
      }
    };

    // Activity in another tab keeps this one alive (and vice-versa).
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVITY_KEY && e.newValue) {
        const ts = Number(e.newValue);
        if (ts > lastActivity) lastActivity = ts;
      }
    };

    const check = () => {
      if (fired) return;
      if (Date.now() - lastActivity > timeoutMs) {
        fired = true;
        onTimeoutRef.current();
      }
    };

    // Re-evaluate the moment a tab is refocused (don't wait up to CHECK_INTERVAL_MS).
    // Note: returning to a tab is NOT treated as activity — time spent away counts
    // as idle, so a user who was gone past the deadline is signed out on return.
    const onVisibility = () => { if (document.visibilityState === 'visible') check(); };

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, markActive, { passive: true }));
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, markActive));
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(timer);
    };
  }, [enabled, timeoutMs]);
}
