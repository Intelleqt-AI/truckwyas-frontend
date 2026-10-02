import type { ReactNode } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle, MinusCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { settingsCardStyle, settingsCardHeaderStyle, settingsCardTitleStyle } from '../settingsUi';
import '@/components/accounting/accounting.css';
import '@/pages/ops-tiles.css';

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
export function AcctCard({ title, description, actions, children, id, flush = false, actionsBelow = false }: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Put the actions under the description (long descriptions, several buttons). */
  actionsBelow?: boolean;
  children?: ReactNode;
  id?: string;
  /** No body padding: the children draw their own rows. */
  flush?: boolean;
}) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section style={settingsCardStyle} aria-labelledby={titleId} id={id}>
      <div style={{ ...settingsCardHeaderStyle, justifyContent: 'space-between', alignItems: 'flex-start', ...(children == null || children === false ? { borderBottom: 0 } : null) }}>
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <h2 id={titleId} style={settingsCardTitleStyle}>{title}</h2>
          {description && <div className="acct-section-desc" style={{ margin: '2px 0 0' }}>{description}</div>}
          {actions && actionsBelow && <div className="acct-card-actions acct-card-actions--below">{actions}</div>}
        </div>
        {actions && !actionsBelow && <div className="acct-card-actions">{actions}</div>}
      </div>
      {children != null && children !== false && <div style={flush ? undefined : { padding: 'var(--card-pad, 20px)' }}>{children}</div>}
    </section>
  );
}

/** Placeholder rows inside a card while its data loads (no spinner): each
 *  row is the height of a real list / mapping row, so nothing jumps. */
export function LoadingBlock({ label, rows = 4, rowHeight = 64 }: { label: string; rows?: number; rowHeight?: number }) {
  return (
    <div className="acct-skel-rows" aria-busy="true" aria-label={label} role="status">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ minHeight: rowHeight, boxSizing: 'border-box' }}>
          <span className="ops-skel" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
          <span className="ops-skel" style={{ width: `${40 + ((i * 23) % 45)}%` }} />
        </div>
      ))}
    </div>
  );
}

/** A grey bar that occupies one line of text (lineHeight px tall). */
export function SkelLine({ width, lineHeight = 20 }: { width: number | string; lineHeight?: number }) {
  return <span className="acct-skel-line" style={{ height: lineHeight }} aria-hidden="true"><span className="ops-skel" style={{ width }} /></span>;
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="acct-empty" role="alert">
      <p style={{ margin: '0 0 12px', color: 'var(--status-danger-text)' }}>{message}</p>
      {onRetry && <button type="button" className="tw-btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export type StepLook = 'done' | 'todo' | 'busy' | 'bad' | 'skip' | 'warn';

export function StepIcon({ look }: { look: StepLook }) {
  const common = { size: 18, 'aria-hidden': true as const };
  if (look === 'done') return <CheckCircle2 {...common} className="acct-check__icon is-done" />;
  if (look === 'busy') return <Loader2 {...common} className="acct-check__icon is-busy animate-spin" />;
  if (look === 'bad' || look === 'warn') return <XCircle {...common} className="acct-check__icon is-bad" />;
  if (look === 'skip') return <MinusCircle {...common} className="acct-check__icon is-todo" />;
  return <Circle {...common} className="acct-check__icon is-todo" />;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-ZA')} ${n === 1 ? one : many}`;
