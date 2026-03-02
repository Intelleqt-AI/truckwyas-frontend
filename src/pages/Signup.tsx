import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { postData } from "@/lib/Api";

const Signup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nameParts = formData.name.split(' ');
      const first_name = nameParts[0];
      const last_name = nameParts.slice(1).join(' ');

      await postData({
        url: 'api/v1/auth/register/',
        data: {
          username: formData.email,
          email: formData.email,
          password: formData.password,
          first_name,
          last_name,
        }
      });

      navigate("/login");
    } catch (error: any) {
      console.error("Signup error:", error);
      setError(error.message || "Failed to create account. Please try again.");
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
              style={inputStyle}
            />
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
              style={inputStyle}
            />
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
              style={inputStyle}
            />
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
