import './bookings-typography.css';
import './table-heading-roles.css';
import './bookings-section.css';
import '@/components/pricing/tonnage-panel.css';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import SectionHeader from '@/components/layout/SectionHeader';
import { StatusChip } from '@/components/ui/StatusChip';
import LoadError from '@/components/data/LoadError';
import { SkeletonRows } from '@/components/fleet-detail/ContentSkeleton';
import { fetchData } from '@/lib/Api';
import { rowLink } from '@/lib/rowLink';
import { contractPct, fmtRatePerTonne, fmtTonnes, periodText, type VolumeContract } from '@/lib/tonnage';
import { BOOKINGS_TABS } from './LoadsList';

interface ContractRow {
  id: number; quote_number: string; customer_name?: string | null; status: string;
  pickup_location: string; delivery_location: string; origin?: string; destination?: string;
  rate_per_tonne: string | null; min_tonnes_per_load: string | null;
  costing_snapshot?: { tonnage?: { min_tonnes_per_load?: number | null } | null } | null;
  volume_contract: VolumeContract | null;
}

const place = (s: string) => (s || '').split(',')[0].trim() || '—';

/** Volume contracts: per-tonne quotes with a total, booked as call-off loads.
 *  Created and edited in the quote builder (Per tonne, Contract). */
export default function Contracts() {
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ['quotes', 'contracts'],
    queryFn: () => fetchData('api/v1/quotes/?contract=true&page_size=100'),
  });
  const rows: ContractRow[] = q.data?.results ?? q.data ?? [];
  const open = (id: number) => navigate(`/bookings/quotes/${id}`);
  return (
    <div className="bookings-typography">
      <SectionHeader
        eyebrow="Bookings"
        title="Contracts"
        description="Tonnes over a period, booked load by load."
        actions={
          <button type="button" className="bk-btn bk-btn--primary" onClick={() => navigate('/bookings/quotes/new?contract=1')}>
            <Plus size={16} aria-hidden="true" />
            New contract
          </button>
        }
        tabs={BOOKINGS_TABS}
      />
      {q.isError ? (
        <LoadError what="contracts" error={q.error} busy={q.isFetching} onRetry={() => q.refetch()} />
      ) : !q.isPending && rows.length === 0 ? (
        <div className="bk-card ct-empty">
          <p className="bk-help">No contracts yet. Quote a total in tonnes and book each load as it is called off.</p>
          <button type="button" className="bk-btn bk-btn--secondary" onClick={() => navigate('/bookings/quotes/new?contract=1')}>New contract</button>
        </div>
      ) : (
        <div className="bk-table-wrap">
          <table className="table-heading-roles bk-table ct-table">
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col" className="ct-col-lane">Lane</th>
                <th scope="col" className="is-num">Rate</th>
                <th scope="col" className="is-num ct-col-min">Minimum</th>
                <th scope="col" className="ct-col-period">Period</th>
                <th scope="col" className="ct-col-tonnes">Tonnes</th>
                <th scope="col" className="ct-col-status">Status</th>
              </tr>
            </thead>
            <tbody>
              {q.isPending ? <SkeletonRows rows={5} cols={7} /> : rows.map((r) => {
                const c = r.volume_contract;
                const min = r.min_tonnes_per_load ?? r.costing_snapshot?.tonnage?.min_tonnes_per_load ?? null;
                return (
                  <tr key={r.id} className="is-clickable" {...rowLink(() => open(r.id))} onClick={() => open(r.id)}>
                    <td className="is-primary is-truncate ct-col-client" title={r.customer_name || ''}>
                      {r.customer_name || '—'}
                      <span className="ct-sub">{r.quote_number}</span>
                    </td>
                    <td className="ct-col-lane is-truncate" title={`${r.pickup_location} to ${r.delivery_location}`}>{place(r.pickup_location)} → {place(r.delivery_location)}</td>
                    <td className="is-money">{fmtRatePerTonne(r.rate_per_tonne)}</td>
                    <td className="is-num ct-col-min">{min != null ? fmtTonnes(min) : '—'}</td>
                    <td className="ct-col-period">{c ? periodText(c.contract_start, c.contract_end) ?? '—' : '—'}</td>
                    <td className="ct-col-tonnes">
                      {c ? (
                        <div className="tn-progress ct-progress" aria-label={`${fmtTonnes(c.booked_tonnes)} of ${fmtTonnes(c.total_tonnes)} booked`}>
                          <div className="tn-progress__bar"><span style={{ width: `${contractPct(c)}%` }} /></div>
                          <div className="tn-progress__text"><span>{fmtTonnes(c.booked_tonnes).replace(" t", "")} / {fmtTonnes(c.total_tonnes)}</span></div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="ct-col-status"><StatusChip status={r.status} size="sm" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
