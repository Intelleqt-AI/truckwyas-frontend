// Run: node --experimental-strip-types scripts/test-demo-snapshot.mjs
// The demo snapshot answers only a demo login's GETs, hands out copies, and
// stops after the visitor's first write; a real login never loads it.
import assert from "node:assert/strict";

const store = new Map();
globalThis.window = {};
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const signIn = (token, user) => { store.set("access", token); store.set("user", JSON.stringify(user)); };

const snap = await import("../src/lib/demoSnapshot.ts");
const SNAPSHOT = { built_at: "x", responses: { "api/v1/loads/?page_size=100": { count: 1, results: [{ id: 7 }] } } };
let loads = 0;
const load = async () => { loads += 1; return SNAPSHOT; };

// A real user: never loads the snapshot, always reads live.
signIn("real-token", { username: "owner@fleet.test", is_demo: false });
assert.equal(await snap.fromDemoSnapshot("api/v1/loads/?page_size=100", load), undefined);
assert.equal(loads, 0, "real user never fetches the snapshot");

// The demo: one load, answers by exact path (any spelling), as a copy.
signIn("demo-token", { username: "demo@truckwys.com", is_demo: true });
const a = await snap.fromDemoSnapshot("/api/v1/loads/?page_size=100", load);
assert.deepEqual(a, SNAPSHOT.responses["api/v1/loads/?page_size=100"]);
a.results[0].id = 99;
const b = await snap.fromDemoSnapshot("http://localhost:8001/api/v1/loads/?page_size=100", load);
assert.equal(b.results[0].id, 7, "callers get copies");
assert.equal(loads, 1, "loaded once per sign-in");
assert.equal(await snap.fromDemoSnapshot("api/v1/invoices/?page_size=100", load), undefined, "not in snapshot: live");

// The visitor's first change: live from then on.
snap.demoWriteHappened();
assert.equal(await snap.fromDemoSnapshot("api/v1/loads/?page_size=100", load), undefined);

// A new demo sign-in starts fresh; a missing snapshot (404) means live.
signIn("demo-token-2", { username: "demo@truckwys.com", is_demo: true });
assert.deepEqual(await snap.fromDemoSnapshot("api/v1/loads/?page_size=100", load), SNAPSHOT.responses["api/v1/loads/?page_size=100"]);
assert.equal(loads, 2);
signIn("demo-token-3", { username: "demo@truckwys.com", is_demo: true });
assert.equal(await snap.fromDemoSnapshot("api/v1/loads/?page_size=100", async () => null), undefined, "404: live");
assert.equal(await snap.fromDemoSnapshot("api/v1/loads/?page_size=100", load), undefined, "stays live after a 404");

// Back to a real user in the same tab: never served.
signIn("real-token-2", { username: "owner@fleet.test" });
assert.equal(await snap.fromDemoSnapshot("api/v1/loads/?page_size=100", load), undefined);
assert.equal(snap.snapshotKey("/api/v1/quotes/?limit=5"), "api/v1/quotes/?limit=5");
console.log("demoSnapshot: 12 checks passed");
