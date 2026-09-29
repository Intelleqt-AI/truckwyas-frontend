import { fetchAllPages } from '@/components/insights/findings';
import '@/pages/table-heading-roles.css';
import '@/pages/ops-tiles.css';
import '@/pages/settings/settings-brand.css';
import '@/pages/bookings-section.css';
import { useState, useEffect } from "react";
import { fetchData, postData, patchData, deleteData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { useFocusTrap, latestModal } from '@/hooks/useFocusTrap';
import { settingsCardStyle, settingsCardHeaderStyle, settingsCardTitleStyle, settingsLabelStyle, settingsInputStyle, settingsSecondaryButtonStyle, settingsDangerButtonStyle, SettingsPageHeader } from './settingsUi';
import RowActions from '@/components/ui/RowActions';
import { StatusChip } from '@/components/ui/StatusChip';

// Presentation only: the API sends a raw ISO timestamp; show it in the app's
// date format, and anything unparseable verbatim.
const displayLastActive = (v?: string) => {
  if (!v) return 'Never';
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

/* Roles are not states: every role badge is the same neutral outline, so
   colour stays reserved for status (DESIGN-PRINCIPLES §4). */
const ROLE_COLORS: Record<string, string> = {};

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
  // Role is plain text in the table; "Change role" in the row menu opens this.
  const [roleEdit, setRoleEdit] = useState<{ user: User; role: string } | null>(null);
  useFocusTrap(latestModal, !!roleEdit);

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

  // Which users are also drivers (by email), so a driver holding the Admin
  // role is visible. Roles are shown exactly as the API returns them; this
  // page never changes a role except through "Change role".
  const [driverEmails, setDriverEmails] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetchAllPages<any>('api/v1/drivers/')
      .then(r => setDriverEmails(new Set(r.rows.map((d: any) => String(d.user_details?.email || d.email || '').toLowerCase()).filter(Boolean))))
      .catch(() => setDriverEmails(new Set()));
  }, []);

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
  const isDriver = (u: User) => !!u.email && driverEmails.has(u.email.toLowerCase());
  const adminDrivers = users.filter(u => u.role?.toLowerCase() === 'admin' && isDriver(u)).length;

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
    <div style={{ maxWidth: 'var(--form-max, 720px)', minWidth: 0 }}>
      <SettingsPageHeader title="Users and permissions" description="Manage team access and roles" />

      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Team members</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="settings-control st-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users…"
              aria-label="Search users"
              style={{ ...settingsInputStyle, height: 'var(--control-h, 36px)', minHeight: 'var(--control-h, 36px)', paddingTop: 0, paddingBottom: 0, width: 220, maxWidth: '100%' }}
            />
            {isAdmin && (
              <button
                className="btn-action settings-control"
                onClick={() => setShowInvite(!showInvite)}
                disabled={isDemo}
                title={isDemo ? 'Fixed in demo mode' : undefined}
                style={{ minHeight: 'var(--control-h, 36px)', borderRadius: 'var(--radius-control)', ...(isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
              >Invite user</button>
            )}
          </div>
        </div>

        {/* Invite form */}
        {showInvite && (
          <div style={{
            padding: '16px var(--card-pad, 20px)',
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
              style={{ minHeight: 'var(--control-h, 36px)', borderRadius: 'var(--radius-control)', ...(isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        )}

        {/* A driver with full admin rights is worth knowing about; say it once, calmly. */}
        {!loading && adminDrivers > 0 && (
          <p className="st-note">
            <span className="bk-dot bk-dot--warning" aria-hidden="true" />
            {adminDrivers} {adminDrivers === 1 ? 'driver has' : 'drivers have'} the Admin role, with billing and user access.
          </p>
        )}

        {/* Table */}
        {loading ? (
          // Real head plus placeholder rows at the final row height (65px, avatar
          // and two lines), so the cards below do not move when users arrive.
          <table className="table-heading-roles settings-table" aria-busy="true" aria-label="Loading team members">
            <thead><tr>{['User', 'Role', 'Status', 'Last active', ''].map(h => <th key={h || 'a'} scope="col" className={h === 'Role' || h === 'Last active' ? 'st-col-phone' : undefined}>{h}</th>)}</tr></thead>
            <tbody>
              {Array.from({ length: 12 }, (_, i) => (
                <tr key={i} aria-hidden="true" style={{ borderBottom: '1px solid var(--border-row)', height: 65 }}>
                  <td><span className="ops-skel" style={{ width: 180, height: 12 }} /></td>
                  <td className="st-col-phone"><span className="ops-skel" style={{ width: 60 }} /></td>
                  <td><span className="ops-skel" style={{ width: 56 }} /></td>
                  <td className="st-col-phone"><span className="ops-skel" style={{ width: 100 }} /></td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="settings-scroll-region" role="region" aria-label="Team members" tabIndex={0} style={{ overflowX: 'auto' }}>
          <table className="table-heading-roles settings-table settings-table--pin-actions">
            <thead>
              <tr>
                {['User', 'Role', 'Status', 'Last active', ''].map(h => (
                  <th key={h || 'actions'} scope="col" className={h === 'Role' || h === 'Last active' ? 'st-col-phone' : undefined} style={{ textAlign: (h === '') ? 'right' : 'left' }}>{h || <span className="sr-only">Actions</span>}</th>
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
                      <div aria-hidden="true" style={{
                        width: 30, height: 30, borderRadius: '50%', boxSizing: 'border-box',
                        background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
                        color: 'var(--text-secondary)', flexShrink: 0,
                      }}>
                        {u.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{u.name}</div>
                      <div className="st-email" title={u.email} style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>{/* A break opportunity before "@", so a wrapped email splits there, not mid-word. */}{String(u.email || '').split('@')[0]}{String(u.email || '').includes('@') && <><wbr />@{String(u.email).split('@').slice(1).join('@')}</>}</div>
                    </div>
                  </div>
                </td>
                <td className="st-col-phone">
                  <span className="st-role" style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{roleDisplay(u.role)}</span>
                  {isDriver(u) && u.role?.toLowerCase() !== 'driver' && (
                    <span style={{ display: 'block', fontSize: 12, lineHeight: '16px', color: 'var(--text-tertiary)' }}>Also a driver</span>
                  )}
                </td>
                <td>
                  <StatusChip status={u.status} label={statusDisplay(u.status)} size="sm" />
                </td>
                <td className="st-col-phone" style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                  {displayLastActive(u.last_active)}
                </td>
                <td style={{ textAlign: 'right' as const }}>
                  {isAdmin && (
                    <RowActions
                      label={u.email || `User ${u.id}`}
                      items={[
                        ...(u.id !== currentUser?.id ? [{
                          label: 'Change role',
                          onSelect: () => setRoleEdit({ user: u, role: u.role?.toLowerCase() || 'operator' }),
                          disabled: isDemo,
                          title: isDemo ? 'Fixed in demo mode' : undefined,
                        }] : []),
                        { label: 'Remove', danger: true, onSelect: () => setDeleteConfirm(u.id), disabled: isDemo },
                      ]}
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
                    <span style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{roleDisplay(inv.role)}</span>
                  </td>
                  <td style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>
                    {formatDate(inv.invited_at)}
                  </td>
                  <td style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>
                    {inv.expires_at ? formatDate(inv.expires_at) : 'No expiry'}
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
              padding: '12px var(--card-pad, 20px)',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border-row)' : 'none',
            }}>
              <span style={{ width: 96, flexShrink: 0, fontSize: 14, lineHeight: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>{r.role}</span>
              <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Change role: same PATCH as before, now behind one row action. */}
      {roleEdit && (
        <div className="bk-dialog-backdrop" onClick={() => setRoleEdit(null)}>
          <div className="bk-dialog" role="dialog" aria-modal="true" aria-labelledby="role-edit-title" onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') setRoleEdit(null); }}>
            <h2 className="bk-dialog__title" id="role-edit-title">Change role</h2>
            <p className="bk-dialog__body">{roleEdit.user.name || roleEdit.user.email} is now {roleDisplay(roleEdit.user.role).toLowerCase()}.</p>
            <span style={fieldLabelStyle} id="role-edit-label">New role</span>
            <Select value={roleEdit.role} onValueChange={(val) => setRoleEdit({ ...roleEdit, role: val })}>
              <SelectTrigger aria-labelledby="role-edit-label" data-autofocus>
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
            <div className="bk-dialog__footer">
              <button type="button" className="bk-btn bk-btn--secondary" onClick={() => setRoleEdit(null)}>Cancel</button>
              <button
                type="button"
                className="bk-btn bk-btn--primary"
                disabled={isDemo || roleEdit.role === roleEdit.user.role?.toLowerCase()}
                onClick={() => { const { user, role } = roleEdit; setRoleEdit(null); handleRoleChange(user.id, role); }}
              >
                Save role
              </button>
            </div>
          </div>
        </div>
      )}

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
            padding: 'var(--card-pad, 20px)',
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
