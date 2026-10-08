import { Info } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { NumberField } from "@/components/pricing/NumberField";
import { fmtRand } from "@/lib/quoteRules";
import {
  plazaMeta, tollVatBasis, borderKind, borderMeta, borderName, BORDER_KIND_LABEL,
  type TollItem, type BorderItem,
} from "@/lib/routeTolls";

const r2 = (v: number) => fmtRand(v, 2);

function Trigger({ label }: { label: string }) {
  return (
    <PopoverTrigger asChild>
      <button type="button" title={label} aria-label={label} className="qb-info"><Info size={14} aria-hidden="true" /></button>
    </PopoverTrigger>
  );
}

export interface TollLeg { title: string; items: TollItem[]; total: number | null; unknownReason?: string | null }

const UNKNOWN_REASON: Record<string, string> = {
  no_geometry: "Route shape not available, so plazas can't be matched. Enter the tolls.",
};

/** Plazas in driving order: class, operator, mainline / ramp, the date the
 *  tariff took effect, and the amount on the company's VAT basis. */
export function TollPop({ legs, sanralClass, includesVat, scheduleWarning }: {
  legs: TollLeg[]; sanralClass: number | null; includesVat: boolean; scheduleWarning?: string | null;
}) {
  const shown = legs.filter((l) => l.items.length || l.unknownReason || l.total === 0);
  return (
    <Popover>
      <Trigger label="Toll plazas" />
      <PopoverContent align="start" collisionPadding={16} className="qb-pop qb-pop--wide">
        <div className="qb-pop__title">Toll plazas{sanralClass ? ` · Class ${sanralClass}` : ""}</div>
        <div className="qb-pop__note">Amounts {tollVatBasis(includesVat)}.</div>
        {shown.length === 0 && <div className="qb-pop__row"><span>No toll plazas on this route</span><span /></div>}
        {shown.map((leg) => (
          <div key={leg.title} className="qb-pop__leg">
            {shown.length > 1 && <div className="qb-pop__leg-title">{leg.title}</div>}
            {leg.unknownReason ? (
              <div className="qb-pop__note">{UNKNOWN_REASON[leg.unknownReason] ?? "Tolls could not be worked out. Enter them."}</div>
            ) : leg.items.length === 0 ? (
              <div className="qb-pop__row"><span>No toll plazas</span><span>R 0</span></div>
            ) : leg.items.map((t, i) => (
              <div key={`${t.plaza}-${i}`} className="qb-pop__item">
                <div className="qb-pop__row"><span>{t.plaza}</span><span>{r2(Number(t.tariff))}</span></div>
                <div className="qb-pop__meta">{plazaMeta(t, null)}</div>
              </div>
            ))}
            {leg.total != null && leg.items.length > 0 && (
              <div className="qb-pop__row qb-pop__total"><span>{shown.length > 1 ? `${leg.title} total` : "Total"}</span><span>{r2(leg.total)}</span></div>
            )}
          </div>
        ))}
        {scheduleWarning && <div className="qb-pop__note qb-pop__note--warn">{scheduleWarning}</div>}
      </PopoverContent>
    </Popover>
  );
}

export interface BorderLeg { title: string; items: BorderItem[]; total: number }

/** Each border, permit and foreign-road charge with how sure it is
 *  (published / estimate / unverified / agent estimate), its source and date,
 *  and the exchange rate used. The clearing agent's fee is the user's to set. */
export function BorderPop({ title, legs, agentFee, onAgentFee, note }: {
  title: string; legs: BorderLeg[]; agentFee: number | null; onAgentFee: (v: number | null) => void;
  /** e.g. what is not on file (the quote is blocked until a figure is entered). */
  note?: string | null;
}) {
  return (
    <Popover>
      <Trigger label="Border charges" />
      <PopoverContent align="start" collisionPadding={16} className="qb-pop qb-pop--wide">
        <div className="qb-pop__title">{title}</div>
        {note && <div className="qb-pop__note qb-pop__note--warn" style={{ margin: "0 0 6px" }}>{note}</div>}
        {legs.map((leg) => (
          <div key={leg.title} className="qb-pop__leg">
            {legs.length > 1 && <div className="qb-pop__leg-title">{leg.title}</div>}
            {leg.items.map((b, i) => {
              const kind = borderKind(b);
              const meta = borderMeta(b);
              return (
                <div key={`${b.code ?? b.description}-${i}`} className="qb-pop__item">
                  <div className="qb-pop__row">
                    <span>{borderName(b)}</span>
                    {kind === "agent" ? (
                      <span className="qb-pop__fee">
                        R<NumberField decimals={0} value={agentFee ?? Number(b.amount)} placeholder={String(Math.round(Number(b.amount)))}
                          onValue={(n) => onAgentFee(n == null ? null : n)} aria-label="Your clearing agent's fee (R)" className="qb-mini qb-pop__input" />
                      </span>
                    ) : <span>{r2(Number(b.amount))}</span>}
                  </div>
                  <div className="qb-pop__meta">
                    <span className={`qb-pop__kind is-${kind}`}>{kind === "agent" && agentFee != null ? "Your fee" : BORDER_KIND_LABEL[kind]}</span>
                    {kind === "agent" && agentFee == null && <span> · enter your agent's fee</span>}
                    {meta && <span> · {meta}</span>}
                    {b.source_url ? <> · <a href={b.source_url} target="_blank" rel="noopener noreferrer" className="qb-pop__src">{b.source || "Source"}</a></>
                      : b.source && kind !== "agent" ? <span> · {b.source}</span> : null}
                  </div>
                </div>
              );
            })}
            <div className="qb-pop__row qb-pop__total"><span>{legs.length > 1 ? `${leg.title} total` : "Total"}</span><span>{r2(leg.total)}</span></div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
