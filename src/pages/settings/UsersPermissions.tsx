import '@/pages/table-heading-roles.css';
import '@/pages/settings/settings-brand.css';
import { useState, useEffect } from "react";
import { fetchData, postData, patchData, deleteData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { formatDateTime } from '@/lib/formatters';
import { settingsCardStyle, settingsCardHeaderStyle, settingsCardTitleStyle, settingsLabelStyle, settingsInputStyle, settingsSecondaryButtonStyle, settingsDangerButtonStyle, SettingsPageHeader } from './settingsUi';
import RowActions from '@/components/ui/RowActions';

// Presentation only: the API sends a raw ISO timestamp; show it in the app's
// date format, and anything unparseable verbatim.
const displayLastActive = (v?: string) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : formatDateTime(d);
};

const sectionStyle = settingsCardStyle;
const sectionHeaderStyle: React.CSSProperties = { ...settingsCardHeaderStyle, justifyContent: 'space-between' };
const sectionTitleStyle = settingsCardTitleStyle;
const fieldLabelStyle = settingsLabelStyle;

const roleBadgeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', fontWeight: 500,
  padding: '2px 8px', borderRadius: 'var(--radius-chip)', display: 'inline-block', whiteSpace: 'nowrap',
};

/* Badge text colours use the tested text roles — raw palette swatches
   (#3B82F6, #9CA3AF) measure under 4.5:1 on the light surface. */
const ROLE_COLORS: Record<string, string> = {
  admin: 'var(--status-danger-text, var(--status-danger))',
  manager: 'var(--status-warning-text, var(--status-warning))',
  operator: 'var(--status-info-text, #3B82F6)',
  dispatcher: 'var(--status-info-text, #8B5CF6)',
  viewer: 'var(--text-tertiary)',
  driver: 'var(--status-success-text, var(--status-success))',
  customer: 'var(--text-tertiary)',
};

// Presentation-only labels for known payload values — unknown strings render
// verbatim (own-property lookup; never restyles user data).
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', operator: 'Operator', dispatcher: 'Dispatcher',
  viewer: 'Viewer', driver: 'Driver', customer: 'Customer', partner: 'Partner',
};
const roleDisplay = (role: string) => {
  const key = role?.toLowerCase();
  return Object.prototype.hasOwnProperty.call(ROLE_LABELS, key) ? ROLE_LABELS[key] : role;
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active', invited: 'Invited', inactive: 'Inactive', pending: 'Pending',
};
const statusDisplay = (status: string) => {
  const key = status?.toLowerCase();
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, key) ? STATUS_LABELS[key] : status;
};

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  last_active?: string;
  avatar?: string;
}

interface PendingInvite {
  id: number;
  token: string;
  email: string;
  role: string;
  invited_at: string;
  expires_at?: string;
}

