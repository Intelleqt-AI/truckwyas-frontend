import "./auth-brand.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Check } from "lucide-react";
import { useLogin } from "@/hooks/useLogin";
import { postLoginNavigate } from "@/lib/postLogin";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileAuthLayout } from "@/components/MobileAuthLayout";

// Same list Signup.tsx and BillingSettings.tsx show — kept identical across
// every page that mentions the plan, so returning users see the same promise
// new signups do.
// R7: the sign-in page reminds, it doesn't sell. Three proof points, each
// one line, each something the product does today (no pricing checklist).
const PROOF_POINTS = [
  "Quotes priced from your own costs",
  // R8: checked against the backend (core/signals.py _auto_invoice_on_delivery,
  // AUTO_INVOICE_ON_DELIVERY on by default): marking a load delivered raises
  // its invoice. It is not e-mailed, so the line says "raised", nothing more.
  "Invoices raised the moment a load is delivered",
  "See who owes you, and for how long",
];

const Login = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
    background: 'var(--input-bg, var(--bg-surface))',
    border: '1px solid var(--border-subtle)',
    padding: '8px 12px',
    minHeight: 40,
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-control)',
    fontSize: 14,
    lineHeight: '20px',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-sans)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    lineHeight: '20px',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    color: 'var(--text-primary)',
    marginBottom: 6,
  };

  const formCard = (
    <div style={{
      width: '100%',
      maxWidth: 400,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-card)',
      padding: 24,
      boxSizing: 'border-box',
    }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Sign in to your account
        </h1>
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
          Use the email and password you signed up with
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label htmlFor="username" style={labelStyle}>Email</label>
          <input
            id="username"
            className="tw-auth-control"
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
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: '20px', color: 'var(--status-danger-text)' }}>
              {validationErrors.username}
            </div>
          )}
        </div>

        <div>
          <div className="tw-auth-labelrow" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label htmlFor="password" style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
            <Link
              to="/password-reset"
              className="tw-auth-control"
              style={{
                fontSize: 13,
                lineHeight: '20px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                textDecoration: 'none',
              }}
            >
              Forgot password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              className="tw-auth-control"
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
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex' }}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {validationErrors.password && (
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: '20px', color: 'var(--status-danger-text)' }}>
              {validationErrors.password}
            </div>
          )}
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger)',
            borderRadius: 'var(--radius-nested)',
            color: 'var(--status-danger-text)',
            fontSize: 13,
            lineHeight: '20px',
          }} role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn-action"
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 'var(--radius-control)',
            fontSize: 14,
            lineHeight: '20px',
            letterSpacing: 'normal',
            minHeight: 40,
            cursor: isPending ? 'wait' : 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
          disabled={isPending}
        >
          {isPending ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ marginTop: 4, textAlign: 'center', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
          Just exploring?{" "}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={isPending}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: 'var(--link)',
              fontWeight: 500,
              textDecoration: 'none',
              cursor: isPending ? 'wait' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            View demo
          </button>
        </div>
      </form>

      <div style={{
        marginTop: 24,
        textAlign: 'center',
        fontSize: 13,
        lineHeight: '20px',
        color: 'var(--text-secondary)'
      }}>
        Don't have an account?{" "}
        <Link to="/signup" style={{ color: 'var(--link)', textDecoration: 'none', fontWeight: 500 }}>
          Sign up
        </Link>
      </div>
    </div>
  );

  // Everything the desktop content panel shows besides its own logo/eyebrow/
  // title/subtitle (those become MobileAuthLayout's own header props on
  // mobile) — demoted to a footer below the form there, since none of it
  // blocks completing the form above it.
  const proofList = (
    <ul className="tw-auth-proof">
      {PROOF_POINTS.map(f => (
        <li key={f}>
          <Check size={16} strokeWidth={2} aria-hidden="true" />
          {f}
        </li>
      ))}
    </ul>
  );
  const extraContent = (
    <>
      {proofList}
      <div className="tw-auth-foot">Built for South African road freight</div>
    </>
  );

  if (isMobile) {
    return (
      <MobileAuthLayout
        eyebrow="Welcome back"
        title={<>Your fleet, right where <span style={{ color: 'var(--text-tertiary)' }}>you left it</span>.</>}
        subtitle="Loads, quotes, invoices and your fleet, in one place."
        footer={extraContent}
      >
        {formCard}
      </MobileAuthLayout>
    );
  }

  return (
    <div className="login-split tw-auth-split">
      {/* Brand side: a calm reminder of what's waiting, not a sales pitch.
          Its own surface (white in light, the card surface in dark), and its
          logo line starts at the same y as the form card (tw-auth-split). */}
      <div className="tw-auth-split__brand">
        <div className="tw-auth-split__inner">
          <img className="tw-auth-logo" src="/brand/truckwys-logo-transparent.png" alt="TruckWys" style={{ height: 32, width: 'auto', display: 'block' }} />
          <div className="tw-auth-eyebrow">Welcome back</div>
          <p className="tw-auth-headline">
            Your fleet,<br />right where <span>you left it</span>.
          </p>
          <p className="tw-auth-lede">Loads, quotes, invoices and your fleet, in one place.</p>
          {extraContent}
        </div>
      </div>

      {/* Form side */}
      <div className="tw-auth-split__form">
        {formCard}
      </div>
    </div>
  );
};

export default Login;
