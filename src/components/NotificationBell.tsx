import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchData, postData } from '@/lib/Api';
import { useLiveEvent } from '@/hooks/useLiveEvent';
import { formatRelativeTime, normaliseFigures, sentenceCaseLabel } from '@/lib/formatters';
import './notification-brand.css';

interface Note {
  id: number;
  title: string;
  description?: string;
  type?: string;
  unread?: boolean;
  link?: string;
  created_at: string;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // One refresh = the latest 20 + the unread count (a COUNT query, not every
  // unread row). Rejects if either failed so the live refresher backs off.
  const load = useCallback(async () => {
    const [list, count] = await Promise.allSettled([
      fetchData('api/v1/notifications/?limit=20'),
      fetchData('api/v1/notifications/unread_count/'),
    ]);
    if (list.status === 'fulfilled') {
      const d = list.value as Note[] | { results?: Note[] } | null;
      setNotes(Array.isArray(d) ? d : (d?.results || []));
    }
    if (count.status === 'fulfilled') {
      const d = count.value as { count?: unknown } | null;
      setUnread(typeof d?.count === 'number' ? d.count : 0);
    }
    const failed = [list, count].find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) throw failed.reason;
  }, []);

  // Load on mount. Live pushes (and a reconnect after a gap) are coalesced:
  // a burst of events is one reload, a failing API backs off, and nothing is
  // fetched while the tab is hidden (useLiveEvent / lib/liveRefresh.ts).
  useEffect(() => { load().catch(() => {}); }, [load]);
  useLiveEvent(() => true, load, { onReconnect: true });

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as any)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const markAllRead = async () => {
    setUnread(0);
    setNotes(prev => prev.map(n => ({ ...n, unread: false })));
    await postData({ url: 'api/v1/notifications/mark-read/', data: { all: true } }).catch(() => {});
  };

  const onClickNote = async (n: Note) => {
    if (n.unread) {
      setUnread(u => Math.max(0, u - 1));
      setNotes(prev => prev.map(x => x.id === n.id ? { ...x, unread: false } : x));
      postData({ url: 'api/v1/notifications/mark-read/', data: { ids: [n.id] } }).catch(() => {});
    }
    if (n.link) { setOpen(false); navigate(n.link); }
  };

  return (
    <div ref={ref} className="dashboard-notifications" style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="dashboard-notification-trigger"
        style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', display: 'grid', placeItems: 'center', padding: 'var(--note-trigger-padding, 6px)',
        }}
      >
        <svg className="dashboard-notification-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="dashboard-notification-count" style={{
            position: 'absolute', top: 0, right: 0, minWidth: 'var(--note-count-size, 18px)', height: 'var(--note-count-size, 18px)', padding: 'var(--note-count-padding, 0 3px)',
            borderRadius: 999, background: 'var(--note-danger-surface, var(--status-danger))', color: 'var(--note-danger-text, #fff)',
            fontSize: 'var(--note-support-size, 12px)', fontWeight: 'var(--note-label-weight, 700)', display: 'grid', placeItems: 'center',
            fontFamily: 'var(--note-font, var(--font-sans))', lineHeight: 'var(--note-line, 1)',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="dashboard-notification-panel" role="dialog" aria-label="Notifications" style={{
          position: 'absolute', top: 'var(--note-panel-top, calc(100% + 10px))', right: 0, width: 360, maxWidth: 'calc(100vw - 24px)', maxHeight: 460,
          background: 'var(--bg-overlay)', border: '1px solid var(--border-overlay, var(--border-subtle))', borderRadius: 'var(--radius-menu, 12px)',
          boxShadow: 'var(--shadow-pop)',
          zIndex: 2000, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div className="dashboard-notification-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--note-header-padding, 12px 14px)', borderBottom: '1px solid var(--border-overlay, var(--border-subtle))' }}>
            <h2 className="dashboard-notification-title" style={{ fontSize: 'var(--note-title-size, 16px)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Notifications</h2>
            {unread > 0 && (
              <button className="dashboard-notification-mark-read" onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--note-font, var(--font-sans))', fontSize: 'var(--note-body-size, 14px)', letterSpacing: 'var(--note-tracking, normal)', textTransform: 'var(--note-case, none)' as React.CSSProperties['textTransform'] }}>
                Mark all read
              </button>
            )}
          </div>
          <div className="dashboard-notification-list" style={{ overflowY: 'auto' }}>
            {notes.length === 0 ? (
              <div style={{ padding: 'var(--note-empty-padding, 28px)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--note-support-size, 12px)' }}>No notifications yet</div>
            ) : notes.map(n => (
              <div
                key={n.id}
                className={`dashboard-notification-row${n.unread ? ' is-unread' : ''}`}
                onClick={() => onClickNote(n)}
                role={n.link ? 'button' : undefined}
                tabIndex={n.link ? 0 : undefined}
                onKeyDown={n.link ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClickNote(n); } } : undefined}
                style={{
                  display: 'flex', gap: 'var(--note-row-gap, 10px)', padding: 'var(--note-row-padding, 11px 14px)', cursor: n.link ? 'pointer' : 'default',
                  borderBottom: '1px solid var(--border-row)',
                }}
              >
                {/* Unread: a neutral 6px dot and 500 weight. No tinted wash, no type colours. */}
                <span aria-hidden="true" style={{ marginTop: 7, flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: n.unread ? 'var(--text-primary)' : 'transparent' }} />
                {n.unread && <span className="sr-only">Unread: </span>}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 'var(--note-body-size, 12.5px)', fontWeight: n.unread ? 'var(--note-unread-weight, 600)' : 'var(--note-read-weight, 500)', color: 'var(--text-primary)', marginBottom: 'var(--note-copy-gap, 2px)' }}>{sentenceCaseLabel(normaliseFigures(n.title))}</div>
                  {n.description && <div style={{ fontSize: 'var(--note-body-size, 11.5px)', color: 'var(--text-secondary)', marginBottom: 'var(--note-copy-gap, 3px)', lineHeight: 'var(--note-line, 1.4)' }}>{normaliseFigures(n.description)}</div>}
                  <div style={{ fontSize: 'var(--note-support-size, 10px)', color: 'var(--text-tertiary)', fontFamily: 'var(--note-font, var(--font-sans))' }}>{formatRelativeTime(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
