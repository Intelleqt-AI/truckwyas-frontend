import "./auth-brand.css";
import { AlertTriangle } from "lucide-react";
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
      toast.error(err?.message || 'Failed to accept invite');
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
              <AlertTriangle aria-hidden="true" size={40} strokeWidth={1.5} style={{ color: 'var(--status-warning-text, var(--status-warning))', marginBottom: 16 }} />
              <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                Invalid invite
              </h1>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {error}
              </div>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="btn-action"
              style={{ width: '100%' }}
            >
              Go to login
            </button>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                Join {inviteDetails?.company_name}
              </h1>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{inviteDetails?.inviter_name}</strong> has invited you to join their team
              </div>
              {inviteDetails?.role && (
                <span style={{
                  display: 'inline-block',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  lineHeight: '16px',
                  fontWeight: 500,
                  padding: '2px 8px',
                  border: '1px solid currentColor',
                  color: 'var(--status-info-text, var(--accent-primary))',
                  borderRadius: 4,
                }}>
                  {/* Presentation only — the role enum is shown in sentence case. */}
                  {inviteDetails.role.charAt(0).toUpperCase() + inviteDetails.role.slice(1).toLowerCase()} role
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="invite-email" style={{
                  display: 'block',
                  fontSize: 13,
                  lineHeight: '20px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}>
                  Email
                </label>
                <input id="invite-email" className="tw-auth-control"
                  type="email"
                  value={inviteDetails?.email || ''}
                  disabled
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    minHeight: 40,
                    boxSizing: 'border-box',
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    color: 'var(--text-tertiary)',
                    fontSize: 14,
                    lineHeight: '20px',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="invite-full-name" style={{
                  display: 'block',
                  fontSize: 13,
                  lineHeight: '20px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}>
                  Full Name
                </label>
                <input className="tw-auth-control" id="invite-full-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Smith"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    minHeight: 40,
                    boxSizing: 'border-box',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    lineHeight: '20px',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="invite-password" style={{
                  display: 'block',
                  fontSize: 13,
                  lineHeight: '20px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}>
                  Password
                </label>
                <input className="tw-auth-control" id="invite-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    minHeight: 40,
                    boxSizing: 'border-box',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    lineHeight: '20px',
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label htmlFor="invite-confirm-password" style={{
                  display: 'block',
                  fontSize: 13,
                  lineHeight: '20px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}>
                  Confirm Password
                </label>
                <input className="tw-auth-control" id="invite-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    minHeight: 40,
                    boxSizing: 'border-box',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    lineHeight: '20px',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-action"
                style={{ width: '100%', marginBottom: 16 }}
              >
                {submitting ? 'Creating account…' : 'Accept invite'}
              </button>
            </form>

            <div style={{ textAlign: 'center', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
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
