import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface Props {
  onClose: () => void;
  children: ReactNode;
}

/**
 * Phone: the conversation list as a bottom sheet (modal dialog). Focus is
 * trapped inside and returns to the trigger on close; Escape, the close
 * button and the backdrop close it.
 */
export default function ConversationsSheet({ onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);
  return (
    <div className="cp-sheet-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="cp-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-sheet-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
      >
        <div className="cp-sheet__head">
          <h2 id="cp-sheet-title" className="cp-sheet__title">Conversations</h2>
          <button type="button" className="cp-icon-btn" onClick={onClose} aria-label="Close conversations" data-autofocus>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="cp-sheet__body">{children}</div>
      </div>
    </div>
  );
}
