import { useState, useEffect } from "react";
import { fetchData } from "@/lib/Api";

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
  marginBottom: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: '14px 20px',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'var(--status-danger)',
  manager: 'var(--accent-primary)',
  operator: 'var(--status-warning)',
  viewer: 'var(--text-tertiary)',
};

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  last_active?: string;
}

export function UsersPermissions() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('operator');

  useEffect(() => {
    fetchData('api/users/')
      .then((d: any) => {
        const arr = Array.isArray(d) ? d : (d?.results || []);
        setUsers(arr);
      })
      .catch(() => {
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const roleColor = (role: string) => ROLE_COLORS[role?.toLowerCase()] || 'var(--text-tertiary)';

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Users & Permissions</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Manage team access and roles</div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Team Members</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users..."
              style={{
                background: 'var(--input-bg)', border: '1px solid var(--border-subtle)',
                borderRadius: 2, padding: '6px 10px', color: 'var(--text-primary)',
                fontSize: 12, outline: 'none', width: 180,
              }}
            />
            <button className="btn-action" onClick={() => setShowInvite(!showInvite)}>+ INVITE</button>
          </div>
        </div>

        {/* Invite form */}
        {showInvite && (
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-hover)',
            display: 'flex', gap: 12, alignItems: 'flex-end',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase' as const,
                letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 6,
              }}>Email</div>
              <input
                style={{
                  width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)',
                  borderRadius: 2, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                }}
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="user@company.co.za"
              />
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase' as const,
                letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 6,
              }}>Role</div>
              <select style={{
                background: 'var(--input-bg)', border: '1px solid var(--border-subtle)',
                borderRadius: 2, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 12,
                outline: 'none', cursor: 'pointer',
              }}
                value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button className="btn-action" onClick={() => { setShowInvite(false); setInviteEmail(''); }}>
              SEND INVITE
            </button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ padding: 24 }}>
            <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
            <div style={{ height: 32, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '40%' }} />
            <div style={{ height: 32, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                {['User', 'Role', 'Status', 'Last Active', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 20px', textAlign: 'left' as const,
                    fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                    borderBottom: '1px solid var(--border-subtle)', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center' as const, padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>No users found</td></tr>
              ) : filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border-row)' }}>
                <td style={{ padding: '12px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'var(--accent-dim)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11,
                      color: 'var(--accent-primary)', flexShrink: 0,
                    }}>
                      {u.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 20px' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 7px',
                    border: `1px solid ${roleColor(u.role)}`,
                    color: roleColor(u.role), borderRadius: 2,
                    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                  }}>{u.role}</span>
                </td>
                <td style={{ padding: '12px 20px' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: u.status === 'active' ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                    textTransform: 'uppercase' as const,
                  }}>{u.status}</span>
                </td>
                <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {u.last_active || '—'}
                </td>
                <td style={{ padding: '12px 20px', textAlign: 'right' as const }}>
                  <button style={{
                    background: 'none', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-tertiary)', padding: '4px 8px',
                    fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                  }}>···</button>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Roles Reference */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Role Permissions</span>
        </div>
        <div style={{ padding: '8px 0 4px' }}>
          {[
            { role: 'Admin', color: ROLE_COLORS.admin, desc: 'Full platform access including billing and user management' },
            { role: 'Manager', color: ROLE_COLORS.manager, desc: 'View and manage quotes, bookings, invoices, and fleet' },
            { role: 'Operator', color: ROLE_COLORS.operator, desc: 'Create quotes and update bookings; no billing or admin access' },
            { role: 'Viewer', color: ROLE_COLORS.viewer, desc: 'Read-only access to all modules' },
          ].map((r, i, arr) => (
            <div key={r.role} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '12px 20px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border-row)' : 'none',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 8px',
                border: `1px solid ${r.color}`, color: r.color,
                borderRadius: 2, textTransform: 'uppercase' as const, width: 80, textAlign: 'center' as const,
              }}>{r.role}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
