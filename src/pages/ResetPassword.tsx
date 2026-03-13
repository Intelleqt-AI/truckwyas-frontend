import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { postData } from "@/lib/Api";
import { toast } from "@/lib/toast";

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error('Invalid reset link');
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
      await postData({
        url: 'api/v1/auth/password-reset/confirm/',
        data: { token, password },
      });
      toast.success('Password reset successfully');
      navigate('/login');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to reset password. Link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
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
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            Invalid Reset Link
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
            This password reset link is invalid or has expired.
          </div>
          <button onClick={() => navigate('/forgot-password')} className="btn-action" style={{ width: '100%' }}>
            REQUEST NEW LINK
          </button>
        </div>
      </div>
    );
  }

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
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            Set New Password
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Choose a strong password for your account
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
              marginBottom: 6,
            }}>
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
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

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
              marginBottom: 6,
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
            {submitting ? 'RESETTING...' : 'RESET PASSWORD'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
          <a href="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
            Back to login
          </a>
        </div>
      </div>
    </div>
  );
}
