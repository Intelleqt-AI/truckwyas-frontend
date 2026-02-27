import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postData } from '@/lib/Api';

export default function PasswordReset() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'confirm' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await postData({ url: 'api/v1/auth/password-reset/', data: { email } });
      setMsg('Reset code sent to your email.');
      setStep('confirm');
    } catch (err: any) {
      setError(err?.data?.detail || err?.data?.email?.[0] || 'Failed to send reset email.');
    } finally { setLoading(false); }
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: 420, padding: 40, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>TRUCKWYS</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>ROAD FREIGHT INTELLIGENCE</div>
        </div>

        {step === 'done' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Password Updated</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>Your password has been reset. You can now log in.</div>
            <button className="btn-action" style={{ width: '100%' }} onClick={() => navigate('/login')}>BACK TO LOGIN</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                {step === 'request' ? 'Reset Password' : 'Enter Reset Code'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {step === 'request'
                  ? 'Enter your email address to receive a reset code.'
                  : msg || `Code sent to ${email}. Enter it below with your new password.`}
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid var(--status-danger)', borderRadius: 4, fontSize: 12, color: 'var(--status-danger)' }}>
                {error}
              </div>
            )}

            {step === 'request' ? (
              <form onSubmit={requestReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6, letterSpacing: '0.08em' }}>EMAIL ADDRESS</label>
                  <input
                    type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    placeholder="your@email.com"
                  />
                </div>
                <button type="submit" className="btn-action" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                  {loading ? 'SENDING...' : 'SEND RESET CODE'}
                </button>
              </form>
            ) : (
              <form onSubmit={confirmReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'RESET CODE', val: code, set: setCode, type: 'text', ph: '6-digit code from email' },
                  { label: 'NEW PASSWORD', val: newPassword, set: setNewPassword, type: 'password', ph: 'Min 8 characters' },
                  { label: 'CONFIRM PASSWORD', val: confirm, set: setConfirm, type: 'password', ph: 'Repeat new password' },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6, letterSpacing: '0.08em' }}>{f.label}</label>
                    <input
                      type={f.type} required value={f.val} onChange={e => f.set(e.target.value)}
                      placeholder={f.ph}
                      style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
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
