import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLogin } from "@/hooks/useLogin";
import { fetchData } from "@/lib/Api";

const Login = () => {
  const navigate = useNavigate();
  const { mutate: login, isPending } = useLogin();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
    // Clear validation error for this field
    setValidationErrors(prev => ({ ...prev, [e.target.name]: '' }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.username.trim()) {
      errors.username = 'Email is required';
    } else if (!emailRegex.test(formData.username)) {
      errors.username = 'Invalid email format';
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    login(formData, {
      onSuccess: async () => {
        // Check if onboarding is needed
        const onboardingDone = localStorage.getItem('onboarding_done');
        if (!onboardingDone) {
          try {
            // Check if company has any vehicles or loads
            const overview = await fetchData('api/v1/fleet/overview/');
            const vehicleCount = overview?.total_vehicles || 0;

            if (vehicleCount === 0) {
              navigate("/onboarding");
              return;
            }
          } catch {
            // If API fails, skip onboarding check
          }
        }
        navigate("/");
      },
      onError: (error: any) => {
        console.error("Login error:", error);
        setError(
          error.status === 401
            ? "Incorrect email or password. Please try again."
            : (error.message || "Sign in failed. Please try again.")
        );
      }
    });
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    padding: '12px 14px',
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
        padding: 32,
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
            Sign in to your account
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Enter your credentials to access the dashboard
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label htmlFor="username" style={labelStyle}>Email</label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="name@example.com"
              required
              value={formData.username}
              onChange={handleChange}
              style={{
                ...inputStyle,
                borderColor: validationErrors.username ? 'var(--status-danger)' : 'var(--border-subtle)',
              }}
            />
            {validationErrors.username && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--status-danger)' }}>
                {validationErrors.username}
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label htmlFor="password" style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
              <Link
                to="/password-reset"
                style={{
                  fontSize: 11,
                  color: 'var(--accent-primary)',
                  textDecoration: 'none',
                }}
              >
                Forgot password?
              </Link>
            </div>
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
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--status-danger)' }}>
                {validationErrors.password}
              </div>
            )}
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
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
              cursor: isPending ? 'wait' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
            disabled={isPending}
          >
            {isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div style={{
          marginTop: 24,
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--text-secondary)'
        }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
