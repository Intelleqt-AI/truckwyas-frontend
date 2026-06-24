import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LiveEvents } from '@/components/LiveEvents';
import { NotificationBell } from '@/components/NotificationBell';

export function OSLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('tw-theme') as 'dark' | 'light') || 'dark';
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [agentQuery, setAgentQuery] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Get user initials and role from stored user data
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();
  const userName = storedUser.name || storedUser.username || 'User';
  const userRole = (storedUser.role || 'VIEWER').toUpperCase();
  const initials =
    userName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'TW';

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('onboarding_done');
    navigate('/login');
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tw-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  // Role-based nav access control
  const NAV_ACCESS: Record<string, string[]> = {
    ADMIN: ['/', '/bookings', '/fleet', '/customers', '/invoices', '/capital', '/insights', '/copilot', '/settings'],
    MANAGER: ['/', '/bookings', '/fleet', '/customers', '/invoices', '/capital', '/insights', '/copilot', '/settings'],
    OPERATOR: ['/', '/bookings', '/fleet', '/customers', '/invoices', '/capital', '/insights', '/copilot'],
    DISPATCHER: ['/', '/bookings', '/fleet', '/customers', '/invoices', '/capital', '/insights', '/copilot'],
    VIEWER: ['/', '/bookings', '/fleet', '/customers', '/insights', '/copilot'],
    DRIVER: ['/', '/bookings'],
  };

  const navItems = [
    {
      path: '/',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      label: 'Home',
    },
    {
      path: '/bookings',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
      label: 'Bookings',
    },
    {
      path: '/fleet',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="3" width="15" height="13" rx="1" />
          <path d="M16 8h4l3 5v3h-7V8z" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
      label: 'Fleet',
    },
    {
      path: '/customers',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      label: 'Customers',
    },
    {
      path: '/invoices',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      label: 'Finance',
    },
    {
      path: '/capital',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
      label: 'Capital',
    },
    {
      path: '/insights',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      label: 'Insights',
    },
    {
      path: '/copilot',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v3a2 2 0 0 1 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 0-4V7a2 2 0 0 1 2-2h3V4a2 2 0 0 1 2-2z" />
          <circle cx="9" cy="13" r="1" />
          <circle cx="15" cy="13" r="1" />
        </svg>
      ),
      label: 'Copilot',
    },
    // Partner page removed — partner portal is a separate app at partners.truckwys.com
  ];

  const allowedPaths = NAV_ACCESS[userRole] || NAV_ACCESS['VIEWER'];
  const visibleNavItems = navItems.filter(item => allowedPaths.includes(item.path));
  const canAccessSettings = !['VIEWER', 'DRIVER'].includes(userRole);

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));

  return (
    <div className="os-container" style={{ gridTemplateColumns: '60px 1fr', gridTemplateRows: '60px 1fr' }}>
      <LiveEvents />
      <div className="ambient-glow" />

      {/* HEADER */}
      <header className="os-header">
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img
            src="/brand/truckwys-logo.png"
            alt="Truckwys"
            style={{
              height: 28,
              width: 'auto',
              display: 'block',
              filter: theme === 'dark' ? 'invert(1) brightness(2)' : 'none',
            }}
          />
        </div>
        <div className="agent-command">
          <div className="agent-icon" />
          <input
            type="text"
            className="agent-input"
            placeholder="Ask Copilot anything..."
            value={agentQuery}
            onChange={e => setAgentQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && agentQuery.trim()) {
                navigate(`/copilot?q=${encodeURIComponent(agentQuery.trim())}`);
                setAgentQuery('');
              }
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="status-badge active">
            <span style={{ width: 6, height: 6, background: 'currentColor', borderRadius: '50%', display: 'inline-block' }} />
            ONLINE
          </div>
          <NotificationBell />
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <div ref={profileRef} style={{ position: 'relative' }}>
            <div
              onClick={() => setShowProfileMenu(p => !p)}
              style={{
                width: 30,
                height: 30,
                background: 'var(--accent-dim)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                color: 'var(--accent-primary)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title={userName}
            >
              {initials}
            </div>
            {showProfileMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: 38,
                  right: 0,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 2,
                  minWidth: 180,
                  zIndex: 1000,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}
              >
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {userName}
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {storedUser.email || storedUser.username || ''}
                  </div>
                </div>
                <div
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/settings');
                  }}
                  style={{
                    padding: '10px 16px',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    letterSpacing: '0.05em',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                  PROFILE & SETTINGS
                </div>
                <div
                  onClick={handleLogout}
                  style={{
                    padding: '10px 16px',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--status-danger)',
                    cursor: 'pointer',
                    letterSpacing: '0.05em',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  SIGN OUT
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* LEFT NAV */}
      <nav className="os-nav" aria-label="Main navigation">
        {visibleNavItems.map(item => (
          <Link
            key={item.path}
            className={`nav-item${isActive(item.path) ? ' active' : ''}`}
            // onClick={() => navigate()}
            to={item.path}
            role="button"
            aria-label={`Navigate to ${item.label}`}
            // tabIndex={0}
            // onKeyDown={e => e.key === 'Enter' && navigate(item.path)}
          >
            {item.icon}
            <div className="nav-tooltip">{item.label}</div>
          </Link>
        ))}
        {canAccessSettings && (
          <div
            className={`nav-item${location.pathname.startsWith('/settings') ? ' active' : ''}`}
            onClick={() => navigate('/settings')}
            role="button"
            aria-label="Navigate to Settings"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && navigate('/settings')}
            style={{ marginTop: 'auto', marginBottom: 16 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <div className="nav-tooltip">Settings</div>
          </div>
        )}
      </nav>

      {/* CONTENT */}
      <main
        style={{
          gridColumn: '2 / -1',
          overflowY: 'auto',
          padding: 24,
          background: 'var(--bg-deep)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {children}
      </main>
    </div>
  );
}
