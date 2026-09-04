import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, postData, patchData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { Loader } from '@/components/Loader';
import { ConfirmModal } from '@/components/ConfirmModal';

// Fuller replacement for the inline users table on AdminDashboard.tsx — adds
// a status filter, account creation, and per-row account actions (lock /
// unlock / password reset) and role changes. Self-contained: owns its own
// query, so it can be dropped into AdminDashboard (or anywhere else) with no
// required props.

const cardStyle: React.CSSProperties = { padding: 20 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 };
const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
  padding: '8px 12px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', width: 240,
};
const selectStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
  padding: '8px 10px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', cursor: 'pointer',
};
const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
  letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)',
};
const tdStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 12.5, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-row)',
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: '5px 10px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
  borderRadius: 2, fontSize: 10.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', cursor: 'pointer',
};

const ROLES = ['ADMIN', 'MANAGER', 'OPERATOR', 'DISPATCHER', 'VIEWER', 'DRIVER', 'CUSTOMER', 'PARTNER'] as const;
type Role = typeof ROLES[number];

const fmt = (dateStr?: string | null) =>
  dateStr ? new Date(dateStr).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

interface AdminUserRow {
  id: number | string;
  name: string;
  email: string;
  company_id: number | string | null;
  company_name: string | null;
  role: Role | string;
  is_active: boolean;
  is_superuser: boolean;
  is_deleted: boolean;
  last_login: string | null;
}

type PendingAction = 'lock' | 'unlock' | 'reset_password' | 'role' | 'delete';

