import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from '@/lib/toast';
import { formatMonth } from '@/lib/formatters';
import { downloadDataRoomFile, serverMessage, useDeskDataRoom, useGenerateDataRoom } from '@/lib/capital/api';
import type { DataRoomExport } from '@/lib/capital/types';
import { dayTime } from '../capitalUi';
import { ListCard, type DeskCtx } from './common';

/** Last full month, YYYY-MM. */
const lastMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const summaryText = (s: DataRoomExport['summary']) => {
  if (!s) return null;
  if (typeof s === 'string') return s;
  return Object.entries(s).slice(0, 4).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ');
};

export function DataRoomTab({ ctx }: { ctx: DeskCtx }) {
  const q = useDeskDataRoom(ctx.funder);
  const gen = useGenerateDataRoom(ctx.funder);
  const [period, setPeriod] = useState(lastMonth);
  const [error, setError] = useState('');
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const canGenerate = ctx.role === 'STAFF' || ctx.role === 'APPROVER';

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(period)) return;
    setError('');
    try {
      await gen.mutateAsync(period);
      toast.success(`Data room for ${formatMonth(`${period}-01`)} generated`);
    } catch (err) {
      setError(serverMessage(err, 'The export could not be generated.'));
    }
  };

  const download = async (x: DataRoomExport, file: string) => {
    const key = `${x.id}/${file}`;
    setBusyFile(key);
    try {
      await downloadDataRoomFile(x.id, file, ctx.funder);
    } catch (err) {
      toast.error(serverMessage(err, `${file} could not be downloaded.`));
    } finally {
      setBusyFile(null);
    }
  };

  return (
    <ListCard
      id="dataroom"
      title="Monthly data room"
      sub="Exports for the funder, newest first"
      query={q}
      empty="No exports yet"
      isEmpty={(d) => d.length === 0}
      actions={canGenerate ? (
        <form onSubmit={generate} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="fin-sr" htmlFor="dr-period">Month</label>
          <input id="dr-period" type="month" className="fin-control" style={{ height: 'var(--control-h, 36px)', minHeight: 0 }} value={period} max={lastMonth()} onChange={(e) => setPeriod(e.target.value)} />
          <button type="submit" className="tw-btn" disabled={gen.isPending || !/^\d{4}-\d{2}$/.test(period)}>
            {gen.isPending ? 'Generating…' : `Generate for ${/^\d{4}-\d{2}$/.test(period) ? formatMonth(`${period}-01`) : 'month'}`}
          </button>
          {error && <p className="fin-help fin-text-danger" role="alert" style={{ margin: 0, flexBasis: '100%', textAlign: 'right' }}>{error}</p>}
        </form>
      ) : undefined}
    >
      {(rows) => (
        <div className="fin-table-scroll">
          <table className="fin-table table-heading-roles">
            <thead><tr><th>Month</th><th>Generated</th><th>Files</th><th>Summary</th></tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id}>
                  <td className="fin-strong">{/^\d{4}-\d{2}$/.test(x.period) ? formatMonth(`${x.period}-01`) : x.period}</td>
                  <td className="fin-date">{dayTime(x.created_at)}</td>
                  <td>
                    <span className="cap-flags">
                      {x.files.map((f) => (
                        <button key={f} type="button" className="tw-btn cap-row-btn" onClick={() => download(x, f)} disabled={busyFile === `${x.id}/${f}`}>
                          <Download size={14} aria-hidden="true" />{f}
                        </button>
                      ))}
                    </span>
                  </td>
                  <td className="fin-note" style={{ whiteSpace: 'normal', minWidth: 200 }}>{summaryText(x.summary) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ListCard>
  );
}
