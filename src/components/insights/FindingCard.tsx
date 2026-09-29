import { formatMoney } from '@/lib/formatters';
import './findings.css';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import InfoTip from './InfoTip';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { plural, randWhole, type Finding } from './findings';

const SEVERITY: Record<Finding['severity'], { label: string; tone: StatusTone }> = {
  high: { label: 'High', tone: 'danger' },
  medium: { label: 'Medium', tone: 'warning' },
  low: { label: 'Low', tone: 'neutral' },
};
const EVIDENCE_PREVIEW = 8;
const rand2 = (v: number) => formatMoney(v, 2);

/* One finding as one dense row (about 100px): the rand figure and its 2 to 6
   word headline on the left; severity, category and basis over the supporting
   line in the middle; the evidence toggle and the action on the right. The evidence
   opens beneath, the method sits behind the info icon. The thin bar encodes
   the same rand value the feed is ranked by, against the largest finding. */
export default function FindingCard({ finding: f, scaleTo }: { finding: Finding; scaleTo: number }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const evId = useId();
  const headId = useId();
  const n = f.evidence.length;
  const rows = all ? f.evidence : f.evidence.slice(0, EVIDENCE_PREVIEW);
  const pct = scaleTo > 0 ? Math.max(1.5, Math.min(100, (f.amount / scaleTo) * 100)) : 0;
  const noun = n === 1 ? f.evidenceNoun[0] : f.evidenceNoun[1];

  return (
    <article className={`fc fc--${f.severity}`} aria-labelledby={headId}>
      <div className="fc__fig">
        <h3 id={headId} className="fc__head">
          <span className="fc__amount">{f.basis === 'Estimated' ? 'About ' : ''}{randWhole(f.amount)}</span>
          <span className="fc__title">{f.headline}</span>
        </h3>
        <span className="fc__bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
      </div>

      <div className="fc__body">
        <div className="fc__meta">
          <StatusChip tone={SEVERITY[f.severity].tone} label={SEVERITY[f.severity].label} size="sm" />
          <span>{f.category}</span>
          <span className="fc__basis">{f.basis}{f.confidence !== 'high' && <span className="fc__conf">, {f.confidence} confidence</span>}</span>
          <InfoTip label={`How "${f.headline}" is calculated`}>
            <p className="it__title">How this is calculated</p>
            <p>{f.method}</p>
          </InfoTip>
        </div>
        <p className="fc__line">{f.line}</p>
      </div>

      <button type="button" className="fc__evidence-toggle" aria-expanded={open} aria-controls={evId} onClick={() => setOpen(o => !o)}>
        {open ? 'Hide' : 'Show'} {plural(n, f.evidenceNoun[0], f.evidenceNoun[1])}
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="fc__chev"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <Link className="fc__action" to={f.action.href}>
        {f.action.label}
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Link>

      {open && (
        <div id={evId} className="fc__evidence">
          <ul aria-label={`${f.headline}: ${noun}`}>
            {rows.map(r => (
              <li key={r.id}>
                <Link to={r.href} className="fc__ev-row">
                  <span className="fc__ev-ref">{r.ref}</span>
                  <span className="fc__ev-label">{r.label}</span>
                  <span className="fc__ev-note">{r.note}</span>
                  <span className="fc__ev-amt">{rand2(r.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {n > EVIDENCE_PREVIEW && (
            <button type="button" className="fc__more" onClick={() => setAll(a => !a)}>
              {all ? 'Show fewer' : `Show all ${n}`}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
