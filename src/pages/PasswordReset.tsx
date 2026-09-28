import "./auth-brand.css";
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Check } from 'lucide-react';
import { postData } from '@/lib/Api';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileAuthLayout } from '@/components/MobileAuthLayout';

// Same list Signup.tsx / Login.tsx / BillingSettings.tsx show — kept
// identical everywhere the plan is mentioned.
const PLAN_FEATURES = [
  "Unlimited loads & invoices",
  "AI-powered quote optimisation",
  "Fast Pay capital access (not live yet)",
  "Advanced analytics & reporting",
  "Fleet intelligence dashboard",
  "Multi-user access",
  "API & integrations",
  "Priority support",
];

const RESEND_SECONDS = 180;

function formatCountdown(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export default function PasswordReset() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'request' | 'confirm' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Resend countdown
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = () => {
    setCountdown(RESEND_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // A "Set new password" link from the reset email lands here with the
  // email prefilled and step=confirm — the code was already sent (this same
  // email), so jump straight to code entry instead of requesting a new one.
  useEffect(() => {
    const paramEmail = searchParams.get('email');
    if (paramEmail) setEmail(paramEmail);
    if (searchParams.get('step') === 'confirm') {
      setStep('confirm');
      startCountdown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await postData({ url: 'api/v1/auth/password-reset/', data: { email } });
      setStep('confirm');
      startCountdown();
    } catch (err: any) {
      setError(err?.data?.detail || err?.data?.email?.[0] || 'Failed to send reset email.');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setError('');
    try {
      await postData({ url: 'api/v1/auth/password-reset/', data: { email } });
      startCountdown();
    } catch (err: any) {
      setError(err?.data?.detail || 'Failed to resend code.');
    }
  };

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await postData({ url: 'api/v1/auth/password-reset/confirm/', data: { email, code, new_password: newPassword } });
      setStep('done');
    } catch (err: any) {
      setError(err?.data?.detail || err?.data?.code?.[0] || 'Invalid or expired reset code.');
    } finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--input-bg, var(--bg-surface))',
    border: '1px solid var(--border-subtle)',
    padding: '8px 12px',
    minHeight: 40,
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-control)',
    fontSize: 14,
    lineHeight: '20px',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-sans)',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    lineHeight: '20px',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    color: 'var(--text-primary)',
    marginBottom: 6,
  };

  // Shared between the desktop card (which shows its own text logo, since
  // that side of the split has no image logo of its own) and the mobile
  // card (which doesn't need one — MobileAuthLayout already puts the real
  // image logo at the top of the page).
  const formBody = (
    <>
        {step === 'done' ? (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>Password updated</h1>
            <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', marginBottom: 24 }}>Your password has been reset. You can now log in.</div>
            <button className="btn-action" style={{ width: '100%', borderRadius: 'var(--radius-control)' }} onClick={() => navigate('/login')}>Back to login</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                {step === 'request' ? 'Reset password' : 'Enter reset code'}
              </h1>
              {step === 'confirm' && (
                <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                  Reset code sent to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                </div>
              )}
              {step === 'request' && (
                <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>Enter your email address to receive a reset code.</div>
              )}
            </div>

            {error && (
              <div role="alert" style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger)', borderRadius: 'var(--radius-nested)', fontSize: 13, lineHeight: '20px', color: 'var(--status-danger-text, var(--status-danger))' }}>
                {error}
              </div>
            )}

            {step === 'request' ? (
              <form onSubmit={requestReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Email address</label>
                  <input className="tw-auth-control" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    style={inputStyle} placeholder="your@email.com" />
                </div>
                <button type="submit" className="btn-action" style={{ width: '100%', marginTop: 8, borderRadius: 'var(--radius-control)' }} disabled={loading}>
                  {loading ? 'Sending…' : 'Send reset code'}
                </button>
              </form>
            ) : (
              <form onSubmit={confirmReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Resend row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>
                    {countdown > 0 ? `Resend in ${formatCountdown(countdown)}` : 'Didn\'t receive the code?'}
                  </span>
                  <button type="button" onClick={handleResend} disabled={countdown > 0}
                    style={{ fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', background: 'none', border: 'none', cursor: countdown > 0 ? 'default' : 'pointer', color: countdown > 0 ? 'var(--text-tertiary)' : 'var(--accent-primary)', padding: 0 }}>
                    Resend
                  </button>
                </div>

                {/* Reset code */}
                <div>
                  <label style={labelStyle}>Reset code</label>
                  <input className="tw-auth-control" type="text" required value={code} onChange={e => setCode(e.target.value)}
                    placeholder="6-digit code from email" maxLength={6}
                    style={{ ...inputStyle, letterSpacing: '0.2em', fontSize: 16, fontFamily: 'var(--font-mono)' }} />
                </div>

                {/* New password */}
                <div>
                  <label style={labelStyle}>New password</label>
                  <div style={{ position: 'relative' }}>
                    <input className="tw-auth-control" type={showNew ? 'text' : 'password'} required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters" style={{ ...inputStyle, paddingRight: 40 }} />
                    <button type="button" tabIndex={-1} aria-label="Show or hide password" onClick={() => setShowNew(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex' }}>
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label style={labelStyle}>Confirm password</label>
                  <div style={{ position: 'relative' }}>
                    <input className="tw-auth-control" type={showConfirm ? 'text' : 'password'} required value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="Repeat new password" style={{ ...inputStyle, paddingRight: 40 }} />
                    <button type="button" tabIndex={-1} aria-label="Show or hide password" onClick={() => setShowConfirm(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex' }}>
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-action" style={{ width: '100%', marginTop: 8, borderRadius: 'var(--radius-control)' }} disabled={loading}>
                  {loading ? 'Resetting…' : 'Set new password'}
                </button>
              </form>
            )}

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, lineHeight: '20px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                ← Back to login
              </button>
            </div>
          </>
        )}
    </>
  );

  const desktopFormCard = (
    <div style={{ width: '100%', maxWidth: 420, padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', boxSizing: 'border-box' }}>
      {/* The split layout already shows the logo in its content panel. */}
      {formBody}
    </div>
  );

  // Everything the desktop content panel shows besides its own logo/eyebrow/
  // title/subtitle (those become MobileAuthLayout's own header props on
  // mobile) — demoted to a footer below the form there.
  const extraContent = (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 16px' }}>
        {PLAN_FEATURES.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
            <Check size={16} aria-hidden="true" style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 2 }} />
            {f}
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 20, padding: '12px 16px', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-nested)', background: 'var(--bg-surface-hover)',
        fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)',
      }}>
        Reminder: every completed load also carries a <strong style={{ color: 'var(--text-primary)' }}>0.25% platform fee</strong>,
        charged automatically to the card on file on top of the monthly plan.
      </div>

      <div style={{ marginTop: 16, fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-sans)', color: 'var(--text-tertiary)' }}>
        Built for South African road freight
      </div>
    </>
  );

  if (isMobile) {
    return (
      <MobileAuthLayout
        eyebrow="Account recovery"
        title={<>Let's get you <span style={{ color: 'var(--accent-primary)' }}>back in</span>.</>}
        subtitle="Loads, quotes, invoices, and fleet intelligence, all in one dashboard, waiting right where you left them."
        footer={extraContent}
      >
        <div style={{ width: '100%', maxWidth: 420, padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', boxSizing: 'border-box' }}>
          {formBody}
        </div>
      </MobileAuthLayout>
    );
  }

  return (
    <div className="pwreset-split">
      <style>{`
        .pwreset-split {
          /* html/body/#root are pinned to height:100vh + overflow:hidden
             app-wide — this page needs its own scroll container (see
             Signup.tsx for the full reasoning). */
          height: 100vh;
          overflow-y: auto;
          display: flex;
          background: var(--bg-deep);
          font-family: var(--font-sans);
        }
        .pwreset-split__content, .pwreset-split__form {
          flex: 1 1 50%;
          min-width: 0;
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .pwreset-split__form { align-items: center; }
      `}</style>

      {/* Content side — same "welcome back" framing as Login, not a sales pitch */}
      <div className="pwreset-split__content" style={{
        position: 'relative', overflow: 'hidden',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 440, margin: '0 auto' }}>
          <img className="tw-auth-logo" src="/brand/truckwys-logo-transparent.png" alt="TruckWys" style={{ maxHeight: 32, width: 'auto', marginBottom: 40 }} />

          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--status-info-text, var(--accent-primary))', marginBottom: 10 }}>
            Account recovery
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', lineHeight: '34px', marginBottom: 16 }}>
            Let's get you <span style={{ color: 'var(--accent-primary)' }}>back in</span>.
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: '22px', marginBottom: 32 }}>
            Loads, quotes, invoices, and fleet intelligence, all in one dashboard, waiting right where you left them.
          </div>

          {extraContent}
        </div>
      </div>

      {/* Form side */}
      <div className="pwreset-split__form">
        {desktopFormCard}
      </div>
    </div>
  );
}
