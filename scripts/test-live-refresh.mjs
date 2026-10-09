// Run: node --experimental-strip-types scripts/test-live-refresh.mjs
// Live updates must have bounded request counts: a burst of live events, a
// failing API, a websocket that can't connect, and one that keeps flapping.
// (A tester measured ~9,900 requests in 10 minutes from one tab before this.)
import assert from "node:assert/strict";
import { createCoalescedRefresh } from "../src/lib/liveRefresh.ts";
import { createLiveSocket } from "../src/lib/liveSocket.ts";

// ---- fake clock + visibility -------------------------------------------
function makeEnv() {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  let hidden = false;
  const visibleSubs = new Set();
  const clock = {
    now: () => now,
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + Math.max(0, ms), fn, id }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
  };
  const visibility = {
    isHidden: () => hidden,
    onVisible: (cb) => { visibleSubs.add(cb); return () => visibleSubs.delete(cb); },
  };
  const tick = () => new Promise((r) => setImmediate(r));
  async function advanceTo(target) {
    for (;;) {
      await tick();
      let next = null;
      for (const t of timers.values()) if (t.at <= target && (!next || t.at < next.at || (t.at === next.at && t.id < next.id))) next = t;
      if (!next) break;
      timers.delete(next.id);
      now = next.at;
      next.fn();
    }
    now = target;
    await tick();
  }
  return {
    clock, visibility,
    get now() { return now; },
    advance: (ms) => advanceTo(now + ms),
    advanceTo,
    setHidden: (h) => { hidden = h; if (!h) for (const cb of [...visibleSubs]) cb(); },
  };
}

const MIN = 60_000;

// ---- 1. a burst of live events is a handful of refreshes, not one each ----
{
  const env = makeEnv();
  let requests = 0; // the bell makes 2 HTTP requests per refresh
  const r = createCoalescedRefresh(() => { requests += 2; }, { clock: env.clock, visibility: env.visibility });
  for (let i = 0; i < 200; i++) { r.request(); await env.advance(50); } // 200 events in 10s
  await env.advance(10_000);
  // Before: 200 events x 2 requests = 400. Now: one refresh per maxWait (5s) at most, plus the trailing one.
  assert.ok(requests <= 8, `burst: ${requests} requests`);
  assert.ok(requests >= 2, "burst still refreshes");
  const afterBurst = requests;
  await env.advance(2 * MIN);
  assert.equal(requests, afterBurst, "idle: no requests");
  r.dispose();
  console.log(`burst of 200 live events -> ${afterBurst} requests (was 400)`);
}

// ---- 2. a refresh in flight absorbs every event that lands meanwhile -----
{
  const env = makeEnv();
  let runs = 0; let concurrent = 0; let maxConcurrent = 0;
  const r = createCoalescedRefresh(async () => {
    runs++; concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise((res) => env.clock.setTimeout(res, 4000)); // slow API
    concurrent--;
  }, { clock: env.clock, visibility: env.visibility });
  r.request({ immediate: true });
  await env.advance(10);
  for (let i = 0; i < 50; i++) { r.request(); await env.advance(50); }
  await env.advance(30_000);
  assert.equal(maxConcurrent, 1, "single flight");
  assert.equal(runs, 2, "one follow-up for everything that arrived mid-flight");
  r.dispose();
}

// ---- 3. a failing API (429 / 500) backs off under a constant event stream ----
for (const status of [429, 500]) {
  const env = makeEnv();
  let runs = 0;
  const r = createCoalescedRefresh(() => { runs++; const e = new Error("fail"); e.status = status; throw e; },
    { clock: env.clock, visibility: env.visibility });
  // An event every 200ms for 10 minutes = 3,000 events.
  for (let t = 0; t < 10 * MIN; t += 200) { r.request(); await env.advance(200); }
  const bound = status === 429 ? 22 : 16; // 429: >=30s apart; 500: 2,4,8,...,60s
  assert.ok(runs <= bound, `${status}: ${runs} runs in 10 min`);
  r.dispose();
  console.log(`failing API (${status}), 3,000 events in 10 min -> ${runs} refreshes`);
}

// ---- 4. retries after a failure are capped without new events ------------
{
  const env = makeEnv();
  let runs = 0;
  const r = createCoalescedRefresh(() => { runs++; throw Object.assign(new Error("x"), { status: 503 }); },
    { clock: env.clock, visibility: env.visibility });
  r.request({ immediate: true });
  await env.advance(30 * MIN);
  assert.equal(runs, 4, "1 run + 3 backed-off retries, then it waits for the next event");
  r.dispose();
}

