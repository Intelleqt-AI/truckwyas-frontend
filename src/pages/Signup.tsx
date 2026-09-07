import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Check } from "lucide-react";
import { postData } from "@/lib/Api";

// Kept in sync with core/services/paystack.py (MONTHLY_FEE / MONTHLY_FEE_ITEM_NAME)
// and settings.DELIVERY_FEE_PCT — server-enforced, this is just the up-front
// disclosure so nobody discovers the price for the first time on step 3.
const MONTHLY_FEE = "4,499";
const TAKE_RATE_PCT = "0.25";

const SIGNUP_STEPS = [
  { label: "Create your account", detail: "Name, email, password — just below" },
  { label: "Verify your email", detail: "We send a 6-digit code, valid for 10 minutes" },
  { label: "Add a card & pay", detail: `R${MONTHLY_FEE}/month, charged via Paystack — your fleet goes live the moment it clears` },
];

// Same list BillingSettings.tsx shows for an active subscription — kept
// identical so nothing you're promised here differs from what you see later.
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

const rules = [
  { key: 'length',    label: '8+ characters',   test: (p: string) => p.length >= 8 },
  { key: 'upper',     label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower',     label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { key: 'number',    label: 'Number',           test: (p: string) => /[0-9]/.test(p) },
  { key: 'special',   label: 'Special character',test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function getStrength(password: string) {
  const passed = rules.filter(r => r.test(password)).length;
  if (passed <= 2) return { level: 'Weak',   color: 'var(--status-danger)',  width: '20%' };
  if (passed === 3) return { level: 'Fair',   color: '#f59e0b',               width: '50%' };
  if (passed === 4) return { level: 'Good',   color: '#84cc16',               width: '75%' };
  return             { level: 'Strong', color: 'var(--status-success)',  width: '100%' };
}

const Signup = () => {
  const navigate = useNavigate();
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
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    padding: '12px 14px',
    color: 'var(--text-primary)',
    borderRadius: 2,
    fontSize: 13,
    outline: 'none',
    width: '100%',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
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

  const strength = formData.password ? getStrength(formData.password) : null;

  return (
    <div className="signup-split">
      <style>{`
        .signup-split {
          /* html/body/#root are pinned to height:100vh + overflow:hidden
             app-wide (the dashboard shell scrolls internally instead) — this
             page's content can be taller than one viewport (esp. the stacked
             mobile layout below), so it needs to be its own scroll container
             or the form at the bottom becomes unreachable. */
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
        @media (max-width: 860px) {
          .signup-split { flex-direction: column; }
          .signup-split__content, .signup-split__form { flex: none; padding: 32px 24px; }
        }
      `}</style>

      {/* Content side — what you're signing up for, before the form asks for anything */}
      <div className="signup-split__content" style={{
        position: 'relative', overflow: 'hidden',
        background: `radial-gradient(120% 100% at 0% 0%, var(--glow-color), var(--glow-transparent)), var(--bg-surface)`,
        borderRight: '1px solid var(--border-subtle)',
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 440, margin: '0 auto' }}>
          <img src="/brand/truckwys-logo-transparent.png" alt="TruckWys" style={{ maxHeight: 32, width: 'auto', marginBottom: 40 }} />

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 10 }}>
            One flat price, no hidden tiers
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 28, letterSpacing: '-0.01em' }}>
            Everything your fleet needs — <span style={{ color: 'var(--accent-primary)' }}>one subscription</span>.
          </div>

          {/* Price card — the thing users currently only discover on step 3 */}
          <div style={{
            border: '1px solid var(--border-active)', borderRadius: 'var(--card-radius)',
            padding: 24, marginBottom: 28, background: 'var(--bg-surface-hover)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                R{MONTHLY_FEE}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>/ month</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              + {TAKE_RATE_PCT}% of every delivered load's value
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
              CANCEL ANYTIME — NO LONG-TERM CONTRACT
            </div>
          </div>

          {/* The 3 steps — sets the expectation up front instead of surprising
              people at the payment step */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
            {SIGNUP_STEPS.map((step, i) => (
              <div key={step.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  flex: 'none', width: 22, height: 22, borderRadius: '50%',
                  border: `1px solid ${i === 0 ? 'var(--accent-primary)' : 'var(--border-active)'}`,
                  color: i === 0 ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, marginTop: 1,
                }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{step.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>{step.detail}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            {PLAN_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <Check size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 32, fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
            PAYMENTS SECURED BY PAYSTACK
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="signup-split__form">
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 32 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Create an account</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Step 1 of 3 — verification and payment come next</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Full Name */}
          <div>
            <label htmlFor="name" style={labelStyle}>Full Name</label>
            <input id="name" name="name" type="text" placeholder="John Doe" required value={formData.name} onChange={handleChange}
              style={{ ...inputStyle, borderColor: validationErrors.name ? 'var(--status-danger)' : 'var(--border-subtle)' }} />
            {validationErrors.name && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--status-danger)' }}>{validationErrors.name}</div>}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" style={labelStyle}>Email</label>
            <input id="email" name="email" type="email" placeholder="name@example.com" required value={formData.email} onChange={handleChange}
              style={{ ...inputStyle, borderColor: validationErrors.email ? 'var(--status-danger)' : 'var(--border-subtle)' }} />
            {validationErrors.email && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--status-danger)' }}>{validationErrors.email}</div>}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input id="password" name="password" type={showPassword ? "text" : "password"} required value={formData.password} onChange={handleChange}
                style={{ ...inputStyle, borderColor: validationErrors.password ? 'var(--status-danger)' : 'var(--border-subtle)', paddingRight: 40 }} />
              <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex' }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength bar */}
            {formData.password && strength && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: strength.width, background: strength.color, borderRadius: 2, transition: 'width 0.2s, background 0.2s' }} />
                </div>
                <div style={{ fontSize: 10, color: strength.color, marginTop: 4, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>{strength.level.toUpperCase()}</div>
                {/* Rule checklist */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6 }}>
                  {rules.map(r => (
                    <span key={r.key} style={{ fontSize: 11, color: r.test(formData.password) ? 'var(--status-success)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span>{r.test(formData.password) ? '✓' : '·'}</span> {r.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {validationErrors.password && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--status-danger)' }}>{validationErrors.password}</div>}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" style={labelStyle}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input id="confirmPassword" name="confirmPassword" type={showConfirm ? "text" : "password"} required value={formData.confirmPassword} onChange={handleChange}
                style={{ ...inputStyle, borderColor: validationErrors.confirmPassword ? 'var(--status-danger)' : 'var(--border-subtle)', paddingRight: 40 }} />
              <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex' }}>
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {validationErrors.confirmPassword && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--status-danger)' }}>{validationErrors.confirmPassword}</div>}
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger)', borderRadius: 2, color: 'var(--status-danger)', fontSize: 12 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn-action"
            style={{ width: '100%', padding: '12px 16px', fontSize: 11, letterSpacing: '0.08em', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
            disabled={loading}>
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Signup;