export default function UsersTable() {
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('');

  // Per-row in-flight action, so we can disable just the one row's controls
  // rather than freezing the whole table on any single click.
  const [pending, setPending] = useState<{ id: AdminUserRow['id']; kind: PendingAction } | null>(null);
  const [lockTarget, setLockTarget] = useState<AdminUserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryKey = ['admin-users-table', debouncedSearch, statusFilter];
  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      fetchData(
        `api/v1/admin/users/?search=${encodeURIComponent(debouncedSearch)}${statusFilter ? `&status=${statusFilter}` : ''}`
      ),
  });

  const users: AdminUserRow[] = data?.results || [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-users-table'] });

  const resetCreateForm = () => {
    setNewEmail('');
    setNewFirstName('');
    setNewLastName('');
  };

  const handleCreate = async () => {
    const email = newEmail.trim();
    if (!email) {
      toast.error('Email is required');
      return;
    }
    setCreating(true);
    try {
      const res = await postData({
        url: 'api/v1/admin/users/create/',
        data: {
          email,
          ...(newFirstName.trim() ? { first_name: newFirstName.trim() } : {}),
          ...(newLastName.trim() ? { last_name: newLastName.trim() } : {}),
        },
      });
      toast.success(`Account created — a setup email was sent to ${res?.email || email} so they can set a password and onboard their company.`);
      resetCreateForm();
      setShowCreate(false);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const runAction = async (user: AdminUserRow, action: 'lock' | 'unlock' | 'reset_password' | 'delete') => {
    setPending({ id: user.id, kind: action });
    try {
      const res = await postData({ url: `api/v1/admin/users/${user.id}/action/`, data: { action } });
      if (action === 'reset_password') {
        toast.success(`Password reset email sent to ${user.email}`);
      } else if (action === 'delete') {
        toast.success(`${user.name || user.email} deleted`);
        // Deleted users drop out of the default (non-include_deleted) list
        // server-side too — mirror that locally instead of refetching.
        qc.setQueryData(queryKey, (old: any) => {
          if (!old?.results) return old;
          return { ...old, count: old.count - 1, results: old.results.filter((u: AdminUserRow) => u.id !== res.id) };
        });
      } else {
        toast.success(action === 'lock' ? `${user.name || user.email} locked out` : `${user.name || user.email} unlocked`);
        qc.setQueryData(queryKey, (old: any) => {
          if (!old?.results) return old;
          return { ...old, results: old.results.map((u: AdminUserRow) => (u.id === res.id ? { ...u, is_active: res.is_active } : u)) };
        });
      }
    } catch (e: any) {
      toast.error(e?.message || `Failed to ${action.replace('_', ' ')}`);
    } finally {
      setPending(null);
      setLockTarget(null);
      setDeleteTarget(null);
    }
  };

  const handleRoleChange = async (user: AdminUserRow, role: string) => {
    setPending({ id: user.id, kind: 'role' });
    try {
      const res = await patchData({ url: `api/v1/admin/users/${user.id}/role/`, data: { role } });
      qc.setQueryData(queryKey, (old: any) => {
        if (!old?.results) return old;
        return { ...old, results: old.results.map((u: AdminUserRow) => (u.id === res.id ? { ...u, role: res.role } : u)) };
      });
      toast.success('Role updated');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update role');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="card" style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ ...sectionTitleStyle, marginBottom: 0 }}>Users {data ? `(${data.count})` : ''}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={inputStyle}
            placeholder="Search name, email, company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select style={selectStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value as '' | 'active' | 'inactive')}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="btn-action" style={{ fontSize: 11 }} onClick={() => setShowCreate(s => !s)}>
            {showCreate ? 'Cancel' : '+ Create User'}
          </button>
        </div>
      </div>

      {showCreate && (
        <div
          style={{
            display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
            padding: 16, marginBottom: 16, background: 'var(--bg-surface-hover, var(--bg-surface))',
            border: '1px solid var(--border-subtle)', borderRadius: 2,
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Email *
            </div>
            <input style={{ ...inputStyle, width: 240 }} type="email" placeholder="user@company.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              First name
            </div>
            <input style={{ ...inputStyle, width: 160 }} placeholder="Optional" value={newFirstName} onChange={e => setNewFirstName(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Last name
            </div>
            <input style={{ ...inputStyle, width: 160 }} placeholder="Optional" value={newLastName} onChange={e => setNewLastName(e.target.value)} />
          </div>
          <button className="btn-action" style={{ fontSize: 11 }} disabled={creating} onClick={handleCreate}>
            {creating ? 'Creating…' : 'Create'}
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', flexBasis: '100%' }}>
            Creates a bare account with no company. They'll get an email to set their password and can then onboard their own company.
          </div>
        </div>
      )}

      {isLoading ? (
        <Loader size={24} />
      ) : (
        <div style={{ overflowX: 'auto', opacity: isFetching ? 0.7 : 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Last login</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const rowPending = pending?.id === u.id ? pending.kind : null;
                return (
                  <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.55 }}>
                    <td style={tdStyle}>
                      {u.name || '—'}
                      {u.is_superuser && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--status-warning)' }}>SUPERUSER</span>}
                    </td>
                    <td style={tdStyle}>{u.email}</td>
                    <td style={tdStyle}>{u.company_name || '—'}</td>
                    <td style={tdStyle}>
                      <select
                        style={{ ...selectStyle, padding: '4px 8px', fontSize: 11 }}
                        value={u.role}
                        disabled={rowPending === 'role'}
                        onChange={e => handleRoleChange(u, e.target.value)}
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                        {!ROLES.includes(u.role as Role) && <option value={u.role}>{u.role}</option>}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <span className={`status-badge ${u.is_active ? 'active' : 'delayed'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td style={tdStyle}>{fmt(u.last_login)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {u.is_active ? (
                          <button
                            style={{ ...secondaryBtnStyle, color: 'var(--status-danger)' }}
                            disabled={!!rowPending}
                            onClick={() => setLockTarget(u)}
                          >
                            {rowPending === 'lock' ? 'Locking…' : 'Lock'}
                          </button>
                        ) : (
                          <button
                            style={secondaryBtnStyle}
                            disabled={!!rowPending}
                            onClick={() => runAction(u, 'unlock')}
                          >
                            {rowPending === 'unlock' ? 'Unlocking…' : 'Unlock'}
                          </button>
                        )}
                        <button
                          style={secondaryBtnStyle}
                          disabled={!!rowPending}
                          onClick={() => runAction(u, 'reset_password')}
                        >
                          {rowPending === 'reset_password' ? 'Sending…' : 'Reset password'}
                        </button>
                        {!u.is_superuser && (
                          <button
                            style={{ ...secondaryBtnStyle, color: 'var(--status-danger)', borderColor: 'var(--status-danger)' }}
                            disabled={!!rowPending}
                            onClick={() => setDeleteTarget(u)}
                          >
                            {rowPending === 'delete' ? 'Deleting…' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td style={tdStyle} colSpan={7}>No users match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {lockTarget && (
        <ConfirmModal
          title="Lock account"
          message={`This deactivates ${lockTarget.name || lockTarget.email}'s account — they won't be able to log in until unlocked. This doesn't delete any of their data.`}
          confirmLabel="Lock account"
          danger
          onConfirm={() => runAction(lockTarget, 'lock')}
          onCancel={() => setLockTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete user"
          message={`Delete ${deleteTarget.name || deleteTarget.email}? Their account is deactivated and their email is freed up so it can be used to sign up again — this doesn't remove their existing loads, quotes or invoices, and can't be undone from here.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => runAction(deleteTarget, 'delete')}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
