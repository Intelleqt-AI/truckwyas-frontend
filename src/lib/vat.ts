/**
 * The price a quote or order is shown at everywhere: incl. VAT (15%, or 0%
 * for international transport), from the backend's customer_price
 * (core/services/quote_vat.py), so lists, detail pages and what the customer
 * is sent all show the same figure. Falls back to total_amount (excl. VAT)
 * only for an API response without the breakdown.
 */
export type CustomerPrice = { total_incl_vat?: string | number | null };

export function priceInclVat(row: { total_amount?: string | number | null; customer_price?: CustomerPrice | null } | null | undefined): number {
  const incl = row?.customer_price?.total_incl_vat;
  const n = parseFloat(String(incl ?? row?.total_amount ?? '0'));
  return Number.isFinite(n) ? n : 0;
}
