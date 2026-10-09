import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchData } from '@/lib/Api';
import type { FuelActuals } from '@/lib/fleetFuel';

/** GET /fleet/fuel-actuals/, polled every 20 s while a refresh is queued. */
export function useFleetFuel() {
  const [data, setData] = useState<FuelActuals | null>(null);
  const [failed, setFailed] = useState(false);
  const timer = useRef<number | null>(null);
  const load = useCallback(() => {
    fetchData('api/v1/fleet/fuel-actuals/')
      .then((d: FuelActuals) => { setData(d); setFailed(false); })
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!data?.refresh_queued) return;
    timer.current = window.setTimeout(load, 20_000);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [data, load]);
  return { data, failed, reload: load, setData };
}
