import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { caretAfterGroup, formatFieldValue, groupTyped, parseTyped } from "./numberText";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "defaultValue"> & {
  /** The figure the field holds (null: empty). */
  value: number | null;
  /** Every keystroke: the number the text means (null when empty or not a number yet). */
  onValue: (n: number | null, text: string) => void;
  /** "auto": whole numbers bare, cents when present; 2: always two decimals ("24,00"); 0: whole rand shown. */
  decimals?: "auto" | 2 | 0;
};

/**
 * A money or rate field in house format: NBSP thousands groups and a decimal
 * comma, regrouped live while typing with the caret kept on its digit.
 * Accepts "," or "." as the decimal separator. The number handed back is
 * exactly what was typed (no rounding), so any engine reading it is unchanged.
 */
export const NumberField = forwardRef<HTMLInputElement, Props>(function NumberField(
  { value, onValue, decimals = "auto", onFocus, onBlur, ...rest }, fwd,
) {
  const ref = useRef<HTMLInputElement>(null);
  useImperativeHandle(fwd, () => ref.current as HTMLInputElement);
  const [draft, setDraft] = useState<string | null>(null);
  const caret = useRef<number | null>(null);
  // Typed since focus: the deferred select-all must never swallow a keystroke.
  const typed = useRef(false);
  useLayoutEffect(() => {
    if (caret.current != null && ref.current && document.activeElement === ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });
  const shown = value == null ? "" : formatFieldValue(value, decimals);
  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={draft ?? shown}
      onFocus={(e) => {
        setDraft(shown);
        typed.current = false;
        const el = e.currentTarget;
        el.select();
        requestAnimationFrame(() => { if (document.activeElement === el && !typed.current) el.select(); });
        onFocus?.(e);
      }}
      onBlur={(e) => { setDraft(null); onBlur?.(e); }}
      onChange={(e) => {
        typed.current = true;
        const raw = e.target.value;
        const grouped = groupTyped(raw);
        caret.current = caretAfterGroup(raw, e.target.selectionStart ?? raw.length, grouped);
        setDraft(grouped);
        onValue(parseTyped(raw), raw);
      }}
    />
  );
});
