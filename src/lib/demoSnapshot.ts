/**
 * The public demo's pages from one pre-built response (backend
 * core.services.demo_snapshot: GET api/v1/demo/snapshot/).
 *
 * Every demo visitor signs in as the same fixed company, so the server builds
 * what its pages read once per reset and hands it over in one request
 * (~0.5 MB gzipped) instead of ~60 calls and ~6 MB per visit. fetchData
 * (lib/Api) asks here first:
 *
 *  - Only for a demo login (the stored user's is_demo). Every other user's
 *    reads never touch this module.
 *  - A GET whose exact path is in the snapshot is answered from it (a copy,
 *    so no screen can change the shared one); anything else goes to the API.
 *  - The visitor's first write (any non-GET) switches it off for the rest of
 *    the visit, so what they add reads back live. A missing or out-of-date
 *    snapshot (404) also just means "read live".
 */

type Snapshot = Map<string, unknown>;

let snapshot: Snapshot | null = null;
let pending: Promise<Snapshot | null> | null = null;
let forToken: string | null = null;
let off = false;

let userRaw: string | null = null;
let userIsDemo = false;

function storage(key: string): string | null {
  try { return typeof window === 'undefined' ? null : localStorage.getItem(key); } catch { return null; }
}

/** Signed in as the public demo company? (parsed once per stored user) */
export function isDemoSession(): boolean {
  const raw = storage('user');
  if (raw !== userRaw) {
    userRaw = raw;
    try { userIsDemo = !!(raw && JSON.parse(raw)?.is_demo); } catch { userIsDemo = false; }
  }
  return userIsDemo;
}

/** 'api/v1/x/?a=1' for any spelling the app uses (leading slash, absolute). */
export function snapshotKey(url: string): string {
  let u = url;
  const at = u.indexOf('/api/');
  if (/^https?:\/\//.test(u) && at >= 0) u = u.slice(at);
  return u.replace(/^\/+/, '');
}

function reset(token: string | null) {
  snapshot = null;
  pending = null;
  off = false;
  forToken = token;
}

/** The visitor changed something: read live from now on. */
export function demoWriteHappened() {
  off = true;
  snapshot = null;
}

/**
 * A copy of the snapshot's answer for this GET, or undefined to fetch live.
 * `load` fetches the snapshot itself (once per sign-in).
 */
export async function fromDemoSnapshot(
  url: string, load: () => Promise<Record<string, unknown> | null>,
): Promise<unknown | undefined> {
  if (!isDemoSession()) return undefined;
  const token = storage('access');
  if (token !== forToken) reset(token);
  if (off) return undefined;
  if (!snapshot) {
    pending ??= load()
      .then(body => {
        const responses = body?.responses as Record<string, unknown> | undefined;
        return responses ? new Map(Object.entries(responses)) : null;
      })
      .catch(() => null);
    const loaded = await pending;
    if (!loaded || off || token !== forToken) {
      if (!loaded) off = true;
      return undefined;
    }
    snapshot = loaded;
  }
  const key = snapshotKey(url);
  if (!snapshot.has(key)) return undefined;
  return structuredClone(snapshot.get(key));
}
