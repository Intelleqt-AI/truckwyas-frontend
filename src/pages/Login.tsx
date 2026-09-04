import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Check } from "lucide-react";
import { useLogin } from "@/hooks/useLogin";
import { postLoginNavigate } from "@/lib/postLogin";

// Same list Signup.tsx and BillingSettings.tsx show — kept identical across
// every page that mentions the plan, so returning users see the same promise
// new signups do.
const PLAN_FEATURES = [
  "Unlimited loads & invoices",
  "AI-powered quote optimisation",
  "Fast Pay capital access",
  "Advanced analytics & reporting",
  "Fleet intelligence dashboard",
  "Multi-user access",
  "API & integrations",
  "Priority support",
];

const Login = () => {
  const navigate = useNavigate();
  const { mutate: login, isPending } = useLogin();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

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

    // Password validation — just needs to be present. A minimum-length rule
    // belongs on signup (where it does apply), not here: a login attempt
    // should be checked against the real password, not a strength policy
    // that may not even match what was true when the account was created.
    if (!formData.password) {
      errors.password = 'Password is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Shared by the real form submit and the demo button below — both just
  // need to hand a set of credentials to the login mutation.
  const submitLogin = (credentials: { username: string; password: string }) => {
    login(credentials, {
      onSuccess: async (data: any) => {
        // 2FA enabled → no token yet; go collect the emailed sign-in code.
        if (data?.otp_required) {
          navigate("/login/verify-otp", {
            state: { pendingToken: data.pending_token, email: data.email },
          });
          return;
        }
        await postLoginNavigate(navigate);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    submitLogin(formData);
  };

  const handleDemoLogin = () => {
    const demoCredentials = { username: "demo@truckwys.com", password: "TruckDemo2026!" };
    setError(null);
    setValidationErrors({});
    setFormData(demoCredentials);
    // Use the literal credentials rather than the (not-yet-updated) formData
    // state, since setFormData above won't have applied yet on this render.
    submitLogin(demoCredentials);
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
    <div className="login-split">
      <style>{`
        .login-split {
          /* html/body/#root are pinned to height:100vh + overflow:hidden
             app-wide (the dashboard shell scrolls internally instead) — this
             page needs to be its own scroll container or content can end up
             clipped with no way to reach it (see Signup.tsx for the same fix). */
          height: 100vh;
          overflow-y: auto;
          display: flex;
          background: var(--bg-deep);
        }
        .login-split__content, .login-split__form {
          flex: 1 1 50%;
          min-width: 0;
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .login-split__form { align-items: center; }
        @media (max-width: 860px) {
          .login-split { flex-direction: column; }
          .login-split__content, .login-split__form { flex: none; padding: 32px 24px; }
        }
      `}</style>

      {/* Content side — a reminder of what's waiting, not a sales pitch */}
      <div className="login-split__content" style={{
        position: 'relative', overflow: 'hidden',
        background: `radial-gradient(120% 100% at 0% 0%, var(--glow-color), var(--glow-transparent)), var(--bg-surface)`,
        borderRight: '1px solid var(--border-subtle)',
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 440, margin: '0 auto' }}>
          <img src="/brand/truckwys-logo-transparent.png" alt="TruckWys" style={{ maxHeight: 32, width: 'auto', marginBottom: 40 }} />

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 10 }}>
            Welcome back
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 16, letterSpacing: '-0.01em' }}>
            Your fleet, right where <span style={{ color: 'var(--accent-primary)' }}>you left it</span>.
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
            Loads, quotes, invoices, and fleet intelligence — all in one dashboard, updated in real time.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            {PLAN_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <Check size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 24, padding: '10px 13px', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--card-radius)', background: 'var(--bg-surface-hover)',
            fontSize: 12, color: 'var(--text-secondary)',
          }}>
            Reminder: every completed load also carries a <strong style={{ color: 'var(--text-primary)' }}>0.25% platform fee</strong>,
            charged automatically to the card on file on top of the monthly plan.
          </div>

          <div style={{ marginTop: 20, fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
            BUILT FOR SOUTH AFRICAN ROAD FREIGHT
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="login-split__form">
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
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--status-danger)' }}>
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
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={handleChange}
                style={{
                  ...inputStyle,
                  borderColor: validationErrors.password ? 'var(--status-danger)' : 'var(--border-subtle)',
                  paddingRight: 40,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex' }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {validationErrors.password && (
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--status-danger)' }}>
                {validationErrors.password}
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
              cursor: isPending ? 'wait' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
            disabled={isPending}
          >
            {isPending ? "Signing in..." : "Sign in"}
          </button>

          <button
            type="button"
            className="btn-action btn-ghost"
            onClick={handleDemoLogin}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: 11,
              letterSpacing: '0.08em',
              cursor: isPending ? 'wait' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
            disabled={isPending}
          >
            View Demo
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
    </div>
  );
};

export default Login;
