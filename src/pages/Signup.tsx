import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { postData } from "@/lib/Api";

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)', padding: 24 }}>
      <div style={{ marginBottom: 32 }}>
        <img src="/brand/truckwys-logo-transparent.png" alt="TruckWys" style={{ maxHeight: 40, width: 'auto' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 400, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 32 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Create an account</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Enter your information to get started</div>
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
            style={{ width: '100%', padding: '12px 16px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
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
  );
};

export default Signup;
