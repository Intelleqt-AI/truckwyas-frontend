import { Trash2 } from 'lucide-react';
import OverflowMenu from '@/components/ui/OverflowMenu';
import { formatDateTime, formatDays } from '@/lib/formatters';

export interface ConversationSummary {
  id: number;
  title?: string | null;
  message_count?: number;
  updated_at?: string;
}

export const conversationTitle = (c: ConversationSummary) => (c.title || '').trim() || 'New conversation';

/** "Just now", "12 minutes ago", "3 hours ago", "104 days ago" (no abbreviations). */
export function updatedAgo(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  return `${formatDays(Math.floor(hours / 24))} ago`;
}

interface Props {
  conversations: ConversationSummary[];
  loaded: boolean;
  activeId: number | null;
  onOpen: (id: number) => void;
  onDelete: (c: ConversationSummary) => void;
}

/**
 * The conversation list (desktop rail and the phone sheet). Each row is the
 * open button first, then its own "⋯" menu, so Tab reaches a conversation
 * before its Delete.
 */
export default function ConversationList({ conversations, loaded, activeId, onOpen, onDelete }: Props) {
  if (!loaded) {
    return (
      <div className="cp-convs" aria-busy="true" aria-label="Loading conversations">
        {[0, 1, 2].map((i) => (
          <div key={i} className="cp-conv cp-conv--skeleton" aria-hidden="true">
            <span className="cp-skel" style={{ width: `${70 - i * 12}%` }} />
            <span className="cp-skel cp-skel--sm" />
          </div>
        ))}
      </div>
    );
  }
  if (conversations.length === 0) {
    return <p className="cp-convs__empty">No conversations yet. Your chats are kept here.</p>;
  }
  return (
    <ul className="cp-convs">
      {conversations.map((c) => {
        const title = conversationTitle(c);
        const n = c.message_count ?? 0;
        const active = c.id === activeId;
        return (
          <li key={c.id} className={`cp-conv${active ? ' is-active' : ''}`}>
            <button
              type="button"
              className="cp-conv__open"
              onClick={() => onOpen(c.id)}
              aria-current={active ? 'true' : undefined}
            >
              <span className="cp-conv__title">{title}</span>
              <span className="cp-conv__meta" title={c.updated_at ? `Updated ${formatDateTime(c.updated_at)}` : undefined}>
                {n} {n === 1 ? 'message' : 'messages'}{c.updated_at ? ` · ${updatedAgo(c.updated_at)}` : ''}
              </span>
            </button>
            <OverflowMenu
              label={`Conversation "${title}" actions`}
              items={[{ label: 'Delete conversation', danger: true, icon: <Trash2 size={16} />, onSelect: () => onDelete(c) }]}
            />
          </li>
        );
      })}
    </ul>
  );
}
