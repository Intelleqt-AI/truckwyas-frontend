import { useRef, useState } from 'react';
import { postData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { Loader } from '@/components/Loader';
import { secondaryButtonStyle } from '@/components/BulkDeleteBar';
import * as XLSX from 'xlsx';
import { useFocusTrap, latestModal } from '@/hooks/useFocusTrap';

/** Spreadsheet formats SheetJS reads reliably. Everything becomes the same
 *  tab-separated text a paste produces, so a file and a paste follow one code
 *  path and get the same preview. */
const FILE_TYPES = '.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.pdf';

/** A sheet -> the TSV the paste box would have contained.
 *  Reads the first sheet: a fleet list is one sheet, and silently merging
 *  several would import rows nobody chose. */
async function fileToText(file: File): Promise<string> {
  // A PDF holds no table, only positioned text, so the columns are inferred
  // from the layout — loaded into the box for checking rather than imported
  // straight off. See pdfToRows.
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
    // Loaded on demand: pdf.js is about a megabyte, and most fleets never drop
    // a PDF. No reason to ship it to everyone who opens the Customers page.
    const { pdfToRows } = await import('./pdfToRows');
    return pdfToRows(file);
  }
  const buf = await file.arrayBuffer();
  const book = XLSX.read(buf, { type: 'array', cellDates: false, raw: false });
  const first = book.SheetNames[0];
  if (!first) throw new Error('That file has no sheets in it');
  return XLSX.utils.sheet_to_csv(book.Sheets[first], { FS: '	', blankrows: false });
}

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

interface PanelProps {
  entity: ImportEntity;
  /** Called after a successful commit so the caller can refetch its list. */
  onImported: (count: number) => void;
  /** Rendered in the drawer, redundant inline where the page already has one. */
  showHeading?: boolean;
  /** Present in the drawer; absent inline, where the wizard owns navigation. */
  onClose?: () => void;
}

