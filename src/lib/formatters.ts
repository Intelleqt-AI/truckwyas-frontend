// One number and date system for TruckWys (en-ZA).
//
//   formatMoney(20505.65)        "R 20 505,65"   tables, detail rows
//   formatMoneyWhole(20505.65)   "R 20 506"      tiles, headlines
//   formatCompact(7800)          "R 7,8k"        chart axes, tight labels ("R 1,2m")
//   formatCompact(7800, false)   "7,8k"
//   formatNumber(20505)          "20 505"
//   formatPercent(14.1)          "14,1%"         value in percent units
//   formatPercentage(0.141)      "14,1%"         value as a fraction
//   formatDays(31.9)             "31,9 days"
//   formatWeight(8)              "8,0 t"
//   formatDistance(1234)         "1 234 km"
//   formatDate("2026-04-05")     "5 Apr 2026"
//   formatDateShort(d)           "5 Apr"
//   formatDateTime(d)            "5 Apr 2026, 14:05"
//   formatMonth(d)               "Apr 2026"
//   normaliseFigures(text)       rewrites "R 20,505.65" / "R26,444" / "2026-06-05"
//                                inside free text (backend signal copy) to the above
//
// Thousands use a non-breaking space so a figure never wraps. Missing values
// render as "—" (the one allowed use of an em dash) in the new helpers.

const NBSP = ' ';
const MINUS = '−';
export const MISSING = '—';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Num = number | string | null | undefined;

const toNum = (v: Num): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Convert an en-US formatted numeric string ("1,234.5") to en-ZA ("1 234,5"). */
const zaify = (s: string) => s.replace(/,/g, '\u0000').replace(/\./g, ',').replace(/\u0000/g, NBSP);

/** Fixed-decimal en-ZA number, no sign handling beyond a true minus. */
const fixed = (n: number, decimals: number, minDecimals = decimals): string => {
  const abs = Math.abs(n);
  const s = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: decimals,
  }).format(abs);
  // Rounds to zero: never show "-0".
  const isZero = Number(abs.toFixed(decimals)) === 0;
  return `${n < 0 && !isZero ? MINUS : ''}${zaify(s)}`;
};

// ---------------------------------------------------------------- missing values

/** Placeholder words a backend or an old serializer may send for "no value". */
const EMPTY_WORDS = new Set(['none', 'null', 'undefined', 'nan', 'n/a']);

/**
 * THE rule for value cells (R3): never print "None", "null" or "undefined".
 *   valueOrDash(null)        "—"
 *   valueOrDash('None')      "—"
 *   valueOrDash('')          "—"
 *   valueOrDash(NaN)         "—"
 *   valueOrDash('Durban')    "Durban"
 *   valueOrDash(0)           "0"      (zero is a value, not missing)
 *   valueOrDash(v, formatMoney)  formats real values, dashes the rest
 */
export function valueOrDash<T>(
  value: T | null | undefined,
  format?: (v: T) => string,
): string {
  if (isMissingValue(value)) return MISSING;
  if (format) return format(value as T);
  return String(value);
}

/** True for null/undefined/''/NaN and the words "None", "null", "undefined", "NaN", "n/a". */
export const isMissingValue = (value: unknown): boolean => {
  if (value == null) return true;
  if (typeof value === 'number') return !Number.isFinite(value);
  if (typeof value === 'string') {
    const t = value.trim();
    return t === '' || EMPTY_WORDS.has(t.toLowerCase());
  }
  return false;
};

// ---------------------------------------------------------------- money

/** "R 20 505,65". Null/NaN -> "—". */
export const formatMoney = (value: Num, decimals = 2): string => {
  const n = toNum(value);
  if (n == null) return MISSING;
  const body = fixed(Math.abs(n), decimals);
  const neg = n < 0 && body.replace(/[0, ]/g, '') !== '';
  return `${neg ? MINUS : ''}R${NBSP}${body}`;
};

/** "R 20 506" (whole rands, for tiles and headlines). */
export const formatMoneyWhole = (value: Num): string => formatMoney(value, 0);

/** "R 950", "R 7,8k", "R 1,2m". Pass currency=false for "7,8k". */
export const formatCompact = (value: Num, currency = true): string => {
  const n = toNum(value);
  if (n == null) return MISSING;
  const abs = Math.abs(n);
  let body: string;
  if (abs >= 1_000_000) body = `${fixed(abs / 1_000_000, 1, 0)}m`;
  else if (abs >= 1_000) body = `${fixed(abs / 1_000, 1, 0)}k`;
  else body = fixed(abs, 0);
  if (body === `1${NBSP}000k`) body = '1m';
  const sign = n < 0 && body !== '0' ? MINUS : '';
  return currency ? `${sign}R${NBSP}${body}` : `${sign}${body}`;
};

