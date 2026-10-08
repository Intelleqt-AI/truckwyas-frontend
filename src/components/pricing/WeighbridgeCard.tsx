import { useState } from "react";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/lib/formatters";
import { fmtRatePerTonne, fmtTonnes, type LoadTonnage } from "@/lib/tonnage";
import { fieldText, parseTonnes, saveWeighbridge } from "./weighbridge";
import "./tonnage-panel.css";

interface LoadLike {
  id: number | string; status?: string; pricing_basis?: string; planned_tonnes?: string | number | null;
  actual_tonnes?: string | number | null; weighbridge_slip?: string | null; tonnage?: LoadTonnage | null;
}

/** The tonnes and slip inputs, shared by the card and the delivery dialog. */
export function WeighbridgeFields({ tonnes, slip, onTonnes, onSlip, planned }: {
  tonnes: string; slip: string; onTonnes: (v: string) => void; onSlip: (v: string) => void; planned?: string | number | null;
}) {
  const bad = tonnes.trim() !== "" && parseTonnes(tonnes) == null;
  return (
    <div className="tn-fields wb-fields">
      <label className="tn-field">
        <span className="tn-field__label">Weighbridge tonnes</span>
        <span className="tn-field__box">
          <input inputMode="decimal" value={tonnes} onChange={(e) => onTonnes(e.target.value)} placeholder={planned != null ? fieldText(planned) : "e.g. 30,4"} aria-invalid={bad} aria-label="Weighbridge tonnes" />
          <span className="tn-field__unit">t</span>
        </span>
        {bad && <span className="wb-err">Enter tonnes, up to 100.</span>}
      </label>
      <label className="tn-field">
        <span className="tn-field__label">Slip number</span>
        <span className="tn-field__box"><input value={slip} onChange={(e) => onSlip(e.target.value)} maxLength={60} placeholder="Optional" aria-label="Weighbridge slip number" /></span>
      </label>
    </div>
  );
}

/** Order page card for a per-tonne load: planned vs weighed tonnes, the
 *  minimum, and the billed amount; enter or confirm the weighbridge tonnes. */
export function WeighbridgeCard({ load, onSaved, disabled }: { load: LoadLike; onSaved: () => void; disabled?: boolean }) {
  const b = load.tonnage;
  const [editing, setEditing] = useState(false);
  const [tonnes, setTonnes] = useState(fieldText(load.actual_tonnes));
  const [slip, setSlip] = useState(load.weighbridge_slip || "");
  const [busy, setBusy] = useState(false);
  if (!b) return null;
  const delivered = ["DELIVERED", "INVOICED"].includes(String(load.status));
  const submit = async (t: number | null) => {
    if (t == null) { toast.error("Enter the weighbridge tonnes"); return; }
    setBusy(true);
    try {
      await saveWeighbridge(load.id, t, slip);
      toast.success(`Weighbridge ${fmtTonnes(t)} saved`);
      setEditing(false);
      onSaved();
    } catch (e: unknown) {
      toast.error((e as { message?: string } | null)?.message || "Couldn't save the tonnes");
    } finally { setBusy(false); }
  };
  return (
    <section className="bk-card" aria-labelledby="bk-wb-title">
      <div className="bk-card__head"><h2 className="bk-card__title" id="bk-wb-title">Weighbridge</h2></div>
      {b.awaiting_weighbridge && delivered && <p className="wb-flag" role="status">Awaiting weighbridge tonnes. The invoice uses planned tonnes until they are in.</p>}
      <div className="bk-kv"><span className="bk-kv__label">Planned</span><span className="bk-kv__value">{fmtTonnes(load.planned_tonnes)}</span></div>
      <div className="bk-kv"><span className="bk-kv__label">Weighed</span><span className={`bk-kv__value${load.actual_tonnes == null ? " bk-muted" : ""}`}>{load.actual_tonnes != null ? fmtTonnes(load.actual_tonnes) : "Not yet"}{load.weighbridge_slip && <span className="bk-kv__note">Slip {load.weighbridge_slip}</span>}</span></div>
      {b.min_tonnes != null && <div className="bk-kv"><span className="bk-kv__label">Minimum</span><span className="bk-kv__value">{fmtTonnes(b.min_tonnes)}</span></div>}
      <div className="bk-kv bk-kv--total"><span className="bk-kv__label">Billed</span><span className="bk-kv__value">{formatCurrency(b.amount)}<span className="bk-kv__note">{fmtTonnes(b.billable_tonnes)} × {fmtRatePerTonne(b.rate_per_tonne)}</span></span></div>
      {editing ? (
        <div className="wb-edit">
          <WeighbridgeFields tonnes={tonnes} slip={slip} onTonnes={setTonnes} onSlip={setSlip} planned={load.planned_tonnes} />
          <div className="wb-actions">
            <button type="button" className="bk-btn bk-btn--secondary" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            <button type="button" className="bk-btn bk-btn--primary" onClick={() => submit(parseTonnes(tonnes))} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
      ) : !disabled && (
        <div className="wb-actions">
          {load.actual_tonnes == null && load.planned_tonnes != null && delivered && (
            <button type="button" className="bk-btn bk-btn--secondary" onClick={() => submit(Number(load.planned_tonnes))} disabled={busy}>Confirm {fmtTonnes(load.planned_tonnes)}</button>
          )}
          <button type="button" className={`bk-btn ${load.actual_tonnes == null && delivered ? "bk-btn--primary" : "bk-btn--secondary"}`} onClick={() => setEditing(true)} disabled={busy}>
            {load.actual_tonnes == null ? "Enter tonnes" : "Change"}
          </button>
        </div>
      )}
    </section>
  );
}
