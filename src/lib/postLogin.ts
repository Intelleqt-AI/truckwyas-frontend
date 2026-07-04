import type { NavigateFunction } from 'react-router-dom';
import { fetchData } from '@/lib/Api';

/**
 * Where to land after a successful login (token already stored).
 * Admins with no vehicles yet are sent to onboarding; everyone else to the
 * dashboard. Shared by the password-only and 2FA (OTP-verify) login paths.
 */
export async function postLoginNavigate(navigate: NavigateFunction) {
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = storedUser?.role?.toUpperCase() === 'ADMIN';

  if (isAdmin) {
    const onboardingDone = localStorage.getItem('onboarding_done');
    if (!onboardingDone) {
      try {
        const v: any = await fetchData('api/v1/vehicles/');
        const vehicleCount = v?.count ?? (Array.isArray(v) ? v.length : (v?.results?.length ?? 0));
        if (vehicleCount === 0) {
          navigate('/onboarding');
          return;
        }
      } catch {
        // If the API fails, skip the onboarding check.
      }
    }
  }
  navigate('/');
}
