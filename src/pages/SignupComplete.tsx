import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { postData } from '@/lib/Api';
import { useAuth } from '@/lib/AuthContext';

// Lands here when Paystack redirects back from the mandatory signup checkout
// (EmailVerification started it). No account exists yet — this is where
// payment actually gets confirmed and the account gets created, or, if the
// payment failed/was cancelled, where the user can retry without having to
// re-register (the PendingSignup row survives on the backend).
export const SignupComplete = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuth();
  const queryClient = useQueryClient();
  const reference = searchParams.get('reference') || searchParams.get('trxref') || '';
  const email = sessionStorage.getItem('signup_email') || '';

  const [status, setStatus] = useState<'confirming' | 'failed'>('confirming');
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!reference) {
      setStatus('failed');
      setError('Payment was not completed.');
      return;
    }
    const confirm = async () => {
      try {
        const data: any = await postData({ url: 'api/v1/auth/complete-signup/', data: { reference } });
        queryClient.clear(); // drop any cached data from a previous account on this browser
        localStorage.setItem('access', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        sessionStorage.removeItem('signup_email');
        navigate('/onboarding');
      } catch (err: any) {
        setStatus('failed');
        setError(err?.data?.detail || 'Payment could not be confirmed.');
      }
    };
    confirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  const handleRetry = async () => {
    if (!email) {
      setError('Missing your email — please start signup again.');
      return;
    }
    setRetrying(true);
    setError('');
    try {
      const data: any = await postData({
        url: 'api/v1/auth/retry-signup-payment/',
        data: { email, return_url: `${window.location.origin}/signup/complete` },
      });
      window.location.href = data.authorization_url;
    } catch (err: any) {
      setError(err?.data?.detail || 'Could not restart payment. Please try registering again.');
      setRetrying(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: 420, padding: 40, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, textAlign: 'center' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>TRUCKWYS</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>ROAD FREIGHT INTELLIGENCE</div>
        </div>

        {status === 'confirming' && (
          <>
            <div style={{ width: 28, height: 28, margin: '0 auto 16px', border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 15, color: 'var(--text-primary)' }}>Confirming your payment...</div>
          </>
        )}

        {status === 'failed' && (
          <>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Payment not completed</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              {error || 'Your card was not charged, so your account was not created.'} Your registration details are
              still saved — you can try again with the same or a different card.
            </div>
            <button onClick={handleRetry} className="btn-action" style={{ width: '100%' }} disabled={retrying}>
              {retrying ? 'Redirecting...' : 'Try payment again'}
            </button>
            <div style={{ marginTop: 16 }}>
              <button onClick={() => navigate('/signup')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
                ← Start over
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SignupComplete;
