import "./auth-brand.css";
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
      padding: 16,
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: 24,
        boxSizing: 'border-box',
      }}>
        {submitted ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                Check your email
              </h1>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '20px' }}>
                If an account exists for <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>,
                you will receive a password reset link shortly.
              </div>
            </div>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <button className="btn-action" style={{ width: '100%', borderRadius: 'var(--radius-control)' }}>
                Back to login
              </button>
            </Link>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                Reset password
              </h1>
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                Enter your email and we'll send you a reset link
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 24 }}>
                <label htmlFor="forgot-email-address" style={{
                  display: 'block',
                  fontSize: 13,
                  lineHeight: '20px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}>
                  Email address
                </label>
                <input className="tw-auth-control" id="forgot-email-address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.co.za"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    minHeight: 40,
                    boxSizing: 'border-box',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-control)',
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
                style={{ width: '100%', marginBottom: 16, borderRadius: 'var(--radius-control)' }}
              >
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <div style={{ textAlign: 'center', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
              Remember your password?{' '}
              <Link to="/login" style={{ color: 'var(--link)', textDecoration: 'none' }}>
                Log in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
