import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { postData } from '@/lib/Api';

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
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: 420, padding: 40, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Truckwys</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>Road freight intelligence</div>
        </div>

        {step === 'done' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Password Updated</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>Your password has been reset. You can now log in.</div>
            <button className="btn-action" style={{ width: '100%' }} onClick={() => navigate('/login')}>Back to login</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                {step === 'request' ? 'Reset Password' : 'Enter Reset Code'}
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
                  <label style={labelStyle}>Email address</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    style={inputStyle} placeholder="your@email.com" />
                </div>
                <button type="submit" className="btn-action" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                  {loading ? 'SENDING...' : 'SEND RESET CODE'}
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
                    RESEND
                  </button>
                </div>

                {/* Reset code */}
                <div>
                  <label style={labelStyle}>Reset code</label>
                  <input type="text" required value={code} onChange={e => setCode(e.target.value)}
                    placeholder="6-digit code from email" maxLength={6}
                    style={{ ...inputStyle, letterSpacing: '0.2em', fontSize: 16, fontFamily: 'var(--font-mono)' }} />
                </div>

                {/* New password */}
                <div>
                  <label style={labelStyle}>New password</label>
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
                  <label style={labelStyle}>Confirm password</label>
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
                  {loading ? 'RESETTING...' : 'SET NEW PASSWORD'}
                </button>
              </form>
            )}

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                ← BACK TO LOGIN
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
