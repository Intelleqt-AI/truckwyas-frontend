import JobHealthPanel from '@/pages/admin/JobHealthPanel';
import IntegrationsPanel from '@/pages/admin/IntegrationsPanel';

export default function PlatformHealth() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <JobHealthPanel />
      <IntegrationsPanel />
    </div>
  );
}
