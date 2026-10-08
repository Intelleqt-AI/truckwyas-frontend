// Fleet actuals UI (FLEET-ACTUALS-CLIENT-SPEC.md): measured fuel use from
// Cartrack on Settings > Vehicle types and on a truck's page. Display rules
// live in src/lib/fleetFuel.ts (shared with the app).
import { useState } from 'react';
import { useFleetFuel } from './useFleetFuel';
import { Link } from 'react-router-dom';
import { postData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import {
  type FuelActuals, type VehicleTypeFuel, type Tone, fuelCell, selectedMode, periodHeading, measuredLines, methodSentence,
  confidenceChip, unusableText, leftOut, headerStrip, truckCard,
} from '@/lib/fleetFuel';
import './fleet-fuel.css';

const TONE: Record<Tone, StatusTone> = { good: 'success', neutral: 'neutral', warn: 'warning', bad: 'danger' };

const errText = (e: unknown, fallback: string): string => {
  const d = (e as { response?: { data?: { error?: string; detail?: string } } })?.response?.data;
  return d?.error || d?.detail || fallback;
};

export function FleetFuelStrip({ data, isAdmin, onQueued }: { data: FuelActuals; isAdmin: boolean; onQueued: () => void }) {
  const s = headerStrip(data);
  const [busy, setBusy] = useState(false);
  const queued = !!data.refresh_queued || busy;
  const refresh = async () => {
    setBusy(true);
    try {
      await postData({ url: 'api/v1/fleet/fuel-actuals/refresh/', data: {} });
      onQueued();
    } catch (e) {
      toast.error(errText(e, "Couldn't start a refresh."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ff-strip" role="status">
      <div className="ff-strip__main">
        <span>{s.main}</span>
        {s.link && (
          <Link className="ff-link" to={s.link.to === 'fleet' ? '/fleet/vehicles' : '/settings/integrations'}>{s.link.text}</Link>
        )}
        {s.canRefresh && isAdmin && (
          <button type="button" className="ff-link" onClick={refresh} disabled={queued}>
            {queued ? 'Refreshing...' : 'Refresh now'}
          </button>
        )}
      </div>
      {s.lines.map((l) => <div key={l} className="ff-strip__line">{l}</div>)}
    </div>
  );
}

/** "Fuel use" cell of the vehicle types table. */
export function FuelUseCell({ row, isAdmin, onDetail, onSet, onUseMeasured }: {
  row: VehicleTypeFuel | undefined; isAdmin: boolean;
  onDetail: () => void; onSet: () => void; onUseMeasured: () => void;
}) {
  if (!row) return <span className="ff-muted">Not set</span>;
  const c = fuelCell(row);
  if (c.missing) {
    return (
      <span className="ff-cell">
        <span className="ff-muted">Not set</span>
        {isAdmin && <button type="button" className="ff-link" onClick={onSet}>Set fuel use</button>}
      </span>
    );
  }
  return (
    <span className="ff-cell">
      <span className="ff-cell__top">
        {row.measured ? (
          <button type="button" className="ff-value ff-value--btn" onClick={onDetail} aria-label={`${row.name} fuel use details`}>{c.value}</button>
        ) : <span className="ff-value">{c.value}</span>}
        {c.tag && <span className={`ff-tag${c.tag === 'Measured' ? ' ff-tag--measured' : ''}`}>{c.tag}</span>}
      </span>
      {c.sub && <span className="ff-sub">{c.sub}</span>}
      {c.offerUseMeasured && isAdmin && <button type="button" className="ff-link" onClick={onUseMeasured}>Use measured figure</button>}
    </span>
  );
}

/** Measured detail for one vehicle type (drawer body). */
export function FuelDetail({ row, isAdmin, minKm, onChanged }: {
  row: VehicleTypeFuel; isAdmin: boolean; minKm: number; onChanged: (r: VehicleTypeFuel) => void;
}) {
  const m = row.measured;
  const [saving, setSaving] = useState<string | null>(null);
  if (!m) return null;
  const chip = confidenceChip(m, minKm);
  const why = unusableText(m);
  const out = leftOut(m.rejections);
  const sel = selectedMode(row);
  const setMode = async (mode: 'MEASURED' | 'CONFIGURED') => {
    if (mode === sel || saving) return;
    setSaving(mode);
    try {
      const r = await postData({ url: `api/v1/fleet/fuel-actuals/vehicle-types/${row.id}/burn-mode/`, data: { mode } });
      onChanged(r as VehicleTypeFuel);
    } catch (e) {
      toast.error(errText(e, "Couldn't change the figure."));
    } finally {
      setSaving(null);
    }
  };
  return (
    <div className="ff-detail">
      <h3 className="ff-detail__title">{periodHeading(m)}</h3>
      <div className="ff-detail__chips">
        <StatusChip tone={TONE[chip.tone]} label={chip.text} size="sm" />
      </div>
      {why && <p className="ff-warn">{why}</p>}
      {m.confidence === 'rejected' && m.note && !why && <p className="ff-warn">{m.note}</p>}
      <ul className="ff-lines">
        {measuredLines(m).map((l) => <li key={l}>{l}</li>)}
      </ul>
      {methodSentence(m.rated_method) && <p className="ff-muted ff-detail__how">{methodSentence(m.rated_method)}</p>}
      {out.lines.length > 0 && (
        <div className="ff-detail__left">
          <h4 className="ff-detail__sub">Left out</h4>
          <ul className="ff-lines ff-lines--muted">
            {out.lines.map((l, i) => <li key={`${i}-${l}`}>{l}</li>)}
            {out.more && <li>{out.more}</li>}
          </ul>
        </div>
      )}
      {isAdmin && (
        <div className="ff-seg" role="radiogroup" aria-label="Figure used for quotes">
          {(['MEASURED', 'CONFIGURED'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={sel === mode}
              className={`ff-seg__opt${sel === mode ? ' is-on' : ''}`}
              disabled={!!saving || (mode === 'MEASURED' && !row.can_use_measured && sel !== 'MEASURED')}
              onClick={() => setMode(mode)}
            >
              {saving === mode ? 'Saving...' : mode === 'MEASURED' ? 'Use measured figure' : 'Use my figure'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Truck page card "Fuel use (last 90 days)". */
export function TruckFuelCard({ vehicleId }: { vehicleId: number | string }) {
  const { data } = useFleetFuel();
  if (!data) return null;
  const v = data.vehicles.find((x) => String(x.id) === String(vehicleId));
  if (!v) return null;
  const type = data.vehicle_types.find((t) => t.id === v.vehicle_type_id);
  const card = truckCard(v, type, data.rules?.min_distance_km ?? 2000);
  if (!card) return null;
  return (
    <section className="ff-card" aria-label="Fuel use">
      <h2 className="ff-card__title">Fuel use (last {data.rules?.period_days ?? 90} days)</h2>
      <div className="ff-card__top">
        {card.value && <span className="ff-card__value">{card.value}</span>}
        {card.chip && <StatusChip tone={TONE[card.chip.tone]} label={card.chip.text} size="sm" />}
      </div>
      <ul className="ff-lines">
        {card.lines.map((l) => <li key={l}>{l}</li>)}
        {card.typeLine && <li>{card.typeLine}</li>}
      </ul>
      {card.amber && <p className="ff-warn">{card.amber}</p>}
    </section>
  );
}
