import './table-heading-roles.css';
import './finance-brand.css';
import '@/components/finance/finance-ledger.css';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import SectionHeader, { FINANCE_TABS } from '@/components/layout/SectionHeader';
import { Toolbar, SearchInput } from '@/components/ui/Toolbar';
import { Segmented } from '@/components/ui/Segmented';
import { StatusChip } from '@/components/ui/StatusChip';
import RowActions from '@/components/ui/RowActions';
import { ConfirmModal } from '@/components/ConfirmModal';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import '@/components/data/load-error.css';
import { SupplierDialog } from '@/components/finance/SupplierDialog';
import { deleteData, patchData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { categoryLabel } from '@/lib/finance/categories';
import { FIN_URL, errorText, useSuppliers } from '@/lib/finance/api';
import type { Supplier } from '@/lib/finance/types';

type ActiveFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';
const PAGE_SIZE = 20;

/** Who the business buys from: one record per supplier, linked from expenses. */
export default function Suppliers() {
  const qc = useQueryClient();
  const query = useSuppliers();
  const failed = loadFailed(query);
  const loading = query.isLoading && !failed;
  const suppliers = query.data?.rows ?? [];
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ActiveFilter>('ACTIVE');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => { document.title = 'Suppliers - TruckWys'; }, []);

  const q = search.trim().toLowerCase();
  const filtered = suppliers
    .filter(s => filter === 'ALL' || (filter === 'ACTIVE' ? s.is_active !== false : s.is_active === false))
    .filter(s => !q || [s.name, s.vat_number, s.registration_number, s.email].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const count = (f: ActiveFilter) => (loading ? undefined : suppliers.filter(s => f === 'ALL' || (f === 'ACTIVE' ? s.is_active !== false : s.is_active === false)).length);

  const refresh = () => qc.invalidateQueries({ queryKey: ['suppliers'] });

  const setActive = async (s: Supplier, active: boolean) => {
    setBusyId(s.id);
    try {
      await patchData({ url: FIN_URL.supplier(s.id), data: { is_active: active } });
      toast.success(active ? `${s.name} is active again` : `${s.name} deactivated`);
      refresh();
    } catch (e) {
      toast.error(errorText(e, "Couldn't update the supplier"));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (s: Supplier) => {
    setBusyId(s.id);
    try {
      await deleteData({ url: FIN_URL.supplier(s.id) });
      toast.success('Supplier deleted');
      refresh();
    } catch (e) {
      // A supplier with expenses can't be deleted: deactivate it instead.
      toast.error(errorText(e, `${s.name} has expenses, so it can't be deleted. Deactivate it instead.`));
    } finally {
      setBusyId(null);
    }
  };

  const header = (
    <SectionHeader
      eyebrow="Finance"
      title="Finance"
      tabs={FINANCE_TABS}
      actions={<button type="button" className="tw-btn tw-btn--primary" onClick={() => setEditing('new')}>Add supplier</button>}
    />
  );

  if (failed) {
    return (
      <div className="fin-page">
        {header}
        <LoadError what="suppliers" error={query.error ?? query.failureReason} busy={query.isFetching} onRetry={() => query.refetch()} />
      </div>
    );
  }

  return (
    <div className="fin-page">
      {header}
      <Toolbar className="fin-toolbar" aria-label="Filter suppliers" meta={loading ? ' ' : `${filtered.length} ${filtered.length === 1 ? 'supplier' : 'suppliers'}`}>
        <SearchInput wrapClassName="inv-search" placeholder="Search suppliers" aria-label="Search suppliers by name, VAT number or email"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <Segmented<ActiveFilter>
          label="Filter by status"
          className="fin-seg"
          value={filter}
          onChange={v => { setFilter(v); setPage(1); }}
          options={[
            { value: 'ACTIVE', label: 'Active', count: count('ACTIVE') },
            { value: 'INACTIVE', label: 'Inactive', count: count('INACTIVE') },
            { value: 'ALL', label: 'All', count: count('ALL') },
          ]}
        />
      </Toolbar>

      {loading ? (
        <div className="fin-skel fin-skel--card" style={{ marginTop: 0 }} aria-busy="true" aria-label="Loading suppliers" />
      ) : (
        <div className="card fin-table-card fin-table-card--fit fin-section">
          <div className="fin-table-scroll">
            <table className="fin-table fin-table--stack table-heading-roles">
              <thead>
                <tr>
                  <th className="fin-cell-fill">Supplier</th>
                  <th className="m-hide">Category</th>
                  <th className="m-hide">VAT number</th>
                  <th className="num m-hide">Expenses</th>
                  <th>Status</th>
                  <th className="actions"><span className="fin-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className="is-empty">
                    <td colSpan={6} style={{ padding: 0 }}>
                      {suppliers.length === 0 ? (
                        <div className="fin-empty">
                          <p className="fin-empty__title">No suppliers yet</p>
                          <p className="fin-empty__body">Add the businesses you buy from, or add them as you capture expenses.</p>
                          <button type="button" className="btn-action" onClick={() => setEditing('new')}>Add supplier</button>
                        </div>
                      ) : (
                        <div className="fin-empty fin-empty--compact">No suppliers match your filters</div>
                      )}
                    </td>
                  </tr>
                ) : rows.map(s => {
                  const active = s.is_active !== false;
                  const contact = [s.email, s.phone].filter(Boolean).join(' · ');
                  return (
                    <tr key={s.id}>
                      <td className="fin-strong m-party m-span2 fin-cell-2 fin-cell-fill">
                        <div className="fin-truncate fin-truncate--fill" title={s.name}>{s.name}</div>
                        <span className="fin-cell-sub">
                          <span className="fin-mobile-only">{categoryLabel(s.category)}{s.vat_number ? ` · VAT ${s.vat_number}` : ''}</span>
                          <span className="m-hide-inline">{contact || (s.registration_number ? `Reg ${s.registration_number}` : 'No contact details')}</span>
                        </span>
                      </td>
                      <td className="m-hide fin-nowrap">{categoryLabel(s.category)}</td>
                      <td className="m-hide"><span className="fin-id">{s.vat_number || '—'}</span></td>
                      <td className="num m-hide">{s.expense_count ?? 0}</td>
                      <td className="m-status"><StatusChip status={active ? 'ACTIVE' : 'INACTIVE'} size="sm" /></td>
                      <td className="actions">
                        <RowActions
                          label={`Supplier ${s.name}`}
                          onEdit={() => setEditing(s)}
                          items={[
                            active
                              ? { label: 'Deactivate', onSelect: () => setActive(s, false), disabled: busyId === s.id, hint: 'Hidden from the expense picker; history stays' }
                              : { label: 'Activate', onSelect: () => setActive(s, true), disabled: busyId === s.id },
                            ...(s.expense_count > 0
                              ? []
                              : [{ label: 'Delete', onSelect: () => setDeleting(s), danger: true, disabled: busyId === s.id }]),
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="fin-table-foot">
              <span>{(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div className="fin-table-foot__nav">
                <button type="button" className="tw-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                <button type="button" className="tw-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {editing && (
        <SupplierDialog
          supplier={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => { toast.success(editing === 'new' ? `${saved?.name ?? 'Supplier'} added` : 'Supplier updated'); setEditing(null); }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete supplier"
          message={`Delete ${deleting.name}? It has no expenses, so nothing else changes.`}
          confirmLabel="Delete supplier"
          danger
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
