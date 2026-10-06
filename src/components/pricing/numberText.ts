/**
 * Typed money and rate fields (price bar, build-up inputs): one parser and
 * one live grouping rule, so "14000" reads "14 000" on every keystroke and
 * "24.5" or "24,5" both mean twenty-four rand fifty.
 *
 * Parsing (SPEC R5 B-2.5): strip "R", spaces and NBSP. A "," or "." followed
 * by 1–2 digits at the end (or a trailing separator, mid-typing) is the
 * decimal separator; any other "," or "." groups thousands and is ignored.
 * At most 2 decimals. Display: NBSP thousands groups, decimal comma.
 */
const NBSP = " ";

interface Split { int: string; dec: string | null }

function split(text: string): Split | null {
  const s = text.replace(/[R\s ]/g, "");
  if (s === "") return null;
  if (!/^[\d.,]*$/.test(s)) return null;
  const m = s.match(/^(.*?)[.,](\d{0,2})$/);
  // A trailing separator with 1–2 digits (or none yet) is the decimal point,
  // unless what precedes it is empty.
  if (m && (/\d/.test(m[1]) || m[2].length > 0) && !(m[2].length === 0 && /[.,]$/.test(m[1]))) {
    return { int: m[1].replace(/[.,]/g, ""), dec: m[2] };
  }
  return { int: s.replace(/[.,]/g, ""), dec: null };
}

/** The number a typed text means, or null when it means nothing yet. */
export function parseTyped(text: string): number | null {
  const p = split(text);
  if (!p || (p.int === "" && !p.dec)) return null;
  const n = Number(`${p.int || "0"}.${p.dec || "0"}`);
  return Number.isFinite(n) ? n : null;
}

const group = (digits: string) => {
  const d = digits.replace(/^0+(?=\d)/, "");
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
};

/** Regroup a typed text live: "14000" → "14 000", "24999,9" → "24 999,9". */
export function groupTyped(text: string): string {
  const p = split(text);
  if (!p) return text.replace(/[^\d.,\s ]/g, "");
  return `${group(p.int || (p.dec != null ? "0" : ""))}${p.dec != null ? `,${p.dec}` : ""}`;
}

/** Where the caret goes after regrouping: after the same number of digits
 *  (and the decimal comma) as it was in the raw text. */
export function caretAfterGroup(raw: string, rawCaret: number, grouped: string): number {
  const significant = (ch: string) => /[\d,.]/.test(ch);
  let count = 0;
  for (let i = 0; i < rawCaret && i < raw.length; i++) if (significant(raw[i])) count++;
  // Leading zeros dropped by grouping are not counted.
  if (count === 0) return 0;
  let seen = 0;
  for (let i = 0; i < grouped.length; i++) {
    if (significant(grouped[i])) seen++;
    if (seen >= count) return i + 1;
  }
  return grouped.length;
}

/** A settled figure for a field: whole numbers without decimals, cents with 2. */
export function formatFieldValue(n: number, decimals: "auto" | 2 = "auto"): string {
  if (!Number.isFinite(n)) return "";
  const cents = Math.round(Math.abs(n) * 100);
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  const sign = n < 0 && cents > 0 ? "−" : "";
  const body = group(String(whole));
  if (decimals === 2 || rest !== 0) return `${sign}${body},${String(rest).padStart(2, "0")}`;
  return `${sign}${body}`;
}
