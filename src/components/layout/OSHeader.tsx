/**
 * TruckWys V3 - OS-Style Header
 * Full-width header with logo, agent command bar, status, and avatar
 */

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon, Sun, Moon } from "lucide-react";
import { usePost } from "@/hooks/usePost";

// TruckWys Logo SVG
const LogoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
    <path d="M4 4h16v16H4z" stroke="currentColor" fill="none" />
    <path d="M4 20L20 4" stroke="currentColor" />
    <path d="M4 4l5 5" stroke="var(--accent-primary)" />
  </svg>
);

export function OSHeader() {
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  }, []);

  const { mutate: logout } = usePost({
    onSuccess: () => {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      localStorage.removeItem('user');
      window.location.href = '/login';
    },
    onError: () => {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  });

  const handleLogout = () => {
    logout({ url: 'api/auth/logout/', data: {} });
  };

  const initials = user?.username ? user.username.substring(0, 2).toUpperCase() : "TW";

  return (
    <header className="os-header">
      {/* Logo */}
      <div className="logo">
        <LogoIcon />
        TRUCKWYS<span>OS</span>
      </div>

      {/* Agent Command Bar */}
      <div className="agent-command">
        <div className="agent-icon" />
        <input
          type="text"
          className="agent-input"
          placeholder="Ask Agent to analyze route profitability or generate quote..."
          defaultValue=""
        />
      </div>

      {/* Right Section */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        {/* Status Badge */}
        <div className="status-badge active">
          <span style={{
            width: '6px',
            height: '6px',
            background: 'currentColor',
            borderRadius: '50%'
          }} />
          SYSTEMS ONLINE
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          style={{
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            borderRadius: '2px',
            transition: 'color 0.2s, background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.background = 'var(--bg-surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              style={{
                width: '32px',
                height: '32px',
                background: 'var(--bg-surface-hover)',
                border: theme === 'light' ? '1px solid var(--border-subtle)' : 'none',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => window.location.href = '/settings/profile'}
              style={{ color: 'var(--text-primary)' }}
            >
              <UserIcon className="mr-2 h-4 w-4" />
              <span>View Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: 'var(--border-subtle)' }} />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={handleLogout}
              style={{ color: 'var(--status-danger)' }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
