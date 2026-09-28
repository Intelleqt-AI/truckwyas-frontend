import "./auth-brand.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Check } from "lucide-react";
import { postData } from "@/lib/Api";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileAuthLayout } from "@/components/MobileAuthLayout";

// Kept in sync with core/services/paystack.py (MONTHLY_FEE / MONTHLY_FEE_ITEM_NAME)
// and settings.DELIVERY_FEE_PCT — server-enforced, this is just the up-front
// disclosure so nobody discovers the price for the first time on step 3.
const MONTHLY_FEE = "4,499";
const TAKE_RATE_PCT = "0.25";

const SIGNUP_STEPS = [
  { label: "Create your account", detail: "Name, email and password, just below" },
  { label: "Verify your email", detail: "We send a 6-digit code, valid for 10 minutes" },
  { label: "Add a card & pay", detail: `R${MONTHLY_FEE}/month, charged via Paystack. Your fleet goes live the moment it clears` },
];

// Same list BillingSettings.tsx shows for an active subscription — kept
// identical so nothing you're promised here differs from what you see later.
const PLAN_FEATURES = [
  "Unlimited loads & invoices",
  "AI-powered quote optimisation",
  "Fast Pay capital access (not live yet)",
  "Advanced analytics & reporting",
  "Fleet intelligence dashboard",
  "Multi-user access",
  "API & integrations",
  "Priority support",
];

