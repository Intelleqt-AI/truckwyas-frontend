import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, patchData, postData } from '@/lib/Api';
import { useAuth } from '@/lib/AuthContext';
import type { FollowUpState, FuelAdjustment, FuelAlert, PricingSetup, QuoteAutomation } from '@/lib/followups';

// Quote follow-ups data (FOLLOWUPS-CLIENT-SPEC.md). Every endpoint is
// company-scoped on the server; the cache keys are shared by every screen.

export const automationKey = ['quote-automation'] as const;
export const pricingSetupKey = ['pricing-setup'] as const;

export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return String(user?.role || '').toUpperCase() === 'ADMIN';
}

export function useQuoteAutomation(enabled = true) {
  return useQuery<QuoteAutomation>({
    queryKey: automationKey,
    queryFn: () => fetchData('/api/v1/company/quote-automation/'),
    enabled,
    staleTime: 60_000,
  });
}

export function useSaveAutomation() {
  const qc = useQueryClient();
  return async (patch: Partial<QuoteAutomation>): Promise<QuoteAutomation> => {
    const res = await patchData({ url: '/api/v1/company/quote-automation/', data: patch });
    qc.setQueryData(automationKey, res);
    // The draft clause line on quotes follows the setting.
    qc.invalidateQueries({ queryKey: ['fuel-adjustment'] });
    return res as QuoteAutomation;
  };
}

export function usePricingSetup(enabled = true) {
  return useQuery<PricingSetup>({
    queryKey: pricingSetupKey,
    queryFn: () => fetchData('/api/v1/company/pricing-setup/'),
    enabled,
    staleTime: 60_000,
  });
}

export function usePricingSetupAction() {
  const qc = useQueryClient();
  return async (body: { action: 'confirm'; keys: string[] } | { action: 'dismiss' }) => {
    const res = await postData({ url: '/api/v1/company/pricing-setup/', data: body });
    qc.setQueryData(pricingSetupKey, res);
    return res as PricingSetup;
  };
}

export function useFuelAdjustment(kind: 'quotes' | 'loads', id: string | number | null | undefined, enabled = true) {
  return useQuery<FuelAdjustment>({
    queryKey: ['fuel-adjustment', kind, String(id)],
    queryFn: () => fetchData(`/api/v1/${kind}/${id}/fuel-adjustment/`),
    enabled: enabled && id != null && id !== '',
    staleTime: 60_000,
    retry: false,
  });
}

export function useFollowUp(quoteId: string | number | null | undefined, enabled = true) {
  return useQuery<FollowUpState>({
    queryKey: ['quote-follow-up', String(quoteId)],
    queryFn: () => fetchData(`/api/v1/quotes/${quoteId}/follow-up/`),
    enabled: enabled && quoteId != null && quoteId !== '',
    staleTime: 30_000,
    retry: false,
  });
}

export function useFuelAlert(alertId: number | null) {
  return useQuery<FuelAlert>({
    queryKey: ['fuel-alert', alertId],
    queryFn: () => fetchData(`/api/v1/fuel-alerts/${alertId}/`),
    enabled: alertId != null,
    retry: false,
  });
}
