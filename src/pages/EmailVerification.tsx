import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { postData } from '@/lib/Api';

// Kept in sync with Signup.tsx / core/services/paystack.py — this is step 2
// of that same 3-step flow, so it shows the identical price/steps rather than
// making the user recall what Signup told them.
const MONTHLY_FEE = "4,499";
const TAKE_RATE_PCT = "0.25";

const SIGNUP_STEPS = [
  { label: "Create your account", detail: "Name, email, password" },
  { label: "Verify your email", detail: "Enter the 6-digit code — you're here now" },
  { label: "Add a card & pay", detail: `R${MONTHLY_FEE}/month, charged via Paystack — your fleet goes live the moment it clears` },
];

const PLAN_FEATURES = [
  "Unlimited loads & invoices",
  "AI-powered quote optimisation",
  "Fast Pay capital access",
  "Advanced analytics & reporting",
  "Fleet intelligence dashboard",
  "Multi-user access",
  "API & integrations",
  "Priority support",
];

export const EmailVerification = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resentMsg, setResentMsg] = useState('');

  // Leaving for Paystack is a full-page navigation (window.location.href), so
  // coming back — e.g. hitting the browser's back button after declining —
  // can restore this page from the bfcache exactly as it was mid-submit
  // ("Verifying..." stuck forever), instead of the app ever regaining
  // control. Detect that restore and forward to the payment-status page,
  // which has the real "payment failed, try again" handling.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && sessionStorage.getItem('signup_email') === email) {
        navigate('/signup/complete', { replace: true });
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [email, navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    setLoading(true);
    try {
      // No account exists yet — verifying the code just starts the mandatory
      // Paystack checkout. The account is only created once that succeeds
      // (see SignupComplete, which handles the redirect back from Paystack).
      const data: any = await postData({
        url: 'api/v1/auth/verify-email/',
        data: { email, code, return_url: `${window.location.origin}/signup/complete` },
      });
      sessionStorage.setItem('signup_email', email);
      window.location.href = data.authorization_url;
    } catch (err: any) {
      setError(err?.data?.detail || 'Invalid or expired code. Please try again.');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(''); setResentMsg('');
    try {
      await postData({ url: 'api/v1/auth/resend-verification/', data: { email } });
      setResentMsg('A new code has been sent to your email.');
    } catch {
      setError('Failed to resend. Please try again.');
    }
  };

  return (
    <div className="verify-split">
      <style>{`
        .verify-split {
          /* html/body/#root are pinned to height:100vh + overflow:hidden
             app-wide — this page needs its own scroll container (see
             Signup.tsx for the full reasoning). */
          height: 100vh;
          overflow-y: auto;
          display: flex;
          background: var(--bg-deep);
          font-family: var(--font-sans);
        }
        .verify-split__content, .verify-split__form {
          flex: 1 1 50%;
          min-width: 0;
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .verify-split__form { align-items: center; }
        @media (max-width: 860px) {
          .verify-split { flex-direction: column; }
          .verify-split__content, .verify-split__form { flex: none; padding: 32px 24px; }
        }
      `}</style>

      {/* Content side — the same steps/price Signup showed, step 2 now active */}
      <div className="verify-split__content" style={{
        position: 'relative', overflow: 'hidden',
        background: `radial-gradient(120% 100% at 0% 0%, var(--glow-color), var(--glow-transparent)), var(--bg-surface)`,
        borderRight: '1px solid var(--border-subtle)',
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 440, margin: '0 auto' }}>
          <img src="/brand/truckwys-logo-transparent.png" alt="TruckWys" style={{ maxHeight: 32, width: 'auto', marginBottom: 40 }} />

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 10 }}>
            Step 2 of 3
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 28, letterSpacing: '-0.01em' }}>
            Almost there — <span style={{ color: 'var(--accent-primary)' }}>just confirm it's you</span>.
          </div>

          <div style={{
            border: '1px solid var(--border-active)', borderRadius: 'var(--card-radius)',
            padding: 24, marginBottom: 28, background: 'var(--bg-surface-hover)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                R{MONTHLY_FEE}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>/ month</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              + {TAKE_RATE_PCT}% of every delivered load's value
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
              THIS IS WHAT STEP 3 WILL CHARGE — NOTHING YET
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
            {SIGNUP_STEPS.map((step, i) => (
              <div key={step.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  flex: 'none', width: 22, height: 22, borderRadius: '50%',
                  border: `1px solid ${i <= 1 ? 'var(--accent-primary)' : 'var(--border-active)'}`,
                  color: i <= 1 ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, marginTop: 1,
                }}>
                  {i < 1 ? '✓' : i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: i <= 1 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{step.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>{step.detail}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            {PLAN_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <Check size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 32, fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
            PAYMENTS SECURED BY PAYSTACK
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="verify-split__form">
      <div style={{ width: '100%', maxWidth: 420, padding: 40, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>TRUCKWYS</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>ROAD FREIGHT INTELLIGENCE</div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Verify your email</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            We sent a 6-digit verification code to{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{email || 'your email'}</strong>.
            Enter it below to continue to payment and activate your account.
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger)', borderRadius: 4, fontSize: 12, color: 'var(--status-danger)' }}>
            {error}
          </div>
        )}
        {resentMsg && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--status-success-bg, rgba(34,197,94,0.1))', border: '1px solid var(--status-success)', borderRadius: 4, fontSize: 12, color: 'var(--status-success)' }}>
            {resentMsg}
          </div>
        )}

        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6, letterSpacing: '0.08em' }}>
              VERIFICATION CODE
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              autoFocus
              style={{
                width: '100%', padding: '14px 16px', background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)', borderRadius: 4,
                color: 'var(--text-primary)', fontSize: 26, outline: 'none',
                boxSizing: 'border-box', letterSpacing: '0.3em', fontFamily: 'var(--font-mono)',
                textAlign: 'center',
              }}
            />
          </div>

          <button type="submit" className="btn-action" style={{ width: '100%' }} disabled={loading || code.length !== 6}>
            {loading ? 'Verifying...' : 'Verify email'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
          Didn't receive the code?{' '}
          <button onClick={handleResend} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: 'var(--font-sans)' }}>
            Resend code
          </button>
        </div>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
            ← Back to login
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default EmailVerification;
