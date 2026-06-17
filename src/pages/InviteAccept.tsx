import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchData, postData } from "@/lib/Api";
import { toast } from "@/lib/toast";

interface InviteDetails {
  company_name: string;
  inviter_name: string;
  email: string;
  role: string;
}

export function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }

    fetchData(`api/v1/auth/invite/${token}/`)
      .then((data) => {
        setInviteDetails(data);
        setError(null);
      })
      .catch(() => {
        setError('This invite link has expired or is invalid');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const result = await postData({
        url: `api/v1/auth/invite/${token}/accept/`,
        data: { full_name: name, password },
      });

      // Save auth token
      localStorage.setItem('access', result.token);
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));

      toast.success('Welcome to Truckwys!');
      navigate('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to accept invite');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-deep)',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--card-radius)',
        padding: 40,
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Loading invite...</div>
          </div>
        ) : error ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Invalid Invite
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {error}
              </div>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="btn-action"
              style={{ width: '100%' }}
            >
              GO TO LOGIN
            </button>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Join {inviteDetails?.company_name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {inviteDetails?.inviter_name} has invited you to join their team
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em',
                  color: 'var(--text-tertiary)',
                  marginBottom: 8,
                }}>
                  Email
                </label>
                <input
                  type="email"
                  value={inviteDetails?.email || ''}
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 2,
                    color: 'var(--text-tertiary)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em',
                  color: 'var(--text-tertiary)',
                  marginBottom: 8,
                }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Smith"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 2,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em',
                  color: 'var(--text-tertiary)',
                  marginBottom: 8,
                }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 2,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em',
                  color: 'var(--text-tertiary)',
                  marginBottom: 8,
                }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 2,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-action"
                style={{ width: '100%', marginBottom: 16 }}
              >
                {submitting ? 'CREATING ACCOUNT...' : 'ACCEPT INVITE'}
              </button>
            </form>

            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
              Already have an account?{' '}
              <a href="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                Log in
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
