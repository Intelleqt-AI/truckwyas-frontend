/**
 * Calendar date (YYYY-MM-DD) in the user's local time zone.
 * `toISOString()` converts to UTC first, which in SAST turns midnight on the
 * 1st into the last day of the previous month.
 */
export function localDateISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
