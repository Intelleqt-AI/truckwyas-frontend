import '@/pages/table-heading-roles.css';
import { formatDistance } from '@/lib/formatters';
import { TableSkeleton } from '@/components/fleet-detail/ContentSkeleton';
import '@/pages/settings/settings-brand.css';
import { useState, useEffect } from "react";
import { fetchData, deleteData } from "@/lib/Api";
import { PasteImportDrawer } from "@/components/import/PasteImportDrawer";
import { BulkDeleteBar, RowCheckbox, secondaryButtonStyle } from "@/components/BulkDeleteBar";
import { AddVehicleDrawer } from "@/components/AddVehicleDrawer";
import { EditVehicleDrawer } from "@/components/EditVehicleDrawer";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Loader } from "@/components/Loader";
import { useAuth } from "@/lib/AuthContext";
import RowActions from "@/components/ui/RowActions";
import { settingsCardStyle, settingsCardTitleStyle, settingsInputStyle, settingsSecondaryButtonStyle, SettingsPageHeader } from "./settingsUi";
import { StatusChip } from '@/components/ui/StatusChip';

interface Vehicle {
  id: number;
  plate: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  capacity?: string | number;
  mileage?: string | number;
  fuel_type?: string;
  status: string;
  vehicle_type?: number;
  vehicle_type_name?: string;
  vehicle_type_capacity?: string | number | null;
  driver?: number | null;
  driver_name?: string;
  last_maintenance_date?: string;
  registration_expiry?: string;
  service_interval_km?: number | null;
  last_service_mileage?: string | number | null;
}

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'var(--accent-primary)',
  MAINTENANCE: 'var(--status-warning-text)',
  IN_USE: 'var(--accent-primary)',
  IN_TRANSIT: 'var(--accent-primary)',
  OUT_OF_SERVICE: 'var(--status-danger-text)',
};

// Presentation-only labels for known status payload values — unknown strings
// render verbatim (own-property lookup), and unknown keys keep neutral text.
const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Available',
  MAINTENANCE: 'Maintenance',
  IN_USE: 'In use',
  IN_TRANSIT: 'In transit',
  OUT_OF_SERVICE: 'Out of service',
};
const statusLabel = (s: string) =>
  Object.prototype.hasOwnProperty.call(STATUS_LABELS, s) ? STATUS_LABELS[s] : s;
const statusColor = (s: string) =>
  Object.prototype.hasOwnProperty.call(STATUS_COLOR, s) ? STATUS_COLOR[s] : 'var(--text-secondary)';

const sectionStyle: React.CSSProperties = { ...settingsCardStyle, marginBottom: 0 };


