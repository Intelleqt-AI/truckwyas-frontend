import type { NavigateFunction } from 'react-router-dom';
import { fetchData } from '@/lib/Api';

/**
 * Where to land after a successful login (token already stored).
 * Admins who haven't completed (or skipped) the onboarding wizard yet are
 * sent to onboarding; everyone else to the dashboard. Shared by the
 * password-only and 2FA (OTP-verify) login paths.
 */
export async function postLoginNavigate(navigate: NavigateFunction) {
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
