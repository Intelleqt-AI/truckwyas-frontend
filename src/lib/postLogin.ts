import type { NavigateFunction } from 'react-router-dom';
import { fetchData } from '@/lib/Api';
import { isMobileDevice } from '@/lib/isMobileDevice';

interface PostLoginNavigateOptions {
  /**
   * Whether landing on mobile may route into the web -> app auth handoff
   * (/open-app). Default true. OpenInApp's own "Continue in browser" action
   * calls this with `false` so it doesn't just bounce straight back to itself.
   */
  allowAppHandoff?: boolean;
}

/**
 * Where to land after a successful login (token already stored).
 * On mobile, sends the user to /open-app to hand off into the native app
 * instead — unless `allowAppHandoff` is false. Otherwise: admins who haven't
 * completed (or skipped) the onboarding wizard yet are sent to onboarding;
 * everyone else to the dashboard. Shared by the password-only and 2FA
 * (OTP-verify) login paths, and by SignupComplete.
 */
export async function postLoginNavigate(
  navigate: NavigateFunction,
  { allowAppHandoff = true }: PostLoginNavigateOptions = {},
) {
  // Checked and navigated before any `await` below: the token is already in
  // localStorage by the time callers reach this function, so PublicOnly (on
  // /login, /login/verify-otp, /signup/complete) would redirect to "/" on its
  // next render — this has to win that race by running synchronously first.
  if (allowAppHandoff && isMobileDevice()) {
    navigate('/open-app');
    return;
  }

  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = storedUser?.role?.toUpperCase() === 'ADMIN';

  if (isAdmin) {
    const onboardingDone = localStorage.getItem('onboarding_done');
    if (!onboardingDone) {
      try {
        // Server-side flag is the durable source of truth (survives logout,
        // works from any browser/device) — the localStorage flag above is
        // just a same-session fast path so we don't hit the API every nav.
        const company: any = await fetchData('api/v1/company/profile/');
        if (!company?.onboarding_completed_at) {
          navigate('/onboarding');
          return;
        }
        localStorage.setItem('onboarding_done', 'true');
      } catch {
        // If the API fails, skip the onboarding check.
      }
    }
  }
  navigate('/');
}