export function VehiclesDirectory() {
  const { user: authUser } = useAuth();
  // Shared public demo account — creation/edit/delete controls are fixed off,
  // viewing/filtering/search stay fully live.
  const isDemo = !!authUser?.is_demo;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const toggleOne = (id: number, on: boolean) =>
    setSelected(prev => (on ? [...prev, id] : prev.filter(x => x !== id)));

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);

  const load = () => {
    setLoading(true);
    fetchData('api/v1/vehicles/').then((d: any) => {
      setVehicles(Array.isArray(d) ? d : (d?.results || []));
    }).catch(() => setVehicles([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = vehicles.filter(v =>
    v.plate?.toLowerCase().includes(search.toLowerCase()) ||
    v.make?.toLowerCase().includes(search.toLowerCase()) ||
    v.model?.toLowerCase().includes(search.toLowerCase()) ||
    v.vehicle_type_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    await deleteData({ url: `api/v1/vehicles/${id}/` }).catch(() => {});
    load();
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <SettingsPageHeader title="Vehicles" description="Fleet vehicle directory" />

      <div style={sectionStyle}>
        <div style={{
          padding: '12px 24px', minHeight: 64, boxSizing: 'border-box', borderBottom: '1px solid var(--border-subtle)', gap: 12, flexWrap: 'wrap',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={settingsCardTitleStyle}>
            Vehicles <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>({vehicles.length})</span>
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input
              className="settings-control"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              aria-label="Search vehicles"
              style={{ ...settingsInputStyle, width: 180, maxWidth: '100%' }}
            />
            <button
              className="settings-control"
              onClick={() => setShowImport(true)}
              disabled={isDemo}
              title={isDemo ? 'Not available in the demo' : 'Paste or upload a fleet list'}
              style={{
                ...secondaryButtonStyle,
                fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 500,
                letterSpacing: 'normal', borderRadius: 'var(--radius-control)', minHeight: 40, padding: '8px 12px',
                cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1,
              }}
            >Import</button>
            <button
              className="btn-action settings-control"
              onClick={() => setShowAddDrawer(true)}
              disabled={isDemo}
              title={isDemo ? 'Not available in the demo' : undefined}
              style={{ minHeight: 40, borderRadius: 'var(--radius-control)', ...(isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
            >Add vehicle</button>
          </div>
        </div>

        <BulkDeleteBar
          entity="vehicles"
          selected={selected}
          onClear={() => setSelected([])}
          onDeleted={() => { setSelected([]); load(); }}
        />

        {loading ? (
          <TableSkeleton rows={6} cols={4} label="Loading vehicles" />
        ) : (
          <div className="settings-scroll-region" role="region" aria-label="Vehicles" tabIndex={0} style={{ overflowX: 'auto' }}>
          <table className="table-heading-roles settings-table settings-table--pin-actions">
            <thead>
              <tr>
                <th style={{ width: 32, }}>
                  {filtered.length > 0 && (
                    <RowCheckbox
                      title="Select everything shown"
                      checked={selected.length > 0 && filtered.every((v: any) => selected.includes(v.id))}
                      onChange={on => setSelected(on ? filtered.map((v: any) => v.id) : [])}
                    />
                  )}
                </th>
                {['Plate', 'Make and model', 'Type', 'Status', 'Driver', 'Last service', ''].map(h => (
                  <th key={h || 'actions'} scope="col" style={{ textAlign: (h === '') ? 'right' : 'left' }}>{h || <span className="sr-only">Actions</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center' as const, padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>No vehicles found</td></tr>
              ) : filtered.map((v, i) => (
                <tr key={v.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                  <td style={{ width: 32 }}>
                    <RowCheckbox checked={selected.includes(v.id)} onChange={on => toggleOne(v.id, on)} />
                  </td>
                  <td style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontSize: 14, lineHeight: '20px', fontWeight: 400, color: 'var(--text-primary)' }}>
                    {v.plate || '—'}
                  </td>
                  <td style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                    {[v.make, v.model].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                    {v.vehicle_type_name || v.vehicle_type || '—'}
                    {v.vehicle_type_capacity != null && (
                      <span style={{ marginLeft: 6, color: 'var(--text-tertiary)', fontSize: 13, lineHeight: '20px', fontVariantNumeric: 'tabular-nums' }}>
                        · {v.vehicle_type_capacity}t
                      </span>
                    )}
                  </td>
                  <td>
                    <StatusChip status={v.status} label={statusLabel(v.status)} size="sm" />
                  </td>
                  <td style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                    {v.driver_name || '—'}
                  </td>
                  <td style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                    {(() => {
                      if (v.service_interval_km && v.last_service_mileage && v.mileage) {
                        const nextAt = parseFloat(String(v.last_service_mileage)) + Number(v.service_interval_km);
                        const remaining = nextAt - parseFloat(String(v.mileage));
                        return remaining > 0
                          ? `${formatDistance(remaining)} left`
                          : 'Overdue';
                      }
                      if (v.last_service_mileage) {
                        return `At ${formatDistance(parseFloat(String(v.last_service_mileage)))}`;
                      }
                      return v.last_maintenance_date || '—';
                    })()}
                  </td>
                  <td style={{ textAlign: 'right' as const }}>
                    <RowActions
                      label={v.plate || `Vehicle ${v.id}`}
                      items={[
                        { label: 'Edit', onSelect: () => setEditVehicle(v), disabled: isDemo },
                        { label: 'Delete', danger: true, onSelect: () => setDeleteTarget({ id: v.id, name: v.plate || `Vehicle ${v.id}` }), disabled: isDemo },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <AddVehicleDrawer
        open={showAddDrawer}
        onClose={() => setShowAddDrawer(false)}
        onCreated={load}
      />

      {deleteTarget && (
        <ConfirmModal
          title="Delete vehicle"
          message={`Are you sure you want to delete vehicle "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <PasteImportDrawer
        entity="vehicles"
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => load()}
      />

      <EditVehicleDrawer
        open={!!editVehicle}
        vehicle={editVehicle}
        onClose={() => setEditVehicle(null)}
        onUpdated={load}
      />
    </div>
  );
}
