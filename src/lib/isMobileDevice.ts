// Coarse UA-based mobile check, used to decide whether to route someone into
// the web -> app auth handoff (/open-app) after signup/login, and which app
// store badge to show if the handoff link doesn't open anything (see
// OpenInApp's install-detection fallback). Deliberately conservative — a
// false positive would send a desktop user to a page that links to a custom
// scheme their browser can't open, so this only matches the UA tokens real
// phone browsers actually send.
export function getMobilePlatform(): 'ios' | 'android' | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return null;
}

export function isMobileDevice(): boolean {
  return getMobilePlatform() !== null;
}
