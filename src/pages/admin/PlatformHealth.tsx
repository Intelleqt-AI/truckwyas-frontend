import JobHealthPanel from '@/pages/admin/JobHealthPanel';
import IntegrationsPanel from '@/pages/admin/IntegrationsPanel';
import '@/pages/admin/admin-brand.css';

export default function PlatformHealth() {
  return (
    // minmax(0, …) lets the job table scroll inside its own card instead of
    // widening the grid past the viewport; the rail stacks under it on phones.
    <div className="admin-health-grid">
      {/* Integrations first: a short, fixed-shape card, so the job table
          below never moves while either loads. */}
      <IntegrationsPanel />
      <JobHealthPanel />
    </div>
  );
}
