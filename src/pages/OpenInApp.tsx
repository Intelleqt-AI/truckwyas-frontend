import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postData } from '@/lib/Api';
import { postLoginNavigate } from '@/lib/postLogin';
import { getMobilePlatform } from '@/lib/isMobileDevice';

// The code is only valid for 60s server-side (see AuthHandoffExchangeView) —
// this is a little under that so "Get a new link" appears before a tap could
// actually fail against an already-expired code.
const CODE_LIFETIME_MS = 50_000;

// How long we wait, after the user taps the app link, before assuming the app
// isn't installed. The OS hides this page near-instantly on a real handoff;
// anything left visible past this is the app never having taken the tap.
const INSTALL_DETECTION_MS = 2_500;

const APP_STORE_URL = 'https://apps.apple.com/app/id6796449044';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=za.co.truckwys.mobile';

// Web -> app auth handoff: mints a single-use code and links to
// truckwys://auth/callback?code=..., which the (already-signed-in) mobile app
// exchanges for its own session — see useAuthHandoff in truckwys-app. Reached
// from SignupComplete (mobile) and postLoginNavigate (mobile login/2FA).
//
// The link below is a real <a href>, not a programmatic redirect: mobile
// browsers block script-initiated navigation to a custom scheme, so it has to
// be something the user actually taps.
export const OpenInApp = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [minting, setMinting] = useState(true);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Guards a mint in flight against a component unmount (StrictMode isn't on
  // for this app, but this is cheap insurance regardless).
  const cancelledRef = useRef(false);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  // Holds whatever needs tearing down for the currently-armed install-not-
  // detected check (the timer plus its two listeners) — null when nothing's
  // armed. A ref rather than state since it's plumbing, not something that
  // should trigger a render.
  const detectionCleanupRef = useRef<(() => void) | null>(null);
  const clearInstallDetection = useCallback(() => {
    detectionCleanupRef.current?.();
    detectionCleanupRef.current = null;
  }, []);

  // Arms a one-shot check: if the page is still visible INSTALL_DETECTION_MS
  // after the tap, the OS never handed off to the app, so it's reasonable to
  // assume it isn't installed and offer the store link instead. Deliberately
  // never auto-redirects to a store — iOS sometimes shows its own "Open in
  // Truckwys?" confirmation without hiding the page, and a false positive
  // there should cost nothing worse than an extra line of text.
  const armInstallDetection = useCallback(() => {
    clearInstallDetection();
    setShowInstallPrompt(false);
    const timer = window.setTimeout(() => {
      setShowInstallPrompt(true);
      clearInstallDetection();
    }, INSTALL_DETECTION_MS);
    const onVisibilityChange = () => {
      if (document.hidden) clearInstallDetection();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', clearInstallDetection);
    detectionCleanupRef.current = () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', clearInstallDetection);
    };
  }, [clearInstallDetection]);

  useEffect(() => () => clearInstallDetection(), [clearInstallDetection]);

  const mint = useCallback(async () => {
    clearInstallDetection();
    setShowInstallPrompt(false);
    setMinting(true);
    setError('');
    setCode(null); // clear any stale (dead) link immediately, not just on success
    try {
      const data = (await postData({ url: 'api/v1/auth/handoff/', data: {} })) as { code: string };
      if (cancelledRef.current) return;
      setCode(data.code);
    } catch (err: unknown) {
      if (cancelledRef.current) return;
      const e = err as { data?: { detail?: string }; message?: string };
      setError(e?.data?.detail || e?.message || 'Could not prepare the app link. Please try again.');
    } finally {
      if (!cancelledRef.current) setMinting(false);
    }
  }, [clearInstallDetection]);

  useEffect(() => {
    mint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Own effect, keyed on `code` — so re-minting resets the countdown instead
  // of the new link inheriting the old one's remaining time (or none at all).
  useEffect(() => {
    if (!code) return;
    setExpired(false);
    const timer = setTimeout(() => setExpired(true), CODE_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [code]);

  const continueInBrowser = () => {
    // allowAppHandoff: false — otherwise this would just bounce straight back here.
    void postLoginNavigate(navigate, { allowAppHandoff: false });
  };

  const showLink = code && !expired && !minting;
  const platform = getMobilePlatform();
  const storeUrl = platform === 'ios' ? APP_STORE_URL : platform === 'android' ? PLAY_STORE_URL : null;
  const storeLabel = platform === 'ios' ? 'Get it on the App Store' : 'Get it on Google Play';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '40px 24px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>TRUCKWYS</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>ROAD FREIGHT INTELLIGENCE</div>
        </div>

        {minting && (
          <>
            <div style={{ width: 28, height: 28, margin: '0 auto 16px', border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 15, color: 'var(--text-primary)' }}>Preparing your link...</div>
          </>
        )}

        {!minting && error && (
          <>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Couldn't prepare the app link</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>{error}</div>
            <button onClick={mint} className="btn-action" style={{ width: '100%' }}>
              Try again
            </button>
          </>
        )}

        {!minting && !error && (
          <>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>You're all set</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              Continue in the Truckwys app — you'll already be signed in.
            </div>

            {showLink ? (
              <a
                href={`truckwys://auth/callback?code=${encodeURIComponent(code)}`}
                onClick={armInstallDetection}
                className="btn-action"
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  textDecoration: 'none',
                  lineHeight: 'normal',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                Open in the Truckwys app
              </a>
            ) : (
              <button onClick={mint} className="btn-action" style={{ width: '100%' }}>
                Get a new link
              </button>
            )}

            {showInstallPrompt && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Nothing happened? You may not have the app yet.
                </div>
                {storeUrl && (
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textDecoration: 'none' }}
                  >
                    {storeLabel} →
                  </a>
                )}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <button
                onClick={continueInBrowser}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}
              >
                Continue in browser
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
