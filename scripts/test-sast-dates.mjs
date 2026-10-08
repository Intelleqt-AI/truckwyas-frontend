// Run: TZ=UTC node --experimental-strip-types scripts/test-sast-dates.mjs
// Dates read in SAST whatever the browser's zone (list, board and detail agree).
import assert from "node:assert/strict";
import { formatDate, formatDateShort, formatDateTime } from "../src/lib/formatters.ts";

// 22:30 UTC on 7 Oct is 00:30 SAST on 8 Oct.
assert.equal(formatDate("2026-10-07T22:30:00Z"), "8 Oct 2026");
assert.equal(formatDateShort("2026-10-07T22:30:00Z"), "8 Oct");
assert.equal(formatDateTime("2026-10-07T22:30:00Z"), "8 Oct 2026, 00:30");
assert.equal(formatDate("2026-10-07T23:59:00+02:00"), "7 Oct 2026");
// A plain calendar date is read as written.
assert.equal(formatDate("2026-10-13"), "13 Oct 2026");
console.log("SAST dates: 5 cases passed");
