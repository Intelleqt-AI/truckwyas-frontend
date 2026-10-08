import type { Tonnage } from "@/lib/quoteRules";
import { basisReason, fmtRatePerTonne, fmtTonnes, loadsText, truckText } from "@/lib/tonnage";
import { formatMoneyWhole } from "@/lib/formatters";
import { NumberField } from "./NumberField";
import { DatePicker } from "@/components/ui/date-picker";
import "./pricing-panel.css";
import "./tonnage-panel.css";

export interface TonnageMarket {
  available: boolean; p25: number | null; median: number | null; p75: number | null; n: number; tier_label: string;
}
export interface TonnageChoice { key: string; label: string; rate_per_tonne: number; margin_pct: number | null }

export interface TonnagePanelProps {
  tonnage: Tonnage | null;
  /** Inputs still missing ("client", "collection", …) before anything is priced. */
  needs: string[];
  contract: boolean;
  onContract: (v: boolean) => void;
  totalTonnes: number | null;
  onTotalTonnes: (v: number | null) => void;
  minTonnes: number | null;
  onMinTonnes: (v: number | null) => void;
  periodStart: string;
  periodEnd: string;
  onPeriod: (start: string, end: string) => void;
  /** The truck chosen (vehicle type id), null = safest. */
  chosenId: number | null;
  /** The builder holds the auto truck (lib/tonnage nextAutoBasis). */
  held?: boolean;
  onChooseTruck: (id: number | null) => void;
  market?: TonnageMarket | null;
  choices?: TonnageChoice[];
  onApplyRate: (rate: number) => void;
}

const pct = (n: number | null | undefined) => (n == null ? "—" : `${n < 0 && Math.round(Math.abs(n)) !== 0 ? "−" : ""}${Math.round(Math.abs(n))}%`);

/** The per-tonne side of the quote builder: tonnage terms, every truck that can
 *  carry it (cost per tonne, loads, margin at the rate) and the basis truck. */