export function PasteImportPanel({ entity, onImported, showHeading = true, onClose }: PanelProps) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fromPdf, setFromPdf] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sample = SAMPLES[entity];

  const reset = () => { setText(''); setPreview(null); setBusy(false); setFileName(''); setFromPdf(false); };

  const takeFile = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const asText = await fileToText(file);
      if (!asText.trim()) throw new Error('That sheet looks empty');
      setText(asText);
      setFileName(file.name);
      const isPdf = /\.pdf$/i.test(file.name);
      setFromPdf(isPdf);
      if (isPdf) toast.success(`Read ${file.name}. Check the columns below before importing`);
      else toast.success(`Read ${file.name}`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't read that file. Try saving it as CSV or Excel");
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };
  const close = () => { reset(); onClose?.(); };

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
        toast.error('Nothing was imported. Every row needs attention');
        setBusy(false);
      }
    } catch (e: any) {
      toast.error(e?.message || e?.error || 'Import failed');
      setBusy(false);
    }
  };

  const labelS: React.CSSProperties = {
    fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)',
    color: 'var(--text-secondary)', letterSpacing: 'normal', textTransform: 'none',
  };

  return (
    <div>
        {showHeading && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>{sample.title}</h2>
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', marginTop: 4 }}>
                Paste the rows straight out of Excel or Google Sheets, or drop the file in.
              </div>
            </div>
            {onClose && (
              <button onClick={close} aria-label="Close"
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20, lineHeight: 1, width: 44, height: 44, margin: '-10px -10px 0 0', borderRadius: 'var(--radius-control)', flexShrink: 0 }}>
                &times;
              </button>
            )}
          </div>
        )}

        {!preview && (
          <>
            {/* A file is just another way to fill the same box: it is converted
                to the tab-separated text a paste produces, so both go through
                one validation and one preview. */}
            <div
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); takeFile(e.dataTransfer.files?.[0]); }}
              onClick={() => fileRef.current?.click()}
              style={{
                border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-nested)',
                padding: '12px 16px', marginBottom: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}>
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                {fileName
                  ? <>Loaded <b>{fileName}</b>. Check it below, or drop another file.</>
                  : <>Drop an Excel, CSV or PDF file here, or <span style={{ color: 'var(--accent-primary)' }}>browse</span></>}
              </div>
              <span style={{ ...labelS, fontWeight: 400, flexShrink: 0 }}>XLSX · CSV · ODS · PDF</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={FILE_TYPES}
              onChange={e => takeFile(e.target.files?.[0])}
              style={{ display: 'none' }}
            />

            {fromPdf && (
              <div style={{
                border: '1px solid var(--status-warning)', background: 'var(--status-warning-bg)',
                borderRadius: 'var(--radius-nested)', padding: '12px 16px', marginBottom: 12,
                fontSize: 13, color: 'var(--text-primary)', lineHeight: '20px',
              }}>
                A PDF stores text and its position, not a table, so the columns below were
                worked out from the layout. Check them, and fix any that ran together,
                before importing.
              </div>
            )}
            <div style={{ ...labelS, marginBottom: 6 }}>{fileName ? 'From your file' : 'Paste here'}</div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              autoFocus
              placeholder={sample.example}
              style={{
                width: '100%', minHeight: 240, background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-control)', padding: 12,
                color: 'var(--text-primary)', fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-mono)',
                outline: 'none', whiteSpace: 'pre', overflowX: 'auto',
              }}
            />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: '20px' }}>
              Include the heading row if you have one. We work out which column is which.
              <br />
              Columns we recognise: {sample.columns}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="btn-action" onClick={check} disabled={busy} style={{ flex: 1 }}>
                {busy ? <Loader size={16} color="currentColor" /> : 'Check list'}
              </button>
              {onClose && (
                <button onClick={close}
                  style={secondaryButtonStyle}>
                  Cancel
                </button>
              )}
            </div>
          </>
        )}

        {preview && (
          <>


            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
              <div style={{ maxHeight: 380, overflow: 'auto' }} role="region" aria-label="Import preview" tabIndex={0}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, lineHeight: '20px', fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr>
                      <th style={thS}>#</th>
                      {PREVIEW_FIELDS[entity].map(f => (
                        <th key={f} style={thS}>{sentenceCase(f)}</th>
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
                        <td style={{ ...tdS, color: r.ready ? 'var(--text-secondary)' : 'var(--status-warning-text, var(--status-warning))' }}>
                          {r.problems.length ? r.problems.join('; ') : (r.notes?.join('; ') || 'Ready')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Under the table, not above it: by the time it is worth counting
                them you have already read the rows. */}
            <div style={{
              fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums',
              color: 'var(--text-secondary)', marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap',
            }}>
              <span>{preview.total} found</span>
              <span>·</span>
              <span style={{ color: preview.ready ? 'var(--status-success-text, var(--status-success))' : undefined }}>
                {preview.ready} ready
              </span>
              {preview.needs_attention > 0 && (
                <>
                  <span>·</span>
                  <span style={{ color: 'var(--status-warning-text, var(--status-warning))' }}>
                    {preview.needs_attention} need attention
                  </span>
                </>
              )}
            </div>

            {preview.needs_attention > 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: '20px' }}>
                Rows needing attention are skipped. The other {preview.ready} still
                import. Fix them in your spreadsheet and paste again.
                {preview.unmapped_columns?.length > 0 && (
                  <> These columns were ignored because there is nowhere to put
                  them: {preview.unmapped_columns.join(', ')}.</>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="btn-action" onClick={commit} disabled={busy || preview.ready === 0} style={{ flex: 1 }}>
                {busy ? <Loader size={16} color="currentColor" /> : `Import ${preview.ready}`}
              </button>
              <button onClick={() => setPreview(null)} disabled={busy}
                style={secondaryButtonStyle}>
                Change list
              </button>
            </div>
          </>
        )}
    </div>
  );
}

/** The same panel, slid in over the page. Used everywhere except onboarding,
 *  where the step itself is the container. */
export function PasteImportDrawer({ entity, open, onClose, onImported }: {
  entity: ImportEntity;
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  useFocusTrap(latestModal, open);
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Import"
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'var(--modal-backdrop, rgba(0,0,0,0.4))', zIndex: 200,
        display: 'flex', justifyContent: 'flex-end',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(760px, 100%)', background: 'var(--bg-surface)', height: '100%',
          overflowY: 'auto', padding: 24, borderLeft: '1px solid var(--border-subtle)',
        }}>
        <PasteImportPanel entity={entity} onImported={onImported} onClose={onClose} />
      </div>
    </div>
  );
}

// "plate_number" → "Plate number" for column headings (field keys are unchanged).
const sentenceCase = (k: string) => {
  const t = k.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const thS: React.CSSProperties = {
  textAlign: 'left', padding: '12px 16px', fontSize: 13, lineHeight: '20px', fontWeight: 500,
  fontFamily: 'var(--font-sans)', textTransform: 'none', letterSpacing: 'normal',
  color: 'var(--text-secondary)', whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0,
  background: 'var(--bg-surface)',
};

const tdS: React.CSSProperties = {
  padding: '12px 16px', borderBottom: '1px solid var(--border-row)',
  color: 'var(--text-secondary)', verticalAlign: 'top',
};

