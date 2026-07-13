import { useState } from "react";
import { Link } from "react-router-dom";
import { postData } from "@/lib/Api";
import { toast } from "@/lib/toast";

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }

    setSubmitting(true);
    try {
      await postData({
        url: 'api/v1/auth/password-reset/',
        data: { email },
      });
      setSubmitted(true);
    } catch (err: any) {
      // Even on error, show success message for security (don't reveal if email exists)
      setSubmitted(true);
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
        maxWidth: 400,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--card-radius)',
        padding: 40,
      }}>
        {submitted ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Check Your Email
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                If an account exists for <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>,
                you will receive a password reset link shortly.
              </div>
            </div>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <button className="btn-action" style={{ width: '100%' }}>
                BACK TO LOGIN
              </button>
            </Link>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Reset Password
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Enter your email and we'll send you a reset link
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.08em',
                  color: 'var(--text-tertiary)',
                  marginBottom: 6,
                }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.co.za"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 14px',
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
                {submitting ? 'SENDING...' : 'SEND RESET LINK'}
              </button>
            </form>

            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
              Remember your password?{' '}
              <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                Log in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
