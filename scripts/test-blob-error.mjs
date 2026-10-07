// Run: node --experimental-strip-types scripts/test-blob-error.mjs
// Blob error bodies (PDF / downloads) read back into a message.
import assert from "node:assert/strict";
import { readBlobError } from "../src/lib/blobError.ts";

const json = (o) => new Blob([JSON.stringify(o)], { type: "application/json" });
const blocked = await readBlobError(json({ error: "This quote can't be sent yet: tolls could not be worked out.", code: "quote_send_blocked",
  warnings: [{ code: "diesel_period_changed", severity: "warn", title: "Priced on an earlier diesel price" },
    { code: "check_failed", severity: "block", title: "Couldn't check this quote" }], blocking: ["check_failed"] }));
assert.equal(blocked.message, "Couldn't check this quote");
assert.equal(blocked.data.code, "quote_send_blocked");
assert.equal((await readBlobError(json({ detail: "Not found." }))).message, "Not found.");
assert.equal((await readBlobError(json({ weight: ["Too heavy"] }))).message, "Too heavy");
assert.equal((await readBlobError(new Blob(["<html>500</html>"]))).message, null);
assert.equal((await readBlobError(new Blob(["Bad gateway"]))).message, "Bad gateway");
assert.equal(await readBlobError(null), null);
assert.equal(await readBlobError({ error: "already parsed" }), null);
console.log("blobError: 7 cases passed");
