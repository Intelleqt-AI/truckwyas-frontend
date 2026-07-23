/** Web Push subscription management.
 *
 * Registers /sw.js, asks for Notification permission (must be called from a
 * user gesture), subscribes with the server's VAPID key and registers the
 * subscription with the backend. Used by the Notification Settings page when
 * a push toggle is enabled.
 */
import { fetchData, postData, deleteData } from "@/lib/Api";

export type PushStatus =
  | "unsupported"
  | "denied"
  | "not-subscribed"
  | "subscribed"
  | "server-not-configured";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const buf = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf;
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub ? "subscribed" : "not-subscribed";
}

/** Ensure this browser is subscribed. Call from a user gesture (toggle/save).
 *  Returns the resulting status. */
export async function enablePush(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";

  let vapid: any;
  try {
    vapid = await fetchData("/api/v1/push/vapid-key/");
  } catch (e: any) {
    if (e?.status === 503) return "server-not-configured";
    throw e;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.public_key),
    });
  }
  await postData({ url: "/api/v1/push/subscriptions/", data: sub.toJSON() });
  return "subscribed";
}

/** Remove this browser's subscription (all push toggles turned off). */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  try {
    await deleteData({ url: "/api/v1/push/subscriptions/", data: { endpoint } });
  } catch {
    /* backend prunes dead endpoints on next push anyway */
  }
}