const rules = [
  { key: 'length',    label: '8+ characters',   test: (p: string) => p.length >= 8 },
  { key: 'upper',     label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower',     label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { key: 'number',    label: 'Number',           test: (p: string) => /[0-9]/.test(p) },
  { key: 'special',   label: 'Special character',test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

// Bar fills use the status dot roles; the label uses the AA -text roles.
function getStrength(password: string) {
  const passed = rules.filter(r => r.test(password)).length;
  if (passed <= 2) return { level: 'Weak',   fill: 'var(--status-danger-dot)',  color: 'var(--status-danger-text)',  width: '20%' };
  if (passed === 3) return { level: 'Fair',   fill: 'var(--status-warning-dot)', color: 'var(--status-warning-text)', width: '50%' };
  if (passed === 4) return { level: 'Good',   fill: 'var(--status-success-dot)', color: 'var(--status-success-text)', width: '75%' };
  return             { level: 'Strong', fill: 'var(--status-success-dot)', color: 'var(--status-success-text)', width: '100%' };
}

const Signup = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
    setValidationErrors(prev => ({ ...prev, [e.target.name]: '' }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Full name is required';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else {
      const failedRules = rules.filter(r => !r.test(formData.password));
      if (failedRules.length > 0) {
        errors.password = `Password must include: ${failedRules.map(r => r.label).join(', ')}`;
      }
    }

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
    if (!validateForm()) return;
    setLoading(true);
    setError(null);
    try {
      const nameParts = formData.name.trim().split(' ');
      const first_name = nameParts[0];
      const last_name = nameParts.slice(1).join(' ');
      await postData({
        url: 'api/v1/auth/register/',
        data: { username: formData.email, email: formData.email, password: formData.password, first_name, last_name },
      });
      navigate(`/verify-email?email=${encodeURIComponent(formData.email)}`);
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
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

  const strength = formData.password ? getStrength(formData.password) : null;

  const formCard = (
    <div style={{ width: '100%', maxWidth: 400, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', padding: 24, boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Create an account</h1>
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>Step 1 of 3. Verification and payment come next</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Full Name */}
        <div>
          <label htmlFor="name" style={labelStyle}>Full name</label>
          <input className="tw-auth-control" id="name" name="name" type="text" placeholder="John Doe" required value={formData.name} onChange={handleChange}
            style={{ ...inputStyle, borderColor: validationErrors.name ? 'var(--status-danger)' : 'var(--border-subtle)' }} />
          {validationErrors.name && <div style={{ marginTop: 6, fontSize: 13, lineHeight: '20px', color: 'var(--status-danger-text)' }}>{validationErrors.name}</div>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" style={labelStyle}>Email</label>
          <input className="tw-auth-control" id="email" name="email" type="email" placeholder="name@example.com" required value={formData.email} onChange={handleChange}
            style={{ ...inputStyle, borderColor: validationErrors.email ? 'var(--status-danger)' : 'var(--border-subtle)' }} />
          {validationErrors.email && <div style={{ marginTop: 6, fontSize: 13, lineHeight: '20px', color: 'var(--status-danger-text)' }}>{validationErrors.email}</div>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <input className="tw-auth-control" id="password" name="password" type={showPassword ? "text" : "password"} required value={formData.password} onChange={handleChange}
              style={{ ...inputStyle, borderColor: validationErrors.password ? 'var(--status-danger)' : 'var(--border-subtle)', paddingRight: 40 }} />
            <button type="button" tabIndex={-1} aria-label="Show or hide password" onClick={() => setShowPassword(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex' }}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Strength bar */}
          {formData.password && strength && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: strength.width, background: strength.fill, borderRadius: 999, transition: 'width 0.2s, background 0.2s' }} />
              </div>
              <div style={{ fontSize: 13, lineHeight: '20px', fontWeight: 500, color: strength.color, marginTop: 4, fontFamily: 'var(--font-sans)' }}>{strength.level.charAt(0).toUpperCase() + strength.level.slice(1)}</div>
              {/* Rule checklist */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6 }}>
                {rules.map(r => (
                  <span key={r.key} style={{ fontSize: 13, lineHeight: '20px', color: r.test(formData.password) ? 'var(--status-success-text)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{r.test(formData.password) ? '✓' : '·'}</span> {r.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {validationErrors.password && <div style={{ marginTop: 6, fontSize: 13, lineHeight: '20px', color: 'var(--status-danger-text)' }}>{validationErrors.password}</div>}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" style={labelStyle}>Confirm password</label>
          <div style={{ position: 'relative' }}>
            <input className="tw-auth-control" id="confirmPassword" name="confirmPassword" type={showConfirm ? "text" : "password"} required value={formData.confirmPassword} onChange={handleChange}
              style={{ ...inputStyle, borderColor: validationErrors.confirmPassword ? 'var(--status-danger)' : 'var(--border-subtle)', paddingRight: 40 }} />
            <button type="button" tabIndex={-1} aria-label="Show or hide password" onClick={() => setShowConfirm(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex' }}>
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {validationErrors.confirmPassword && <div style={{ marginTop: 6, fontSize: 13, lineHeight: '20px', color: 'var(--status-danger-text)' }}>{validationErrors.confirmPassword}</div>}
        </div>

        {error && (
          <div role="alert" style={{ padding: '12px 16px', background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger)', borderRadius: 'var(--radius-nested)', color: 'var(--status-danger-text)', fontSize: 13, lineHeight: '20px' }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-action"
          style={{ width: '100%', padding: '10px 16px', borderRadius: 'var(--radius-control)', fontSize: 14, lineHeight: '20px', letterSpacing: 'normal', minHeight: 40, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
          disabled={loading}>
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: 'var(--link)', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
      </div>
    </div>
  );

  // Everything the desktop content panel shows besides its own logo/eyebrow/
  // title (those become MobileAuthLayout's own header props on mobile) —
  // demoted to a footer below the form there, since none of it blocks
  // completing the form above it.
  const extraContent = (
    <>
      {/* Price card — the thing users currently only discover on step 3 */}
      <div style={{
        border: '1px solid var(--border-active)', borderRadius: 'var(--radius-card)',
        padding: 24, marginBottom: 24, background: 'var(--bg-surface-hover)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 28, lineHeight: '36px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            R{MONTHLY_FEE}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>/ month</span>
        </div>
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
          + {TAKE_RATE_PCT}% of every delivered load's value
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
          Cancel anytime, no long-term contract
        </div>
      </div>

      {/* The 3 steps — sets the expectation up front instead of surprising
          people at the payment step */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {SIGNUP_STEPS.map((step, i) => (
          <div key={step.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              flex: 'none', width: 22, height: 22, borderRadius: '50%',
              border: `1px solid ${i === 0 ? 'var(--text-primary)' : 'var(--border-active)'}`,
              color: i === 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, marginTop: 1, fontVariantNumeric: 'tabular-nums',
            }}>
              {i + 1}
            </div>
            <div>
              <div style={{ fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>{step.label}</div>
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>{step.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 16px' }}>
        {PLAN_FEATURES.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
            <Check size={16} aria-hidden="true" style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 2 }} />
            {f}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-sans)', color: 'var(--text-tertiary)' }}>
        Payments secured by Paystack
      </div>
    </>
  );

  if (isMobile) {
    return (
      <MobileAuthLayout
        eyebrow="One flat price, no hidden tiers"
        title={<>Everything your fleet needs in <span style={{ color: 'var(--text-tertiary)' }}>one subscription</span>.</>}
        footer={extraContent}
      >
        {formCard}
      </MobileAuthLayout>
    );
  }

  return (
    <div className="signup-split">
      <style>{`
        .signup-split {
          /* html/body/#root are pinned to height:100vh + overflow:hidden
             app-wide (the dashboard shell scrolls internally instead) — this
             page's content can be taller than one viewport, so it needs to
             be its own scroll container or the form becomes unreachable. */
          height: 100vh;
          overflow-y: auto;
          display: flex;
          background: var(--bg-deep);
        }
        .signup-split__content, .signup-split__form {
          flex: 1 1 50%;
          min-width: 0;
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .signup-split__form { align-items: center; }
      `}</style>

      {/* Content side — what you're signing up for, before the form asks for anything */}
      <div className="signup-split__content" style={{
        position: 'relative', overflow: 'hidden',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 440, margin: '0 auto' }}>
          <img className="tw-auth-logo" src="/brand/truckwys-logo-transparent.png" alt="TruckWys" style={{ maxHeight: 32, width: 'auto', marginBottom: 40 }} />

          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--status-info-text)', marginBottom: 10 }}>
            One flat price, no hidden tiers
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', lineHeight: '34px', marginBottom: 28 }}>
            Everything your fleet needs in <span style={{ color: 'var(--text-tertiary)' }}>one subscription</span>.
          </div>

          {extraContent}
        </div>
      </div>

      {/* Form side */}
      <div className="signup-split__form">
        {formCard}
      </div>
    </div>
  );
};

export default Signup;
