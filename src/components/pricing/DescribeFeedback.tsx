import type { RefObject } from "react";
import { MAX_RECORDING_SECONDS } from "@/hooks/useVoiceRecorder";
import {
  vt, heardBadge, buildFillChips, listeningLangLine, replaceQuestion, randPerL, vehicleHintName,
  type UiLang, type VoiceLangMode, type FieldTarget, type ConflictLine, type FillInfo,
} from "@/lib/voiceQuote";

/** While recording: "Listening…", the language line, the time as text, and the level. */
export function VoiceListening({ lang, mode, levels, elapsed, remaining, reducedMotion }: {
  lang: UiLang; mode: VoiceLangMode; levels: number[]; elapsed: number; remaining: number | null; reducedMotion: boolean;
}) {
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const level = levels.reduce((a, b) => a + b, 0) / Math.max(1, levels.length); // 4..32
  return (
    <div className="qb-voice">
      <span className="qb-voice__dot" aria-hidden="true" />
      <span className="qb-voice__text">
        <span className="qb-voice__title">{vt(lang, "listening")}</span>
        <span className="qb-voice__lang">{listeningLangLine(mode, lang)}</span>
      </span>
      {reducedMotion ? (
        // No moving bars: one static dot whose size follows the level.
        <span className="qb-voice__level" aria-hidden="true"><span style={{ transform: `scale(${0.5 + Math.min(1, level / 24) * 0.5})` }} /></span>
      ) : (
        <span className="qb-voice__bars" aria-hidden="true">
          {levels.map((h, i) => <span key={i} style={{ height: h }} />)}
        </span>
      )}
      <span className={`qb-voice__time${remaining != null ? " is-ending" : ""}`}>
        {remaining != null ? vt(lang, "seconds_left", { s: remaining }) : mmss}
        <span className="qb-sr"> / {MAX_RECORDING_SECONDS} s</span>
      </span>
    </div>
  );
}

/**
 * Under the Describe bar after a Fill: what was heard, one chip per field set
 * (low confidence: dotted underline + "Check this"), Undo for 8 s, what wasn't
 * understood, price-basis suggestions (never applied silently), and the inline
 * Replace / Keep mine confirm for the user's own values.
 */
export function DescribeFeedback(p: {
  lang: UiLang;
  heard: { label: string | null; confidence: string | null } | null;
  stoppedAtLimit: boolean;
  info: FillInfo | null;
  conflict: ConflictLine[] | null;
  replaceRef: RefObject<HTMLButtonElement>;
  onReplace: () => void; onKeep: () => void;
  undo: boolean; onUndo: () => void;
  onChip: (t: FieldTarget) => void; onPickTruck: () => void;
  driverRate: number | null;
  onApplyNights: (n: number) => void; onUseFuel: (price: number) => void;
}) {
  const { lang, info } = p;
  const chips = info ? buildFillChips(info.applied, info.conf, lang) : [];
  const badge = p.heard ? heardBadge(lang, p.heard.label, p.heard.confidence) : null;
  const nights = info?.driverNights ?? null;
  const fuel = info?.fuelPrice ?? null;
  const hasRow = badge || p.stoppedAtLimit || chips.length || p.undo || info?.vehicleHint;
  if (!hasRow && !info?.didntCatch && !p.conflict?.length && !nights && !fuel) return null;
  return (
    <div className="qb-nlfb">
      {hasRow ? (
        <div className="qb-nlfb__row">
          {p.stoppedAtLimit && <span className="qb-nlfb__badge">{vt(lang, "too_long")}</span>}
          {badge && <span className="qb-nlfb__badge">{badge}</span>}
          {chips.length > 0 && <span className="qb-nlfb__label" aria-hidden="true">{vt(lang, "filled")}</span>}
          {chips.map(c => (
            <button key={c.key} type="button" className={`qb-nlfb__chip${c.check ? " is-check" : ""}`}
              aria-label={c.aria} title={c.check ? vt(lang, "check_this") : undefined} onClick={() => p.onChip(c.target)}>
              {c.text}{c.check && <span className="qb-nlfb__check" aria-hidden="true">{vt(lang, "check_this")}</span>}
            </button>
          ))}
          {info?.vehicleHint && (
            <button type="button" className="qb-nlfb__chip qb-nlfb__chip--ask" onClick={p.onPickTruck}>
              {vt(lang, "pick_truck", { hint: vehicleHintName(info.vehicleHint) })}
            </button>
          )}
          {p.undo && <button type="button" className="qb-linkbtn qb-nlfb__undo" onClick={p.onUndo}>{vt(lang, "undo")}</button>}
        </div>
      ) : null}
      {info?.didntCatch && <p className="qb-nlfb__muted">{info.didntCatch}</p>}
      {(nights || fuel) ? (
        <div className="qb-nlfb__row">
          {nights ? (
            p.driverRate != null ? (
              <span className="qb-nlfb__suggest">
                {nights === 1 ? vt(lang, "night_apply") : vt(lang, "nights_apply", { n: nights })} —
                <button type="button" className="qb-linkbtn" onClick={() => p.onApplyNights(nights)}>{vt(lang, "apply")}</button>
              </span>
            ) : <span className="qb-nlfb__suggest">{nights === 1 ? vt(lang, "night_apply") : vt(lang, "nights_apply", { n: nights })}</span>
          ) : null}
          {fuel ? (
            <span className="qb-nlfb__suggest">
              {vt(lang, "diesel_use", { price: randPerL(fuel) })} —
              <button type="button" className="qb-linkbtn" onClick={() => p.onUseFuel(fuel)}>{vt(lang, "use_quote")}</button>
            </span>
          ) : null}
        </div>
      ) : null}
      {p.conflict?.length ? (
        <div className="qb-nlfb__confirm" role="group" aria-label={replaceQuestion(p.conflict, lang)}>
          <span className="qb-nlfb__q">{replaceQuestion(p.conflict, lang)}</span>
          <span className="qb-nlfb__actions">
            <button ref={p.replaceRef} type="button" className="tw-btn tw-btn--primary qb-nlfb__btn" onClick={p.onReplace}>{vt(lang, "replace")}</button>
            <button type="button" className="tw-btn qb-nlfb__btn" onClick={p.onKeep}>{vt(lang, "keep")}</button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