/**
 * Legacy name, same output as formatMoney but 0 for missing values.
 * Accepts Intl digit options (minimum/maximumFractionDigits) only.
 */
export const formatCurrency = (
  amount: Num,
  options: Intl.NumberFormatOptions = {}
): string => {
  const n = toNum(amount) ?? 0;
  const max = options.maximumFractionDigits ?? 2;
  const min = options.minimumFractionDigits ?? Math.min(2, max);
  const body = fixed(Math.abs(n), max, Math.min(min, max));
  const neg = n < 0 && body.replace(/[0, ]/g, '') !== '';
  return `${neg ? MINUS : ''}R${NBSP}${body}`;
};

// ---------------------------------------------------------------- numbers

/** "20 505" / "31,9". Accepts Intl digit options (default: up to 3 decimals). Missing -> "0". */
export const formatNumber = (
  value: Num,
  options: Intl.NumberFormatOptions = {}
): string => {
  const n = toNum(value) ?? 0;
  const s = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: options.minimumFractionDigits,
    // Same default as Intl (up to 3 decimals) so existing callers keep their precision.
    maximumFractionDigits: options.maximumFractionDigits ?? Math.max(3, options.minimumFractionDigits ?? 0),
  }).format(Math.abs(n));
  const zero = Number(s.replace(/,/g, '')) === 0;
  return `${n < 0 && !zero ? MINUS : ''}${zaify(s)}`;
};

/** "7,8k" / "1,2m" (no currency). */
export const formatCompactNumber = (value: Num): string => formatCompact(value, false);

/** "14,1%" from a percent value (14.1). Missing -> "—". */
export const formatPercent = (value: Num, decimals = 1): string => {
  const n = toNum(value);
  if (n == null) return MISSING;
  return `${fixed(n, decimals)}%`;
};

/** "14,1%" from a fraction (0.141). Missing -> "—". */
export const formatPercentage = (value: Num, decimals = 1): string => {
  const n = toNum(value);
  if (n == null) return MISSING;
  return formatPercent(n * 100, decimals);
};

/** "31,9 days", "1 day", "12 days". Whole numbers show no decimal. */
export const formatDays = (value: Num, decimals?: number): string => {
  const n = toNum(value);
  if (n == null) return MISSING;
  const d = decimals ?? (Number.isInteger(n) ? 0 : 1);
  const body = fixed(n, d);
  return `${body}${NBSP}${body === '1' ? 'day' : 'days'}`;
};

/** "8,0 t" (tonnes, one decimal). */
export const formatWeight = (tonnes: Num, decimals = 1): string => {
  const n = toNum(tonnes);
  if (n == null) return MISSING;
  return `${fixed(n, decimals)}${NBSP}t`;
};

/** "1 234 km". */
export const formatDistance = (kilometres: Num): string => {
  const n = toNum(kilometres);
  if (n == null) return MISSING;
  return `${fixed(n, 0)}${NBSP}km`;
};

export const formatDuration = (hours: number): string => {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (wholeHours === 0) return `${minutes}m`;
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
};

// ---------------------------------------------------------------- dates

