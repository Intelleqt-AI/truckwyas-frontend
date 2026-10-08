import { Link } from "react-router-dom";
import { StatusChip } from "@/components/ui/StatusChip";
import { contractPct, fmtRatePerTonne, fmtTonnes, loadsText, periodText, type VolumeContract } from "@/lib/tonnage";
import "./tonnage-panel.css";

interface QuoteLike {
  rate_per_tonne?: string | number | null; min_tonnes_per_load?: string | number | null; tonnes_per_load?: string | number | null;
  total_tonnes?: string | number | null; loads_planned?: number | null;
  costing_snapshot?: { tonnage?: { min_tonnes_per_load?: number | null } | null } | null;
  volume_contract?: VolumeContract | null;
}

/** A per-tonne quote's terms (rate, minimum, tonnes) and, for a volume
 *  contract, the tonnes booked so far and its call-off loads. */
export function TonnageTerms({ quote, compact = false }: { quote: QuoteLike; compact?: boolean }) {
  const min = quote.min_tonnes_per_load ?? quote.costing_snapshot?.tonnage?.min_tonnes_per_load ?? null;
  const c = quote.volume_contract;
  const period = c ? periodText(c.contract_start, c.contract_end) : null;
  return (
    <div className="tn-terms">
      <div className="bk-kv"><span className="bk-kv__label">Rate</span><span className="bk-kv__value">{fmtRatePerTonne(quote.rate_per_tonne)}</span></div>
      <div className="bk-kv"><span className="bk-kv__label">Minimum a load</span><span className="bk-kv__value">{min != null ? fmtTonnes(min) : "—"}</span></div>
      {c ? (
        <>
          <div className="bk-kv"><span className="bk-kv__label">Contract</span><span className="bk-kv__value">{fmtTonnes(c.total_tonnes)} · {loadsText(c.loads_planned)}</span></div>
          {period && <div className="bk-kv"><span className="bk-kv__label">Period</span><span className="bk-kv__value">{period}</span></div>}
          <div className="tn-progress" aria-label={`${contractPct(c)}% booked`}>
            <div className="tn-progress__bar"><span style={{ width: `${contractPct(c)}%` }} /></div>
            <div className="tn-progress__text">
              <span>{fmtTonnes(c.booked_tonnes)} booked{c.delivered_tonnes ? `, ${fmtTonnes(c.delivered_tonnes)} weighed` : ""}</span>
              <span>{fmtTonnes(c.remaining_tonnes)} left</span>
            </div>
          </div>
          {!compact && !!c.loads?.length && (
            <ul className="tn-calloffs">
              {c.loads.map((l) => (
                <li key={l.id}>
                  <Link to={`/bookings/${l.id}`} className="bk-link">{l.load_number}</Link>
                  <span className="tn-calloffs__t">{l.actual_tonnes != null ? fmtTonnes(l.actual_tonnes) : `${fmtTonnes(l.planned_tonnes)} planned`}</span>
                  <StatusChip status={l.status} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="bk-kv"><span className="bk-kv__label">Tonnes</span><span className="bk-kv__value">{fmtTonnes(quote.tonnes_per_load)}{quote.loads_planned && quote.loads_planned > 1 ? ` · ${loadsText(quote.loads_planned)}` : ""}</span></div>
      )}
    </div>
  );
}