export function UsersPermissions() {
  const { user: currentUser } = useAuth();
  const isDemo = !!currentUser?.is_demo;
  const [users, setUsers] = useState<User[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
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
    if (isDemo) return;
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
    if (isDemo) return;
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
    if (isDemo) return;
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
    if (isDemo) return;
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
    if (isDemo) return;
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
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <SettingsPageHeader title="Users & permissions" description="Manage team access and roles" />

      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Team members</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="settings-control"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users…"
              aria-label="Search users"
              style={{ ...settingsInputStyle, width: 180, maxWidth: '100%' }}
            />
            {isAdmin && (
              <button
                className="btn-action settings-control"
                onClick={() => setShowInvite(!showInvite)}
                disabled={isDemo}
                title={isDemo ? 'Fixed in demo mode' : undefined}
                style={{ minHeight: 40, borderRadius: 'var(--radius-control)', ...(isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
              >Invite user</button>
            )}
          </div>
        </div>

        {/* Invite form */}
        {showInvite && (
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-hover)',
            display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
          }}>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <label htmlFor="invite-email" style={fieldLabelStyle}>Email</label>
              <input
                id="invite-email"
                className="settings-control"
                style={settingsInputStyle}
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="user@company.co.za"
              />
            </div>
            <div>
              <span style={fieldLabelStyle}>Role</span>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger aria-label="Role for invited user">
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
            <button
              className="btn-action settings-control"
              onClick={handleInvite}
              disabled={inviting || isDemo}
              title={isDemo ? 'Fixed in demo mode' : undefined}
              style={{ minHeight: 40, borderRadius: 'var(--radius-control)', ...(isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ padding: 24 }}>
            <div style={{ height: 16, background: 'var(--bg-deep)', borderRadius: 'var(--radius-chip)', marginBottom: 12, width: '60%' }} />
            <div style={{ height: 32, background: 'var(--bg-deep)', borderRadius: 'var(--radius-chip)', marginBottom: 12, width: '40%' }} />
            <div style={{ height: 32, background: 'var(--bg-deep)', borderRadius: 'var(--radius-chip)', width: '40%' }} />
          </div>
        ) : (
          <div className="settings-scroll-region" role="region" aria-label="Team members" tabIndex={0} style={{ overflowX: 'auto' }}>
          <table className="table-heading-roles settings-table settings-table--pin-actions">
            <thead>
              <tr>
                {['User', 'Role', 'Status', 'Last active', ''].map(h => (
                  <th key={h || 'actions'} scope="col" style={{ textAlign: (h === '') ? 'right' : 'left' }}>{h || <span className="sr-only">Actions</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center' as const, padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>No users found</td></tr>
              ) : filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border-row)' }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt={u.name}
                        style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: 'var(--accent-dim)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
                        color: 'var(--avatar-on-dim, var(--accent-primary))', flexShrink: 0,
                      }}>
                        {u.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{u.name}</div>
                      <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  {isAdmin && u.id !== currentUser?.id ? (
                    <Select value={u.role?.toLowerCase()} onValueChange={val => handleRoleChange(u.id, val)} disabled={isDemo}>
                      <SelectTrigger
                        title={isDemo ? 'Fixed in demo mode' : undefined}
                        style={isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                      >
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
                  ) : (
                    <span style={{
                      ...roleBadgeStyle,
                      border: `1px solid ${roleColor(u.role)}`,
                      color: roleColor(u.role),
                    }}>{roleDisplay(u.role)}</span>
                  )}
                </td>
                <td>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', fontWeight: 500,
                    color: u.status?.toLowerCase() === 'active' ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                  }}>{statusDisplay(u.status)}</span>
                </td>
                <td style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                  {displayLastActive(u.last_active)}
                </td>
                <td style={{ textAlign: 'right' as const }}>
                  {isAdmin && (
                    <RowActions
                      label={u.email || `User ${u.id}`}
                      items={[{ label: 'Remove', danger: true, onSelect: () => setDeleteConfirm(u.id), disabled: isDemo }]}
                    />
                  )}
                </td>
              </tr>
            ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Pending Invites */}
      {!loadingInvites && pendingInvites.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Pending invites</h2>
          </div>
          <div className="settings-scroll-region" role="region" aria-label="Pending invites" tabIndex={0} style={{ overflowX: 'auto' }}>
          <table className="table-heading-roles settings-table settings-table--pin-actions">
            <thead>
              <tr>
                {['Email', 'Role', 'Invited', 'Expires', ''].map(h => (
                  <th key={h || 'actions'} scope="col" style={{ textAlign: (h === '') ? 'right' : 'left' }}>{h || <span className="sr-only">Actions</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map((inv, i) => (
                <tr key={inv.id} style={{ borderBottom: i < pendingInvites.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                  <td style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{inv.email}</td>
                  <td>
                    <span style={{
                      ...roleBadgeStyle,
                      border: `1px solid ${roleColor(inv.role)}`,
                      color: roleColor(inv.role),
                    }}>{roleDisplay(inv.role)}</span>
                  </td>
                  <td style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>
                    {new Date(inv.invited_at).toLocaleDateString()}
                  </td>
                  <td style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>
                    {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ textAlign: 'right' as const }}>
                    <RowActions
                      label={inv.email}
                      items={[
                        { label: 'Resend', onSelect: () => handleResendInvite(inv.token), disabled: isDemo },
                        ...(isAdmin ? [{ label: 'Revoke', danger: true, onSelect: () => handleRevokeInvite(inv.token), disabled: isDemo }] : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Roles Reference */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Role permissions</h2>
        </div>
        <div>
          {[
            { role: 'Admin', color: ROLE_COLORS.admin, desc: 'Full platform access including billing and user management' },
            { role: 'Manager', color: ROLE_COLORS.manager, desc: 'View and manage quotes, bookings, invoices, and fleet' },
            { role: 'Operator', color: ROLE_COLORS.operator, desc: 'Create quotes and update bookings; no billing or admin access' },
            { role: 'Viewer', color: ROLE_COLORS.viewer, desc: 'Read-only access to all modules' },
            { role: 'Driver', color: ROLE_COLORS.driver, desc: 'Mobile app access for trip management and updates' },
          ].map((r, i, arr) => (
            <div key={r.role} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '12px 24px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border-row)' : 'none',
            }}>
              <span style={{
                ...roleBadgeStyle,
                border: `1px solid ${r.color}`, color: r.color,
                width: 80, textAlign: 'center' as const,
              }}>{r.role}</span>
              <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--modal-backdrop, rgba(0,0,0,0.6))', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16,
        }} onClick={() => setDeleteConfirm(null)}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-dialog)',
            padding: 24,
            maxWidth: 420,
            width: '100%',
            boxSizing: 'border-box',
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: 8 }}>
              Remove user?
            </h2>
            <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)', marginBottom: 24 }}>
              This will permanently remove this user's access. They will no longer be able to log in.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="settings-control" onClick={() => setDeleteConfirm(null)} style={settingsSecondaryButtonStyle}>Cancel</button>
              <button
                className="settings-control"
                onClick={() => handleDeleteUser(deleteConfirm)}
                disabled={isDemo}
                title={isDemo ? 'Fixed in demo mode' : undefined}
                style={{
                  /* Same destructive treatment as the shared ConfirmModal: danger
                     tint with AA danger text (white on the raw red fails 4.5:1). */
                  ...settingsDangerButtonStyle,
                  background: 'var(--status-danger-bg)',
                  cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1,
                }}
              >Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
