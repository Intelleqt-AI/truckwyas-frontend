import type { ReactNode } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle, MinusCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { settingsCardStyle, settingsCardHeaderStyle, settingsCardTitleStyle } from '../settingsUi';
import '@/components/accounting/accounting.css';

/** Who may change the accounting connection: company admins, never the demo. */
export function useAccountingPermissions() {
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const isDemo = !!user?.is_demo;
  const canWrite = isAdmin && !isDemo;
  const writeTitle = isDemo
    ? 'Not available in the demo'
    : !isAdmin ? 'Only a company admin can change this' : undefined;
  return { isAdmin, isDemo, canWrite, writeTitle };
}

/** A settings card with a title row (and optional actions on the right). */
export function AcctCard({ title, description, actions, children, id, flush = false }: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
  /** No body padding: the children draw their own rows. */
  flush?: boolean;
}) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section style={settingsCardStyle} aria-labelledby={titleId} id={id}>
      <div style={{ ...settingsCardHeaderStyle, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <h2 id={titleId} style={settingsCardTitleStyle}>{title}</h2>
          {description && <p className="acct-section-desc" style={{ margin: '2px 0 0' }}>{description}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
      </div>
      <div style={flush ? undefined : { padding: 'var(--card-pad, 20px)' }}>{children}</div>
    </section>
  );
}

export function LoadingBlock({ label, height = 160 }: { label: string; height?: number }) {
  return (
    <div aria-busy="true" aria-label={label} style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
      <Loader2 size={20} className="animate-spin" aria-hidden="true" />
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="acct-empty" role="alert">
      <p style={{ margin: '0 0 12px', color: 'var(--status-danger-text)' }}>{message}</p>
      {onRetry && <button type="button" className="tw-btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export type StepLook = 'done' | 'todo' | 'busy' | 'bad' | 'skip';

export function StepIcon({ look }: { look: StepLook }) {
  const common = { size: 18, 'aria-hidden': true as const };
  if (look === 'done') return <CheckCircle2 {...common} className="acct-check__icon is-done" />;
  if (look === 'busy') return <Loader2 {...common} className="acct-check__icon is-busy animate-spin" />;
  if (look === 'bad') return <XCircle {...common} className="acct-check__icon is-bad" />;
  if (look === 'skip') return <MinusCircle {...common} className="acct-check__icon is-todo" />;
  return <Circle {...common} className="acct-check__icon is-todo" />;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-ZA')} ${n === 1 ? one : many}`;
