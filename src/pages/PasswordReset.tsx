import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Check } from 'lucide-react';
import { postData } from '@/lib/Api';

// Same list Signup.tsx / Login.tsx / BillingSettings.tsx show — kept
// identical everywhere the plan is mentioned.
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

const RESEND_SECONDS = 180;

function formatCountdown(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export default function PasswordReset() {
  const navigate = useNavigate();
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
    width: '100%', padding: '10px 12px', background: 'var(--bg-base)',
    border: '1px solid var(--border-subtle)', borderRadius: 4,
    color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
    display: 'block', marginBottom: 6, letterSpacing: '0.08em',
  };

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
        @media (max-width: 860px) {
          .pwreset-split { flex-direction: column; }
          .pwreset-split__content, .pwreset-split__form { flex: none; padding: 32px 24px; }
        }
      `}</style>

      {/* Content side — same "welcome back" framing as Login, not a sales pitch */}
      <div className="pwreset-split__content" style={{
        position: 'relative', overflow: 'hidden',
        background: `radial-gradient(120% 100% at 0% 0%, var(--glow-color), var(--glow-transparent)), var(--bg-surface)`,
        borderRight: '1px solid var(--border-subtle)',
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 440, margin: '0 auto' }}>
          <img src="/brand/truckwys-logo-transparent.png" alt="TruckWys" style={{ maxHeight: 32, width: 'auto', marginBottom: 40 }} />

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 10 }}>
            Account recovery
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 16, letterSpacing: '-0.01em' }}>
            Let's get you <span style={{ color: 'var(--accent-primary)' }}>back in</span>.
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
            Loads, quotes, invoices, and fleet intelligence — all in one dashboard, waiting right where you left them.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            {PLAN_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <Check size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 24, padding: '10px 13px', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--card-radius)', background: 'var(--bg-surface-hover)',
            fontSize: 12, color: 'var(--text-secondary)',
          }}>
            Reminder: every completed load also carries a <strong style={{ color: 'var(--text-primary)' }}>0.25% platform fee</strong>,
            charged automatically to the card on file on top of the monthly plan.
          </div>

          <div style={{ marginTop: 20, fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
            BUILT FOR SOUTH AFRICAN ROAD FREIGHT
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="pwreset-split__form">
      <div style={{ width: '100%', maxWidth: 420, padding: 40, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>TRUCKWYS</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>ROAD FREIGHT INTELLIGENCE</div>
        </div>

        {step === 'done' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Password updated</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>Your password has been reset. You can now log in.</div>
            <button className="btn-action" style={{ width: '100%' }} onClick={() => navigate('/login')}>Back to login</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                {step === 'request' ? 'Reset password' : 'Enter reset code'}
              </div>
              {step === 'confirm' && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Reset code sent to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                </div>
              )}
              {step === 'request' && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Enter your email address to receive a reset code.</div>
              )}
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger)', borderRadius: 4, fontSize: 12, color: 'var(--status-danger)' }}>
                {error}
              </div>
            )}

            {step === 'request' ? (
              <form onSubmit={requestReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>EMAIL ADDRESS</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    style={inputStyle} placeholder="your@email.com" />
                </div>
                <button type="submit" className="btn-action" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                  {loading ? 'Sending...' : 'Send reset code'}
                </button>
              </form>
            ) : (
              <form onSubmit={confirmReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Resend row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {countdown > 0 ? `Resend in ${formatCountdown(countdown)}` : 'Didn\'t receive the code?'}
                  </span>
                  <button type="button" onClick={handleResend} disabled={countdown > 0}
                    style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'none', border: 'none', cursor: countdown > 0 ? 'default' : 'pointer', color: countdown > 0 ? 'var(--text-tertiary)' : 'var(--accent-primary)', padding: 0, letterSpacing: '0.06em' }}>
                    Resend
                  </button>
                </div>

                {/* Reset code */}
                <div>
                  <label style={labelStyle}>RESET CODE</label>
                  <input type="text" required value={code} onChange={e => setCode(e.target.value)}
                    placeholder="6-digit code from email" maxLength={6}
                    style={{ ...inputStyle, letterSpacing: '0.2em', fontSize: 16, fontFamily: 'var(--font-mono)' }} />
                </div>

                {/* New password */}
                <div>
                  <label style={labelStyle}>NEW PASSWORD</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showNew ? 'text' : 'password'} required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters" style={{ ...inputStyle, paddingRight: 40 }} />
                    <button type="button" tabIndex={-1} onClick={() => setShowNew(v => !v)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex' }}>
                      {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label style={labelStyle}>CONFIRM PASSWORD</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showConfirm ? 'text' : 'password'} required value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="Repeat new password" style={{ ...inputStyle, paddingRight: 40 }} />
                    <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex' }}>
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-action" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                  {loading ? 'Resetting...' : 'Set new password'}
                </button>
              </form>
            )}

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                ← Back to login
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
