import './finance-brand.css';
import './table-heading-roles.css';
import '@/components/finance/finance-ledger.css';
import '@/components/capital/fastpay.css';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import SectionHeader, { type SectionTab } from '@/components/layout/SectionHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import '@/components/data/load-error.css';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useQueryClient } from '@tanstack/react-query';
import { deskKeys, useCapitalStatus } from '@/lib/capital/api';
import { SkelCard } from '@/components/capital/capitalUi';
import type { DeskCtx } from '@/components/capital/desk/common';
import { BookTab } from '@/components/capital/desk/BookTab';
import { AlertsTab, ApprovalsTab, LedgerTab, QueueTab } from '@/components/capital/desk/OpsTabs';
import { DebtorsTab, TransportersTab } from '@/components/capital/desk/PartiesTabs';
import { PolicyTab } from '@/components/capital/desk/PolicyTab';
import { DataRoomTab } from '@/components/capital/desk/DataRoomTab';

const TABS = [
  { id: 'book', label: 'Book' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'queue', label: 'Queue' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'debtors', label: 'Debtors' },
  { id: 'transporters', label: 'Transporters' },
  { id: 'policy', label: 'Policy and limits' },
  { id: 'data-room', label: 'Data room' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const DESK_TABS: SectionTab[] = TABS.map((t) => ({ label: t.label, to: `/capital/desk/${t.id}` }));
const FUNDER_KEY = 'tw-desk-funder';

/**
 * The capital desk: TruckWys staff and funder members only. Access comes
 * from capital/status (desk.access), independent of the Fast Pay launch
 * switch, because no transporter can reach it. Everyone else is sent home.
 */
export default function CapitalDesk() {
  const { tab } = useParams<{ tab?: string }>();
  const status = useCapitalStatus();
  const qc = useQueryClient();
  const desk = status.data?.desk;
  const funders = useMemo(() => desk?.funders ?? [], [desk?.funders]);
  const [funder, setFunder] = useState<number | null>(() => {
    try { const v = Number(sessionStorage.getItem(FUNDER_KEY)); return Number.isInteger(v) && v > 0 ? v : null; } catch { return null; }
  });

  // Keep the chosen funder valid for this user; default to the first visible.
  useEffect(() => {
    if (!funders.length) return;
    if (funder == null || !funders.some((f) => f.id === funder)) setFunder(funders[0].id);
  }, [funders, funder]);
  useEffect(() => {
    try { if (funder != null) sessionStorage.setItem(FUNDER_KEY, String(funder)); } catch { /* private mode */ }
  }, [funder]);

  useEffect(() => { document.title = 'Capital desk - TruckWys'; }, []);
  useAutoRefresh(() => qc.invalidateQueries({ queryKey: deskKeys.all }), 60_000);

  const active: TabId = (TABS.find((t) => t.id === tab)?.id ?? 'book') as TabId;
  const funderName = funders.find((f) => f.id === funder)?.name;

  const head = (
    <SectionHeader
      eyebrow="Capital desk"
      title="Capital desk"
      tabs={DESK_TABS}
      description={funderName ? `${funderName}${desk?.role ? ` · ${desk.role === 'STAFF' ? 'TruckWys staff' : desk.role === 'APPROVER' ? 'Approver' : 'Viewer'}` : ''}` : 'Book, approvals and policy'}
      actions={funders.length > 1 ? (
        <Select value={funder != null ? String(funder) : undefined} onValueChange={(v) => setFunder(Number(v))}>
          <SelectTrigger className="cap-funder" aria-label="Funder" style={{ height: 'var(--control-h, 36px)' }}>
            <SelectValue placeholder="Funder" />
          </SelectTrigger>
          <SelectContent>
            {funders.map((f) => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : undefined}
    />
  );

  if (!tab) return <Navigate to="/capital/desk/book" replace />;

  if (status.isLoading) {
    return (
      <div className="fin-page" aria-busy="true">
        {head}
        <div className="fin-stack fin-stack--16"><SkelCard height={106} /><SkelCard height={320} /></div>
      </div>
    );
  }
  if (loadFailed(status) && (status.error as { status?: number } | null)?.status !== 403 && (status.error as { status?: number } | null)?.status !== 404) {
    return (
      <div className="fin-page">
        {head}
        <LoadError what="the capital desk" error={status.error ?? status.failureReason} busy={status.isFetching} onRetry={() => status.refetch()} />
      </div>
    );
  }
  if (!desk?.access) return <Navigate to="/" replace />;
  if (!TABS.some((t) => t.id === tab)) return <Navigate to="/capital/desk/book" replace />;

  const ctx: DeskCtx = { funder, role: desk.role };
  // Wait for the funder choice when there is more than one, so the first
  // requests are not made for the default and then again.
  const ready = funders.length === 0 || funder != null;

  return (
    <div className="fin-page">
      {head}
      {!ready ? <SkelCard height={320} /> : (
        <div key={funder ?? 'default'}>
          {active === 'book' && <BookTab ctx={ctx} />}
          {active === 'approvals' && <ApprovalsTab ctx={ctx} />}
          {active === 'queue' && <QueueTab ctx={ctx} />}
          {active === 'alerts' && <AlertsTab ctx={ctx} />}
          {active === 'ledger' && <LedgerTab ctx={ctx} />}
          {active === 'debtors' && <DebtorsTab ctx={ctx} />}
          {active === 'transporters' && <TransportersTab ctx={ctx} />}
          {active === 'policy' && <PolicyTab ctx={ctx} />}
          {active === 'data-room' && <DataRoomTab ctx={ctx} />}
        </div>
      )}
    </div>
  );
}
