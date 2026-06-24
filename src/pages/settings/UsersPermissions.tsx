import { useState, useEffect } from "react";
import { fetchData, postData, patchData, deleteData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  manager: 'var(--status-warning)',
  operator: '#3B82F6',
  dispatcher: '#8B5CF6',
  viewer: '#9CA3AF',
  driver: 'var(--status-success)',
  customer: 'var(--text-tertiary)',
};

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  last_active?: string;
}

interface PendingInvite {
  id: number;
  token: string;
  email: string;
  role: string;
  invited_at: string;
  expires_at?: string;
}

interface CurrentUser {
  id: number;
  role: string;
}

export function UsersPermissions() {
  const [users, setUsers] = useState<User[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('operator');
  const [inviting, setInviting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    loadUsers();
    loadCurrentUser();
    loadPendingInvites();
  }, []);

  const loadUsers = () => {
    fetchData('api/v1/users/')
      .then((d: any) => {
        const arr = Array.isArray(d) ? d : (d?.results || []);
        setUsers(arr);
      })
      .catch(() => {
        setUsers([]);
        toast.error('Failed to load users');
      })
      .finally(() => setLoading(false));
  };

  const loadCurrentUser = () => {
    fetchData('api/v1/auth/me/')
      .then((data: any) => setCurrentUser(data))
      .catch(() => {
        // Fallback: try to get from localStorage
        const stored = localStorage.getItem('user');
        if (stored) {
          try {
            setCurrentUser(JSON.parse(stored));
          } catch {
            setCurrentUser(null);
          }
        }
      });
  };

  const loadPendingInvites = () => {
    fetchData('api/v1/auth/invite/')
      .then((d: any) => {
        const arr = Array.isArray(d) ? d : (d?.results || []);
        setPendingInvites(arr);
      })
      .catch(() => {
        // 404 is fine - endpoint might not exist yet
        setPendingInvites([]);
      })
      .finally(() => setLoadingInvites(false));
  };

  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const roleColor = (role: string) => ROLE_COLORS[role?.toLowerCase()] || 'var(--text-tertiary)';

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error('Please enter an email');
      return;
    }
    setInviting(true);
    try {
      await postData({
        url: 'api/v1/auth/invite/',
        data: { email: inviteEmail, role: inviteRole },
      });
      toast.success(`Invite sent to ${inviteEmail}`);
      setShowInvite(false);
      setInviteEmail('');
      setInviteRole('operator');
      loadPendingInvites();
    } catch (err) {
      console.error('Failed to invite user:', err);
      toast.error('Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    if (!isAdmin) {
      toast.error('Only admins can change roles');
      return;
    }
    try {
      await patchData({
        url: `api/v1/users/${userId}/`,
        data: { role: newRole },
      });
      toast.success('Role updated');
      loadUsers();
    } catch (err) {
      console.error('Failed to update role:', err);
      toast.error('Failed to update role');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!isAdmin) {
      toast.error('Only admins can remove users');
      return;
    }
    try {
      await deleteData({ url: `api/v1/users/${userId}/` });
      toast.success('User removed');
      setDeleteConfirm(null);
      loadUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error('Failed to remove user');
    }
  };

  const handleResendInvite = async (token: string) => {
    try {
      await postData({
        url: `api/v1/auth/invite/${token}/resend/`,
        data: {},
      });
      toast.success('Invite resent');
    } catch (err) {
      console.error('Failed to resend invite:', err);
      toast.error('Failed to resend invite');
    }
  };

  const handleRevokeInvite = async (token: string) => {
    if (!isAdmin) {
      toast.error('Only admins can revoke invites');
      return;
    }
    try {
      await deleteData({ url: `api/v1/auth/invite/${token}/` });
      toast.success('Invite revoked');
      loadPendingInvites();
    } catch (err) {
      console.error('Failed to revoke invite:', err);
      toast.error('Failed to revoke invite');
    }
  };

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
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="dispatcher">Dispatcher</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <button className="btn-action" onClick={handleInvite} disabled={inviting}>
              {inviting ? 'SENDING...' : 'SEND INVITE'}
            </button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ padding: 24 }}>
            <div style={{ height: 16, background: 'var(--bg-deep)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
            <div style={{ height: 32, background: 'var(--bg-deep)', borderRadius: 4, marginBottom: 12, width: '40%' }} />
            <div style={{ height: 32, background: 'var(--bg-deep)', borderRadius: 4, width: '40%' }} />
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
                  {isAdmin ? (
                    <Select value={u.role} onValueChange={val => handleRoleChange(u.id, val)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">ADMIN</SelectItem>
                        <SelectItem value="manager">MANAGER</SelectItem>
                        <SelectItem value="operator">OPERATOR</SelectItem>
                        <SelectItem value="dispatcher">DISPATCHER</SelectItem>
                        <SelectItem value="viewer">VIEWER</SelectItem>
                        <SelectItem value="driver">DRIVER</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 7px',
                      border: `1px solid ${roleColor(u.role)}`,
                      color: roleColor(u.role), borderRadius: 2,
                      textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                    }}>{u.role}</span>
                  )}
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
                  {isAdmin && (
                    <button
                      onClick={() => setDeleteConfirm(u.id)}
                      style={{
                        background: 'none', border: '1px solid var(--border-subtle)',
                        color: 'var(--status-danger)', padding: '4px 10px',
                        fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                      }}
                    >REMOVE</button>
                  )}
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending Invites */}
      {!loadingInvites && pendingInvites.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Pending Invites</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                {['Email', 'Role', 'Invited', 'Expires', ''].map(h => (
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
              {pendingInvites.map((inv, i) => (
                <tr key={inv.id} style={{ borderBottom: i < pendingInvites.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-primary)' }}>{inv.email}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 7px',
                      border: `1px solid ${roleColor(inv.role)}`,
                      color: roleColor(inv.role), borderRadius: 2,
                      textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                    }}>{inv.role}</span>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {new Date(inv.invited_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' as const }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleResendInvite(inv.token)}
                        style={{
                          background: 'none', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-tertiary)', padding: '4px 10px',
                          fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                        }}
                      >RESEND</button>
                      {isAdmin && (
                        <button
                          onClick={() => handleRevokeInvite(inv.token)}
                          style={{
                            background: 'none', border: '1px solid var(--border-subtle)',
                            color: 'var(--status-danger)', padding: '4px 10px',
                            fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                          }}
                        >REVOKE</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
            { role: 'Driver', color: ROLE_COLORS.driver, desc: 'Mobile app access for trip management and updates' },
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setDeleteConfirm(null)}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--card-radius)',
            padding: 32,
            maxWidth: 420,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              Remove User?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
              This will permanently remove this user's access. They will no longer be able to log in.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{
                background: 'none', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', padding: '7px 14px',
                fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
              }}>CANCEL</button>
              <button onClick={() => handleDeleteUser(deleteConfirm)} style={{
                background: 'var(--status-danger)', border: 'none',
                color: 'white', padding: '7px 14px',
                fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
              }}>REMOVE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
