import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { postData } from '@/lib/Api';
import { useAuth } from '@/lib/AuthContext';
import { postLoginNavigate } from '@/lib/postLogin';

export const LoginOtp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const queryClient = useQueryClient();

  const state = (location.state || {}) as { pendingToken?: string; email?: string };
  const pendingToken = state.pendingToken;
  const email = state.email;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resentMsg, setResentMsg] = useState('');

  // Guard against refresh / direct navigation: without a pending token there's
  // no in-flight challenge, so restart the login.
  if (!pendingToken) {
    return <Navigate to="/login" replace />;
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    setLoading(true);
    try {
      const data: any = await postData({
        url: 'api/v1/auth/login/verify-otp/',
        data: { pending_token: pendingToken, code },
      });
      // Drop any cached data from a previous account on this browser (query
      // keys carry no user id — see useLogin for the same guard).
      queryClient.clear();
      localStorage.setItem('access', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      await postLoginNavigate(navigate);
    } catch (err: any) {
      setError(err?.data?.detail || err?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(''); setResentMsg('');
    try {
      await postData({ url: 'api/v1/auth/login/resend-otp/', data: { pending_token: pendingToken } });
      setResentMsg('A new code has been sent to your email.');
    } catch (err: any) {
      setError(err?.data?.detail || 'Failed to resend. Please try again.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: 420, padding: 40, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>TRUCKWYS</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>ROAD FREIGHT INTELLIGENCE</div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Enter your sign-in code</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Two-factor authentication is on. We sent a 6-digit code to{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{email || 'your email'}</strong>.
            Enter it below to finish signing in.
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
              SIGN-IN CODE
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
            {loading ? 'Verifying...' : 'Verify & sign in'}
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
  );
};

export default LoginOtp;
