import SectionHeader from '@/components/layout/SectionHeader';
import './insurance.css';
import { StatusChip } from '@/components/ui/StatusChip';

/**
 * Insurance is not live. The route stays so the nav item leads somewhere
 * truthful instead of a dead link. Copy must not imply partners or cover
 * that do not exist yet.
 */
export default function Insurance() {
  return (
    <div className="insurance-page">
      <SectionHeader
        title="Insurance"
        titleAdornment={<StatusChip tone="neutral" label="Not live yet" />}
        description="Fleet insurance is not available in TruckWys yet."
      />

      <section className="card insurance-card" aria-labelledby="insurance-plan">
        <h2 id="insurance-plan" className="insurance-card__title">What insurance in TruckWys is for</h2>
        <p className="insurance-card__description">
          The aim is to show what cover costs you per truck and per load, next to the rest of your costs, so
          quotes and margins include it.
        </p>
        <ul className="insurance-list">
          <li>See insurance cost per truck alongside fuel, tolls and maintenance</li>
          <li>Include cover in the cost of each quote</li>
          <li>Keep policy documents and renewal dates with the vehicle they cover</li>
        </ul>
        <p className="insurance-card__note">
          Nothing here is live and no cover is offered through TruckWys today. Speak to your current insurer about
          your fleet policy.
        </p>
      </section>
    </div>
  );
}
