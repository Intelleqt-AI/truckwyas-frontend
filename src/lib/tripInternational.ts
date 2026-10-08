// Is this trip international? The route says so (cross_border / a non-SA
// country on it), or any picked point is outside South Africa. The server
// prices driver nights at the NBCRFLI cross-border allowance on an
// international trip, so every cost-breakdown call must carry this flag.
export const isForeignCountry = (code?: string | null) => !!code && !["ZA", "ZAF"].includes(code.toUpperCase());

export function tripIsInternational(route: { cross_border?: boolean | null; countries?: (string | null)[] | null } | null | undefined,
  pointCountries: (string | null | undefined)[]): boolean {
  return !!route?.cross_border || (route?.countries || []).some((c) => isForeignCountry(c)) || pointCountries.some((c) => isForeignCountry(c));
}