/** Parse Date | ISO string | "YYYY-MM-DD" (as a local calendar date). */
export const toDate = (date: string | number | Date | null | undefined): Date | null => {
  if (date == null || date === '') return null;
  if (date instanceof Date) return Number.isNaN(date.getTime()) ? null : date;
  if (typeof date === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * "5 Apr 2026". The optional Intl options are honoured for the parts they
 * name (year: undefined drops the year, hour/minute add a time).
 */
export const formatDate = (
  date: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string => {
  const d = toDate(date);
  if (!d) return MISSING;
  const showYear = !('year' in options) || options.year !== undefined;
  const showDay = !('day' in options) || options.day !== undefined;
  let out = `${showDay ? `${d.getDate()} ` : ''}${MONTHS[d.getMonth()]}${showYear ? ` ${d.getFullYear()}` : ''}`;
  if (options.hour || options.minute) out += `, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return out;
};

/** "5 Apr". */
export const formatDateShort = (date: string | number | Date | null | undefined): string => {
  const d = toDate(date);
  if (!d) return MISSING;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/**
 * "Sep" — the one short month form (never "Sept", which en-ZA/en-GB
 * toLocaleString emits). Takes a date or a 0-based month index. Use this
 * instead of toLocaleString(..., { month: 'short' }) for chart axes.
 */
export const formatMonthShort = (date: string | number | Date | null | undefined, isIndex = false): string => {
  if (isIndex && typeof date === 'number') return MONTHS[((date % 12) + 12) % 12];
  const d = toDate(date);
  if (!d) return MISSING;
  return MONTHS[d.getMonth()];
};

/** "Apr 2026". */
export const formatMonth = (date: string | number | Date | null | undefined): string => {
  const d = toDate(date);
  if (!d) return MISSING;
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** "5 Apr 2026, 14:05". */
export const formatDateTime = (date: string | number | Date | null | undefined): string =>
  formatDate(date, { hour: '2-digit', minute: '2-digit' });

export const formatRelativeTime = (date: string | Date): string => {
  const dateObj = toDate(date);
  if (!dateObj) return MISSING;
  const diffInSeconds = Math.floor((Date.now() - dateObj.getTime()) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return formatDate(dateObj);
};

// ---------------------------------------------------------------- free text

/**
 * Rewrite figures inside backend-generated text to the house format:
 *   "R 20,505.65" / "R20,505.65" / "R26,444" -> "R 20 505,65" / "R 26 444"
 *   "2026-06-05" (optionally with a time)    -> "5 Jun 2026"
 * Anything that does not match a known pattern is left as-is.
 */
export const normaliseFigures = (text: string | null | undefined): string => {
  if (!text) return '';
  let out = text.replace(/\b(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?\b/g, (m, y, mo, d) => {
    const month = Number(mo);
    const day = Number(d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return m;
    return `${day} ${MONTHS[month - 1]} ${y}`;
  });
  // One short month form: "Sept" -> "Sep".
  out = out.replace(/\bSept\b(?!ember)/g, 'Sep');
  // Money with an R prefix in en-US grouping: R 1,234 / R1,234.56 / R 12.50
  out = out.replace(/\bR\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?(?![\d,])/g, (_m, int: string, dec?: string) => {
    const n = Number(int.replace(/,/g, '') + (dec ?? ''));
    if (!Number.isFinite(n)) return _m;
    return formatMoney(n, dec ? 2 : 0);
  });
  // Bare percentages with a point decimal: 14.1% / 55.00%
  out = out.replace(/(\d+)\.(\d+)%/g, (_m, a: string, b: string) => formatPercent(Number(`${a}.${b}`), 1));
  return out;
};

// Generic words the backend Title-Cases in signal and notification titles.
// Only these are lowered, so names ("Tiger Brands Ltd"), IDs and acronyms stay.
const GENERIC_WORDS = new Set([
  'overdue', 'invoice', 'invoices', 'payment', 'payments', 'received', 'due', 'paid', 'unpaid',
  'vehicle', 'vehicles', 'truck', 'trucks', 'driver', 'drivers', 'idle', 'available', 'active', 'inactive',
  'load', 'loads', 'in', 'transit', 'delivered', 'delayed', 'late', 'on', 'the', 'road', 'of', 'to', 'for', 'and', 'at', 'is', 'are', 'a', 'an', 'by', 'with', 'from', 'now',
  'quote', 'quotes', 'accepted', 'declined', 'expired', 'sent', 'new', 'expense', 'expenses', 'approval', 'pending',
  'maintenance', 'service', 'licence', 'license', 'expiring', 'expires', 'soon', 'renewal', 'insurance',
  'margin', 'low', 'high', 'risk', 'alert', 'warning', 'reminder', 'days', 'day', 'customer', 'customers', 'cash',
  'fuel', 'price', 'up', 'down', 'increase', 'decrease', 'update', 'updated', 'created', 'assigned', 'unassigned',
  'booking', 'bookings', 'order', 'orders', 'status', 'changed', 'waiting', 'needs', 'attention', 'review',
]);

/**
 * Sentence case for machine-generated labels: "Invoice Overdue: INV-1" ->
 * "Invoice overdue: INV-1", "9 Vehicles Idle" -> "9 vehicles idle".
 * Only lowers known generic words; everything else is left as written.
 */
export const sentenceCaseLabel = (text: string | null | undefined): string => {
  if (!text) return '';
  let seenWord = false;
  return text.replace(/[A-Za-z0-9][A-Za-z0-9'-]*/g, (w) => {
    const first = !seenWord;
    seenWord = true;
    if (first) return /^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    const isTitle = /^[A-Z][a-z'-]+$/.test(w);
    return isTitle && GENERIC_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w;
  });
};

// ---------------------------------------------------------------- misc

export const formatConfidence = (confidence: number): string => `${Math.round(confidence * 100)}%`;

export const getConfidenceLevel = (confidence: number): 'high' | 'medium' | 'low' => {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
};
