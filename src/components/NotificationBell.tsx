import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchData, postData } from '@/lib/Api';

interface Note {
  id: number;
  title: string;
  description?: string;
  type?: string;
  unread?: boolean;
  link?: string;
  created_at: string;
}

const TYPE_COLOR: Record<string, string> = {
  success: 'var(--status-success)',
  warning: 'var(--status-warning)',
  alert: 'var(--status-danger)',
  info: 'var(--accent-primary)',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetchData('api/v1/notifications/?limit=20')
      .then((d: any) => setNotes(Array.isArray(d) ? d : (d?.results || [])))
      .catch(() => {});
    fetchData('api/v1/notifications/?unread=true')
      .then((d: any) => setUnread(typeof d?.count === 'number' ? d.count : (Array.isArray(d) ? d.length : (d?.results?.length || 0))))
      .catch(() => {});
  }, []);

  // Load once on mount. Auto-refresh (interval poll + live-event push) is
  // disabled for now — notifications only refresh when the app remounts.
  useEffect(() => { load(); }, [load]);

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
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', display: 'grid', placeItems: 'center', padding: 6,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0, minWidth: 15, height: 15, padding: '0 3px',
            borderRadius: 999, background: 'var(--status-danger)', color: '#fff',
            fontSize: 9, fontWeight: 700, display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-mono)', lineHeight: 1,
          }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 340, maxHeight: 460,
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)', zIndex: 2000, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Mark all read
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto' }}>
            {notes.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No notifications yet</div>
            ) : notes.map(n => (
              <div
                key={n.id}
                onClick={() => onClickNote(n)}
                style={{
                  display: 'flex', gap: 10, padding: '11px 14px', cursor: n.link ? 'pointer' : 'default',
                  borderBottom: '1px solid var(--border-row)',
                  background: n.unread ? 'color-mix(in srgb, var(--accent-primary) 7%, transparent)' : 'transparent',
                }}
              >
                <span style={{ marginTop: 5, flexShrink: 0, width: 7, height: 7, borderRadius: '50%', background: n.unread ? (TYPE_COLOR[n.type || 'info'] || 'var(--accent-primary)') : 'var(--border-active)' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: n.unread ? 600 : 500, color: 'var(--text-primary)', marginBottom: 2 }}>{n.title}</div>
                  {n.description && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 3, lineHeight: 1.4 }}>{n.description}</div>}
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{timeAgo(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
