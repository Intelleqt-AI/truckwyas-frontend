import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchData } from './Api';

export interface AuthUser {
  id: number;
  email: string;
  name?: string;
  username?: string;
  role: string;
  status?: string;
  // Company's billing state — 'active'/'trialing' healthy, 'grace_period' a
  // recent charge failed but access continues, 'suspended'/'cancelled' block
  // quoting/invoicing (see core/models/company.py's subscription_status).
  subscription_status?: string;
  // True while a cancellation is pending — subscription_status itself stays
  // 'active'/'grace_period' until the paid period actually ends, so this is
  // the only signal that a cancellation is scheduled.
  cancel_at_period_end?: boolean;
  // True for the single shared public demo company (see core/models/company.py) —
  // it caps quote creation at demo_quota_used >= 1 (reset nightly) and blocks
  // creating new clients/vehicles, both enforced server-side already.
  is_demo?: boolean;
  demo_quota_used?: number;
  // Django's own superuser flag — a platform operator, unrelated to this
  // user's company-scoped `role` (e.g. 'ADMIN'). Gates the cross-tenant
  // admin dashboard only.
  is_superuser?: boolean;
  [key: string]: any;
}

interface AuthContextType {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  refreshUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem('user', JSON.stringify(u));
    } else {
      localStorage.removeItem('user');
    }
  }, []);

  const refreshUser = useCallback(() => {
    const token = localStorage.getItem('access');
    if (!token) return;
    fetchData('api/v1/auth/me/')
      .then((data: AuthUser) => setUser(data))
      .catch(() => {});
  }, [setUser]);

  // Sync fresh role from DB on every mount so role changes take effect without re-login.
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Also re-sync whenever the tab regains focus — subscription_status can
  // change out of band (billing action in another tab, admin change, a
  // webhook landing after the confirm redirect already fired) and this is a
  // long-lived SPA session where AuthProvider only mounts once, so without
  // this a stale subscription_status can keep billing-gated UI (drag/drop,
  // AI pricing, invoice buttons) blocked long after the account is current.
  useEffect(() => {
    const onFocus = () => refreshUser();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshUser();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshUser]);

  // Also re-sync the instant a subscription.* event arrives over the live
  // WebSocket (see components/LiveEvents.tsx) — this is what covers a
  // background change with the tab already open and focused the whole time
  // (e.g. the check_pending_cancellations sweep finalising a cancellation,
  // or the monthly-fee cron recharging/suspending): focus/visibility alone
  // can't catch that since the tab never lost focus for those to fire.
  useEffect(() => {
    const onLiveEvent = (e: Event) => {
      const { detail } = e as CustomEvent;
      if (typeof detail?.event === 'string' && detail.event.startsWith('subscription.')) {
        refreshUser();
      }
    };
    window.addEventListener('tw:live-event', onLiveEvent);
    return () => window.removeEventListener('tw:live-event', onLiveEvent);
  }, [refreshUser]);

  // Also re-sync once, right after the WebSocket reconnects post-drop (see
  // components/LiveEvents.tsx) — catches anything pushed while the socket
  // was down, without polling on a fixed schedule. Fires only on an actual
  // reconnect event, never on a timer.
  useEffect(() => {
    window.addEventListener('tw:live-reconnected', refreshUser);
    return () => window.removeEventListener('tw:live-reconnected', refreshUser);
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
