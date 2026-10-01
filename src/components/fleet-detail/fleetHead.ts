import { useEffect, useState } from 'react';
import type { MenuItem } from '@/components/ui/OverflowMenu';

/** The width at which the Fleet head's secondary actions leave the title row (fleet-vehicles-brand.css). */
const PHONE_HEAD_MQ = '(max-width: 768px)';

/** True on phone widths, where Vehicles and Drivers keep one head action and a "⋯". */
export function useFleetPhoneHead() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_HEAD_MQ).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_HEAD_MQ);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

/**
 * The Fleet head's "⋯" items on phones (R5): Activity and the Excel import,
 * which sit on the title row on desktop. On desktop no items are passed, so
 * no "⋯" appears beside the buttons that already show.
 */
export function fleetMenuItems(opts: { phone: boolean; openActivity: () => void; openImport: () => void; importLabel?: string; importDisabled?: boolean }): MenuItem[] | undefined {
  if (!opts.phone) return undefined;
  return [
    { label: 'Activity', onSelect: opts.openActivity },
    { label: opts.importLabel ?? 'Import from Excel', onSelect: opts.openImport, disabled: opts.importDisabled, title: opts.importDisabled ? 'Fixed in demo mode' : undefined },
  ];
}
