import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { postData } from "@/lib/Api";

const Signup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
    // Clear validation error for this field
    setValidationErrors(prev => ({ ...prev, [e.target.name]: '' }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Full name is required';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nameParts = formData.name.split(' ');
      const first_name = nameParts[0];
      const last_name = nameParts.slice(1).join(' ');

      const result = await postData({
        url: 'api/v1/auth/register/',
        data: {
          username: formData.email,
          email: formData.email,
          password: formData.password,
          first_name,
          last_name,
          name: formData.name,
          company_name: formData.company_name,
        }
      });

      // Auto sign-in: the register endpoint returns a token + user, so we go
      // straight into onboarding instead of bouncing back to the login screen.
      if (result?.token) {
        localStorage.setItem('access', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        navigate('/onboarding');
      } else {
        navigate('/login');
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      const msg = String(error?.message || '');
      if (error?.status === 400 && /exist|already|unique/i.test(msg)) {
        setError("An account with this email already exists. Try signing in instead.");
      } else {
        setError(msg || "Failed to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    padding: '10px 12px',
    color: 'var(--text-primary)',
    borderRadius: 2,
    fontSize: 13,
    outline: 'none',
    width: '100%',
    fontFamily: 'var(--font-sans)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-tertiary)',
    marginBottom: 8,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-deep)',
      padding: 24
    }}>
      <div style={{ marginBottom: 32 }}>
        <img src="/brand/truckwys-logo-transparent.png" alt="TruckWys" style={{ maxHeight: 40, width: 'auto' }} />
      </div>

      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 2,
        padding: 40,
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
            Create an account
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Enter your information to get started
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label htmlFor="name" style={labelStyle}>Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="John Doe"
              required
              value={formData.name}
              onChange={handleChange}
              style={{
                ...inputStyle,
                borderColor: validationErrors.name ? 'var(--status-danger)' : 'var(--border-subtle)',
              }}
            />
            {validationErrors.name && (
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--status-danger)' }}>
                {validationErrors.name}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="company_name" style={labelStyle}>Company Name</label>
            <input
              id="company_name"
              name="company_name"
              type="text"
              placeholder="Acme Logistics (Pty) Ltd"
              value={formData.company_name}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="email" style={labelStyle}>Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              required
              value={formData.email}
              onChange={handleChange}
              style={{
                ...inputStyle,
                borderColor: validationErrors.email ? 'var(--status-danger)' : 'var(--border-subtle)',
              }}
            />
            {validationErrors.email && (
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--status-danger)' }}>
                {validationErrors.email}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="password" style={labelStyle}>Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={handleChange}
              style={{
                ...inputStyle,
                borderColor: validationErrors.password ? 'var(--status-danger)' : 'var(--border-subtle)',
              }}
            />
            {validationErrors.password && (
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--status-danger)' }}>
                {validationErrors.password}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" style={labelStyle}>Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              style={{
                ...inputStyle,
                borderColor: validationErrors.confirmPassword ? 'var(--status-danger)' : 'var(--border-subtle)',
              }}
            />
            {validationErrors.confirmPassword && (
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--status-danger)' }}>
                {validationErrors.confirmPassword}
              </div>
            )}
          </div>

          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'var(--status-danger-bg)',
              border: '1px solid var(--status-danger)',
              borderRadius: 2,
              color: 'var(--status-danger)',
              fontSize: 12,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-action"
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
            disabled={loading}
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <div style={{
          marginTop: 24,
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--text-secondary)'
        }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
