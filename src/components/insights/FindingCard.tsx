import './findings.css';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import InfoTip from './InfoTip';
import { plural, randWhole, type Finding } from './findings';

const SEVERITY: Record<Finding['severity'], string> = { high: 'High', medium: 'Medium', low: 'Low' };
const EVIDENCE_PREVIEW = 8;
const rand2 = (v: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

/* One finding: the rand figure, a 2 to 6 word headline, one supporting line,
   one action (a link to where it is done), the evidence one click away, and
   the method behind the info icon. The thin bar encodes the same rand value
   the feed is ranked by, against the largest finding. */
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
        <div className="fc__meta">
          <span className={`fc__sev fc__sev--${f.severity}`}>{SEVERITY[f.severity]}</span>
          <span>{f.category}</span>
        </div>
        <h3 id={headId} className="fc__head">
          <span className="fc__amount">{f.basis === 'Estimated' ? 'About ' : ''}{randWhole(f.amount)}</span>
          <span className="fc__title">{f.headline}</span>
        </h3>
        <span className="fc__bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
      </div>

      <div className="fc__body">
        <p className="fc__line">{f.line}</p>
        <div className="fc__actions">
          <Link className="fc__action" to={f.action.href}>
            {f.action.label}
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <button type="button" className="fc__evidence-toggle" aria-expanded={open} aria-controls={evId} onClick={() => setOpen(o => !o)}>
            {open ? 'Hide' : 'Show'} {plural(n, f.evidenceNoun[0], f.evidenceNoun[1])}
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="fc__chev"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      <div className="fc__info">
        <span className="fc__basis">{f.basis}{f.confidence !== 'high' && <span className="fc__conf">, {f.confidence} confidence</span>}</span>
        <InfoTip label={`How "${f.headline}" is calculated`}>
          <p className="it__title">How this is calculated</p>
          <p>{f.method}</p>
        </InfoTip>
      </div>

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
