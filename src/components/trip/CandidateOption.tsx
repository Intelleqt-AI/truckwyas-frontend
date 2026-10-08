import { candidateFit, candidateSummary, type Candidate } from '@/lib/tripEconomics';

/** One choosable row: a radio, a title, a meta line, and the fit / warnings
 *  of a suggested job. Used by the Book job dialog and the link picker. */
export function ChoiceOption({ name, checked, onChange, title, meta, fit, warnings }: {
  name: string; checked: boolean; onChange: () => void;
  title: React.ReactNode; meta?: React.ReactNode; fit?: string | null; warnings?: string[];
}) {
  return (
    <label className={`tm-option${checked ? ' is-selected' : ''}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span className="tm-option__title">{title}{fit && <span className="tm-option__fit">{fit}</span>}</span>
      {meta && <span className="tm-option__meta">{meta}</span>}
      {warnings && warnings.length > 0 && <span className="tm-option__warn">{warnings.join(' · ')}</span>}
    </label>
  );
}

export function CandidateOption({ name, candidate, direction, checked, onChange }: {
  name: string; candidate: Candidate; direction: 'return' | 'outbound'; checked: boolean; onChange: () => void;
}) {
  return (
    <ChoiceOption
      name={name}
      checked={checked}
      onChange={onChange}
      title={<>{candidate.load_number}{candidate.customer_name ? <span className="tm-muted">{candidate.customer_name}</span> : null}</>}
      meta={candidateSummary(candidate, direction)}
      fit={candidateFit(candidate)}
      warnings={(candidate.warnings || []).map(w => w.title)}
    />
  );
}
