import SectionHeader from '@/components/layout/SectionHeader';
import './insurance.css';
import { StatusChip } from '@/components/ui/StatusChip';
import { Link } from 'react-router-dom';
import { Calculator, FileText, Truck } from 'lucide-react';

/**
 * Insurance is not live. The route stays so the nav item leads somewhere
 * truthful instead of a dead link. Copy must not imply partners or cover
 * that do not exist yet.
 *
 * R5: one compact card, not a lone narrow card on an empty page. What is
 * coming on the left; what works today (premiums as Insurance expenses,
 * already counted in P&L) on the right.
 */
const COMING = [
  { icon: Truck, title: 'Cost per truck', text: 'Insurance beside fuel, tolls and maintenance on each vehicle.' },
  { icon: Calculator, title: 'Cover in every quote', text: 'The cost of cover included when you price a load.' },
  { icon: FileText, title: 'Policies with the vehicle', text: 'Policy documents and renewal dates kept with the truck they cover.' },
];

export default function Insurance() {
  return (
    <div className="insurance-page">
      <SectionHeader
        title="Insurance"
        titleAdornment={<StatusChip tone="neutral" label="Not live yet" />}
        description="Cover costs per truck and per load, planned"
      />

      <section className="card insurance-card" aria-labelledby="insurance-plan">
        <div className="insurance-card__main">
          <h2 id="insurance-plan" className="insurance-card__title">What is coming</h2>
          <ul className="insurance-list">
            {COMING.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span className="insurance-list__icon" aria-hidden="true"><Icon size={16} /></span>
                <span><b>{title}</b><span className="insurance-list__text">{text}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="insurance-card__side" aria-labelledby="insurance-today">
          <h2 id="insurance-today" className="insurance-card__title">Until then</h2>
          <p className="insurance-card__description">
            No cover through TruckWys yet. Log premiums as Insurance expenses so your P&amp;L counts them.
          </p>
          <Link to="/finance/expenses" className="tw-btn insurance-card__action">Go to expenses</Link>
        </aside>
      </section>
    </div>
  );
}
