import "./auth-brand.css";
import "./demo.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLogin } from "@/hooks/useLogin";
import { useAuth } from "@/lib/AuthContext";
import { postData } from "@/lib/Api";
import { DEMO_CREDENTIALS } from "./Login";

// sessionStorage key for the marketing-site attribution tag (`/demo?ref=...`).
// Read it later (e.g. when sending analytics or a signup) — nothing posts it yet.
export const DEMO_REF_STORAGE_KEY = "tw-demo-ref";

type Phase = "opening" | "confirm" | "error";

// Keep the tag short and boring: it's an attribution label, not free text.
function storeRef(raw: string | null) {
  if (!raw) return;
  const ref = raw.trim().slice(0, 100);
  if (!ref) return;
  try {
    sessionStorage.setItem(DEMO_REF_STORAGE_KEY, ref);
  } catch {
    // Private mode / blocked storage: attribution is best-effort.
  }
}

/**
 * /demo — public deep link into the shared demo account, for the marketing
 * site's "Open the demo" button. Signs in with the same DEMO_CREDENTIALS and
 * useLogin mutation as the login page's "View demo" control, then lands on
 * Home. Never switches away from a real signed-in account without asking.
 */
const Demo = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { mutate: login } = useLogin();

  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("access");
  // is_demo is the real signal; the e-mail check covers a stored user from
  // before that flag existed (or a demo company missing it).
  const inDemo = !!user?.is_demo || user?.email === DEMO_CREDENTIALS.username;
  const signedInToRealAccount = hasToken && !inDemo;

  const [phase, setPhase] = useState<Phase>(signedInToRealAccount ? "confirm" : "opening");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const openDemo = useCallback(() => {
    setPhase("opening");
    setError(null);
    login(
      { ...DEMO_CREDENTIALS },
      {
        onSuccess: (data: { otp_required?: boolean; pending_token?: string; email?: string }) => {
          if (data?.otp_required) {
            navigate("/login/verify-otp", {
              replace: true,
              state: { pendingToken: data.pending_token, email: data.email },
            });
            return;
          }
          navigate("/", { replace: true });
        },
        onError: (err: Error & { status?: number }) => {
          setError(
            err?.status === 429
              ? "Lots of people are exploring right now. Give it a moment and try again."
              : "Check your connection and try again."
          );
          setPhase("error");
        },
      }
    );
  }, [login, navigate]);

  // Leave the real account first, so the demo sign-in never goes out with a
  // stale Authorization header (and the old session isn't left orphaned).
  const switchToDemo = () => {
    const oldToken = localStorage.getItem("access");
    localStorage.removeItem("access");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("onboarding_done");
    if (oldToken) {
      postData({
        url: "api/v1/auth/logout/",
        config: { headers: { Authorization: `Token ${oldToken}` } },
      }).catch(() => { /* best-effort: the local session is already gone */ });
    }
    openDemo();
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    storeRef(searchParams.get("ref"));
    if (hasToken && inDemo) {
      // Already in the demo: nothing to sign in to.
      navigate("/", { replace: true });
      return;
    }
    if (!signedInToRealAccount) openDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountLabel = user?.name || user?.email || user?.username || "another account";

  return (
    <main className="tw-demo">
      <div className="tw-demo__card">
        <img
          className="tw-auth-logo tw-demo__logo"
          src="/brand/truckwys-logo-transparent.png"
          alt="TruckWys"
        />

        <div aria-live="polite" role="status" className="tw-demo__live">
          {phase === "opening" && (
            <>
              <h1 className="tw-demo__title">Opening the demo…</h1>
              <p className="tw-demo__body">
                Signing you in to the shared demo account. No account needed.
              </p>
              <div className="tw-demo__progress" aria-hidden="true">
                <span />
              </div>
            </>
          )}

          {phase === "confirm" && (
            <>
              <h1 className="tw-demo__title">
                You're signed in as <span className="tw-demo__who">{accountLabel}</span>.
              </h1>
              <p className="tw-demo__body">
                Open the demo instead? This signs you out of your account on this browser.
              </p>
            </>
          )}
        </div>

        {phase === "error" && (
          <div role="alert">
            <h1 className="tw-demo__title">We couldn't open the demo</h1>
            <p className="tw-demo__body">{error}</p>
          </div>
        )}

        {phase === "confirm" && (
          <div className="tw-demo__actions">
            <button type="button" className="btn-action tw-demo__btn" onClick={switchToDemo}>
              Continue to demo
            </button>
            <button
              type="button"
              className="btn-ghost tw-demo__btn"
              onClick={() => navigate("/", { replace: true })}
            >
              Stay signed in
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="tw-demo__actions">
            <button type="button" className="btn-action tw-demo__btn" onClick={openDemo} autoFocus>
              Try again
            </button>
            <Link to="/login" className="btn-ghost tw-demo__btn">
              Sign in instead
            </Link>
          </div>
        )}
      </div>
    </main>
  );
};

export default Demo;