export function TonnagePanel(p: TonnagePanelProps) {
  const t = p.tonnage;
  const reason = basisReason(t, !!p.held);
  const minPlaceholder = t?.min_tonnes_source === "basis_load" && t.min_tonnes_per_load ? fmtTonnes(t.min_tonnes_per_load).replace(" t", "") : "";
  return (
    <section className="pa tn" aria-labelledby="tn-title">
      <div className="pa__head">
        <h2 className="pa__title" id="tn-title">Per tonne</h2>
        <p className="pa__sub">Invoiced on weighbridge tonnes, never below the minimum.</p>
      </div>
      <div className="pa__body">
        <div className="tw-seg tw-seg--block tn-seg" role="group" aria-label="Quote type">
          <button type="button" className={`tw-seg__opt${!p.contract ? " is-active" : ""}`} aria-pressed={!p.contract} onClick={() => p.onContract(false)}>One load</button>
          <button type="button" className={`tw-seg__opt${p.contract ? " is-active" : ""}`} aria-pressed={p.contract} onClick={() => p.onContract(true)}>Contract</button>
        </div>

        <div className="tn-fields">
          {p.contract && (
            <label className="tn-field">
              <span className="tn-field__label">Total tonnes</span>
              <span className="tn-field__box">
                <NumberField value={p.totalTonnes} onValue={(n) => p.onTotalTonnes(n != null && n > 0 ? n : null)} placeholder="e.g. 600" aria-label="Contract total tonnes" />
                <span className="tn-field__unit">t</span>
              </span>
            </label>
          )}
          <label className="tn-field">
            <span className="tn-field__label">Minimum per load</span>
            <span className="tn-field__box">
              <NumberField value={p.minTonnes} onValue={(n) => p.onMinTonnes(n != null && n > 0 ? n : null)} placeholder={minPlaceholder || "Planned load"} aria-label="Minimum tonnes per load" />
              <span className="tn-field__unit">t</span>
            </span>
          </label>
        </div>
        {p.contract && (
          <div className="tn-fields">
            <div className="tn-field">
              <span className="tn-field__label">From</span>
              <DatePicker value={p.periodStart} onChange={(v: string) => p.onPeriod(v, p.periodEnd)} />
            </div>
            <div className="tn-field">
              <span className="tn-field__label">To</span>
              <DatePicker value={p.periodEnd} onChange={(v: string) => p.onPeriod(p.periodStart, v)} />
              {p.periodStart && p.periodEnd && p.periodEnd < p.periodStart && <span className="wb-err" role="alert">Ends before it starts.</span>}
            </div>
          </div>
        )}

        {!t || !t.trucks.length ? (
          <p className="pa-quiet tn-gap">{p.needs.length ? `Add ${p.needs.join(", ")} to compare trucks.` : t?.excluded.length ? "No truck in your fleet can carry this." : "Working out cost per tonne…"}</p>
        ) : (
          <>
            <div className="tn-trucks" role="list" aria-label="Cost per tonne by truck">
              {t.trucks.map((tr) => {
                const chosen = tr.is_basis;
                return (
                  <button key={tr.vehicle_type_id ?? tr.name} type="button" role="listitem"
                    className={`tn-truck${chosen ? " is-basis" : ""}`} aria-pressed={chosen}
                    onClick={() => p.onChooseTruck(chosen && t.basis_reason === "chosen" && !p.held ? null : tr.vehicle_type_id)}
                    title={chosen && t.basis_reason === "chosen" && !p.held ? "Back to the safest truck" : "Price on this truck"}>
                    <span className="tn-truck__name">{truckText(tr)}</span>
                    <span className="tn-truck__cpt">{tr.cost_per_tonne != null ? fmtRatePerTonne(tr.cost_per_tonne, true) : "—"}</span>
                    <span className="tn-truck__meta">{loadsText(tr.loads_needed)}{tr.partial_last_load ? `, last ${fmtTonnes(tr.last_load_t)}` : ""}</span>
                    <span className={`tn-truck__margin${(tr.at_rate?.margin ?? 0) < 0 ? " is-loss" : ""}`}>{tr.at_rate ? pct(tr.at_rate.margin_pct) : ""}</span>
                  </button>
                );
              })}
            </div>
            {reason && <p className="pa-note tn-reason">{reason}{t.basis_reason === "chosen" && !p.held && <> <button type="button" className="pa-link" onClick={() => p.onChooseTruck(null)}>Use safest</button></>}</p>}
            <dl className="tn-sum">
              <div><dt>Cost</dt><dd>{t.cost_per_tonne != null ? fmtRatePerTonne(t.cost_per_tonne, true) : "—"}</dd></div>
              <div><dt>Target</dt><dd>{t.default_rate_per_tonne != null ? fmtRatePerTonne(t.default_rate_per_tonne) : "—"}</dd></div>
              <div><dt>Minimum a load</dt><dd>{t.minimum_charge_per_load != null ? formatMoneyWhole(t.minimum_charge_per_load) : "—"}</dd></div>
              <div><dt>{t.mode === "volume" ? "Contract" : "Load"}</dt><dd>{loadsText(t.loads_planned)} · {fmtTonnes(t.billable_tonnes)}</dd></div>
            </dl>
          </>
        )}

        {p.market?.available && (
          <p className="pa-note tn-gap">Market {fmtRatePerTonne(p.market.p25)} to {fmtRatePerTonne(p.market.p75)}, median {fmtRatePerTonne(p.market.median)}</p>
        )}
        {!!p.choices?.length && (
          <div className="tn-choices">
            {p.choices.map((c) => (
              <button key={c.key} type="button" className={`tn-choice${t?.rate_per_tonne === c.rate_per_tonne ? " is-active" : ""}`} onClick={() => p.onApplyRate(c.rate_per_tonne)}>
                <span className="tn-choice__label">{c.label}</span>
                <span className="tn-choice__rate">{fmtRatePerTonne(c.rate_per_tonne)}</span>
                <span className="tn-choice__pct">{pct(c.margin_pct)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
