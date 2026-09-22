import { useState } from 'react';
import { postData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { Loader } from '@/components/Loader';

/**
 * Paste a list straight out of a spreadsheet.
 *
 * Entity-agnostic on purpose — customers and vehicles differ only in which
 * endpoints they call and which columns they show, so both use this.
 *
 * Three states: paste -> preview -> done. The preview step exists because the
 * backend validates without writing, so a fleet can see exactly what will and
 * will not land before committing to it.
 */

export type ImportEntity = 'customers' | 'vehicles';

interface PreviewRow {
  row: number;
  data: Record<string, unknown>;
  problems: string[];
  notes?: string[];
  ready: boolean;
}

interface Preview {
  rows: PreviewRow[];
  total: number;
  ready: number;
  needs_attention: number;
  mapping: Record<string, string>;
  headers: string[] | null;
  unmapped_columns: string[];
}

const SAMPLES: Record<ImportEntity, { title: string; columns: string; example: string }> = {
  customers: {
    title: 'Import customers',
    columns: 'Customer Name · Contact Person · Phone · Email · Address · Payment Terms',
    example:
      'Customer Name\tContact Person\tPhone\tEmail\tAddress\tPayment Terms\n' +
      'ABC Construction\tJohn Smith\t082 111 2222\tjohn@abc.co.za\tCape Town\t30 days',
  },
  vehicles: {
    title: 'Import vehicles',
    columns: 'Registration · Vehicle Type · Make · Model · GVM · Capacity · Fuel · L/100km · Base Rate/km',
    example:
      'Registration\tVehicle Type\tMake\tModel\tGVM\tCapacity\tFuel\tL/100km\tBase Rate/km\n' +
      'CA 123456\tSuperlink\tScania\tR500\t56\t34\tDiesel\t38\tR32',
  },
};

/** Columns worth showing in the preview table, in a sensible reading order. */
const PREVIEW_FIELDS: Record<ImportEntity, string[]> = {
  customers: ['name', 'contact_person', 'phone', 'email', 'address'],
  vehicles: ['plate', 'type', 'make', 'capacity', 'base_rate'],
};

interface Props {
  entity: ImportEntity;
  open: boolean;
  onClose: () => void;
  /** Called after a successful commit so the caller can refetch its list. */
  onImported: (count: number) => void;
}

export function PasteImportDrawer({ entity, open, onClose, onImported }: Props) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;
  const sample = SAMPLES[entity];

  const reset = () => { setText(''); setPreview(null); setBusy(false); };
  const close = () => { reset(); onClose(); };

  const check = async () => {
    if (!text.trim()) { toast.error('Paste your list first'); return; }
    setBusy(true);
    try {
      const res = await postData({ url: `api/v1/import/${entity}/validate/`, data: { text } });
      setPreview(res as Preview);
    } catch (e: any) {
      toast.error(e?.message || e?.error || 'Could not read that list');
    }
    setBusy(false);
  };

  const commit = async () => {
    setBusy(true);
    try {
      const res: any = await postData({ url: `api/v1/import/${entity}/commit/`, data: { text } });
      const n = res?.imported ?? 0;
      if (n > 0) {
        toast.success(`Imported ${n} ${entity === 'customers' ? 'customers' : 'vehicles'}`);
        onImported(n);
        close();
      } else {
        toast.error('Nothing was imported — every row needs attention');
        setBusy(false);
      }
    } catch (e: any) {
      toast.error(e?.message || e?.error || 'Import failed');
      setBusy(false);
    }
  };

  const labelS: React.CSSProperties = {
    fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
    letterSpacing: '0.08em', textTransform: 'uppercase',
  };

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
        display: 'flex', justifyContent: 'flex-end',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(760px, 100%)', background: 'var(--bg-surface)', height: '100%',
          overflowY: 'auto', padding: 24, borderLeft: '1px solid var(--border-subtle)',
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>{sample.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Copy the rows out of Excel, Google Sheets or your current system and paste them below.
            </div>
          </div>
          <button onClick={close}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>
            &times;
          </button>
        </div>

        {!preview && (
          <>
            <div style={{ ...labelS, marginBottom: 6 }}>Paste here</div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              autoFocus
              placeholder={sample.example}
              style={{
                width: '100%', minHeight: 240, background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 12,
                color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
                outline: 'none', whiteSpace: 'pre', overflowX: 'auto',
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.6 }}>
              Include the heading row if you have one — we work out which column is which.
              <br />
              Columns we recognise: {sample.columns}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button className="btn-action" onClick={check} disabled={busy}>
                {busy ? <Loader size={12} color="currentColor" /> : 'CHECK LIST'}
              </button>
              <button onClick={close}
                style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '0 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </>
        )}

        {preview && (
          <>
            <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
              <Stat value={preview.total} label="found" />
              <Stat value={preview.ready} label="ready to import" color="var(--status-success)" />
              {preview.needs_attention > 0 && (
                <Stat value={preview.needs_attention} label="need attention" color="var(--status-warning)" />
              )}
            </div>

            {preview.unmapped_columns?.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                Ignored, because there is nowhere to put them: {preview.unmapped_columns.join(', ')}
              </div>
            )}

            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={thS}>#</th>
                      {PREVIEW_FIELDS[entity].map(f => (
                        <th key={f} style={thS}>{f.replace(/_/g, ' ')}</th>
                      ))}
                      <th style={thS}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map(r => (
                      <tr key={r.row} style={{ background: r.ready ? undefined : 'var(--status-warning-bg)' }}>
                        <td style={tdS}>{r.row}</td>
                        {PREVIEW_FIELDS[entity].map(f => (
                          <td key={f} style={tdS}>{String(r.data?.[f] ?? '') || '—'}</td>
                        ))}
                        <td style={{ ...tdS, color: r.ready ? 'var(--text-tertiary)' : 'var(--status-warning)' }}>
                          {r.problems.length ? r.problems.join('; ') : (r.notes?.join('; ') || 'Ready')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10, lineHeight: 1.6 }}>
              {preview.needs_attention > 0
                ? `Rows needing attention are skipped — the other ${preview.ready} still import. Fix them in your spreadsheet and paste again.`
                : 'Everything checks out.'}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button className="btn-action" onClick={commit} disabled={busy || preview.ready === 0}>
                {busy ? <Loader size={12} color="currentColor" /> : `IMPORT ${preview.ready}`}
              </button>
              <button onClick={() => setPreview(null)} disabled={busy}
                style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '0 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const thS: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', fontSize: 10, fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)',
  borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0,
  background: 'var(--bg-surface)',
};

const tdS: React.CSSProperties = {
  padding: '7px 10px', borderBottom: '1px solid var(--border-row)',
  color: 'var(--text-secondary)', verticalAlign: 'top',
};

function Stat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 500, color: color || 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</div>
    </div>
  );
}