// ---- 5. hidden tab: nothing runs; one refresh when visible again ---------
{
  const env = makeEnv();
  let runs = 0;
  const r = createCoalescedRefresh(() => { runs++; }, { clock: env.clock, visibility: env.visibility });
  env.setHidden(true);
  for (let i = 0; i < 100; i++) { r.request(); await env.advance(1000); }
  assert.equal(runs, 0, "no refresh while hidden");
  env.setHidden(false);
  await env.advance(5000);
  assert.equal(runs, 1, "exactly one catch-up refresh when shown");
  r.dispose();
}

// ---- websocket fakes ------------------------------------------------------
function socketHarness(env, behaviour) {
  const stats = { created: 0, catchUps: 0, pings: 0 };
  const createSocket = () => {
    stats.created++;
    const s = { readyState: 0, onopen: null, onclose: null, onerror: null, onmessage: null,
      send: (d) => { if (JSON.parse(d).type === "ping") stats.pings++; },
      close: () => { if (s.readyState === 3) return; s.readyState = 3; env.clock.setTimeout(() => s.onclose?.(), 0); } };
    behaviour(s);
    return s;
  };
  return { stats, createSocket };
}
const refused = (env) => (s) => env.clock.setTimeout(() => { s.readyState = 3; s.onerror?.(); }, 5);
const flapping = (env) => (s) => env.clock.setTimeout(() => {
  s.readyState = 1; s.onopen?.();
  env.clock.setTimeout(() => s.close(), 200); // accepted, then dropped
}, 5);

// ---- 6. a websocket that can't connect backs off to one try per ~30s -----
{
  const env = makeEnv();
  const { stats, createSocket } = socketHarness(env, refused(env));
  const sock = createLiveSocket({ url: () => "ws://x/ws/events/", createSocket, onMessage() {},
    onReconnect: () => stats.catchUps++, random: () => 0, clock: env.clock, visibility: env.visibility });
  sock.start();
  await env.advance(10 * MIN);
  // random=0 is the shortest jitter (half the ceiling): 15s apart once capped.
  assert.ok(stats.created <= 45, `refused ws: ${stats.created} attempts in 10 min`);
  assert.equal(stats.catchUps, 0);
  sock.stop();
  const after = stats.created;
  await env.advance(10 * MIN);
  assert.equal(stats.created, after, "stop() ends the loop");
  console.log(`websocket refused for 10 min -> ${after} connection attempts, 0 HTTP refreshes`);
}

// ---- 7. a socket that opens then drops: backoff keeps growing, catch-up throttled ----
{
  const env = makeEnv();
  const { stats, createSocket } = socketHarness(env, flapping(env));
  const sock = createLiveSocket({ url: () => "ws://x/ws/events/", createSocket, onMessage() {},
    onReconnect: () => stats.catchUps++, random: () => 0, clock: env.clock, visibility: env.visibility });
  sock.start();
  await env.advance(10 * MIN);
  // Before: backoff reset on every open -> a reconnect ~every 1.2s (~500 in 10 min),
  // each one refetching every live query on screen (measured: ~22 GETs each).
  assert.ok(stats.created <= 45, `flapping ws: ${stats.created} reconnects`);
  assert.ok(stats.catchUps <= 11, `flapping ws: ${stats.catchUps} catch-up refreshes`);
  sock.stop();
  console.log(`websocket flapping for 10 min -> ${stats.created} reconnects, ${stats.catchUps} catch-up refreshes`);
}

// ---- 8. a socket that stayed up earns a fresh, fast reconnect -------------
{
  const env = makeEnv();
  let sockets = [];
  const { stats, createSocket } = socketHarness(env, (s) => { sockets.push(s); env.clock.setTimeout(() => { s.readyState = 1; s.onopen?.(); }, 5); });
  const sock = createLiveSocket({ url: () => "ws://x", createSocket, onMessage() {},
    onReconnect: () => stats.catchUps++, random: () => 1, clock: env.clock, visibility: env.visibility });
  sock.start();
  await env.advance(MIN);
  assert.ok(stats.pings >= 2, "keep-alive pings while open");
  sockets.at(-1).close();
  await env.advance(1500);
  assert.equal(stats.created, 2, "reconnected within ~1s after a long-lived socket dropped");
  assert.equal(stats.catchUps, 1, "one catch-up after the gap");
  sock.stop();
}

// ---- 9. no reconnecting while the tab is hidden ---------------------------
{
  const env = makeEnv();
  const { stats, createSocket } = socketHarness(env, refused(env));
  const sock = createLiveSocket({ url: () => "ws://x", createSocket, onMessage() {},
    random: () => 1, clock: env.clock, visibility: env.visibility });
  env.setHidden(true);
  sock.start(); // first attempt still happens (page load)
  await env.advance(10 * MIN);
  assert.equal(stats.created, 1, "hidden: no reconnect attempts");
  env.setHidden(false);
  await env.advance(1500); // first retry ~1s; the next is >=2s later
  assert.equal(stats.created, 2, "reconnects when shown");
  sock.stop();
}

console.log("liveRefresh/liveSocket: 9 cases passed");
