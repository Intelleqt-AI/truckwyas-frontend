import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { MessageCircle, X, Mic, Square, Send } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import "./ai-chat-panel.css";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  // A manual-add deep link offered alongside a message (e.g. "no such client —
  // add one here"). Rendered as a real clickable link, not raw text in the bubble.
  link?: { label: string; href: string };
}

interface AIChatPanelProps {
  messages: ChatMessage[];
  busy: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (text: string, detectedLanguage?: string | null) => void;
  /**
   * Position only. When passed (even as null while the host's slot mounts),
   * the launcher renders inside that element as an ordinary icon button
   * instead of floating bottom-right. Omit it to keep the floating launcher.
   */
  launcherSlot?: HTMLElement | null;
}

/**
 * Floating AI assistant — a persistent circular launcher (bottom-right) that
 * opens a conversation panel. Every message the user sends and every reply
 * the AI gives lands here, so a multi-turn "actually make it round trip"
 * follow-up has something to reply against instead of vanishing into a toast.
 */
const TRANSITION_MS = 180;

export function AIChatPanel({ messages, busy, open, onOpenChange, onSend, launcherSlot }: AIChatPanelProps) {
  const inlineLauncher = launcherSlot !== undefined;
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const hasUnread = !open && messages.length > 0 && messages[messages.length - 1].role === "assistant";

  // Keeps the panel mounted for the exit transition instead of vanishing
  // instantly: mounted flips true immediately on open, animateIn flips a beat
  // later so the opacity/transform actually has a "from" state to tween from;
  // closing reverses that order, unmounting only once the fade-out finishes.
  const [mounted, setMounted] = useState(open);
  const [animateIn, setAnimateIn] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setAnimateIn(true));
      return () => cancelAnimationFrame(raf);
    }
    setAnimateIn(false);
    const t = setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => clearTimeout(t);
  }, [open]);

  const voice = useVoiceRecorder((transcribed, lang) => { onSend(transcribed, lang); });

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, busy]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };

  const launcher = (
    <button
      type="button"
      onClick={() => onOpenChange(!open)}
      title="AI assistant"
      aria-label="AI assistant"
      aria-expanded={open}
      className={inlineLauncher ? "ai-launcher ai-launcher--inline" : "ai-launcher"}
    >
      <span style={{ position: "relative", width: 20, height: 20, display: "inline-block" }}>
        <MessageCircle size={20} style={{
          position: "absolute", inset: 0,
          opacity: open ? 0 : 1, transform: open ? "rotate(-45deg) scale(0.6)" : "rotate(0deg) scale(1)",
          transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms ease`,
        }} />
        <X size={20} style={{
          position: "absolute", inset: 0,
          opacity: open ? 1 : 0, transform: open ? "rotate(0deg) scale(1)" : "rotate(45deg) scale(0.6)",
          transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms ease`,
        }} />
      </span>
      {hasUnread && (
        <span style={{ position: "absolute", top: 4, right: 4, width: 10, height: 10, borderRadius: "50%", background: "var(--status-danger)", border: "2px solid var(--bg-surface)" }} />
      )}
    </button>
  );

  return (
    <>
      {mounted && (
        <div
          className="ai-chat-panel"
          style={{
            display: "flex", flexDirection: "column",
            background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-card)", overflow: "hidden",
            transformOrigin: "bottom right",
            opacity: animateIn ? 1 : 0,
            transform: animateIn ? "translateY(0) scale(1)" : "translateY(12px) scale(0.95)",
            transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms ease`,
            pointerEvents: animateIn ? "auto" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MessageCircle size={15} color="var(--accent-primary)" />
              <span style={{ fontSize: 14, lineHeight: "20px", fontWeight: 600, color: "var(--text-primary)" }}>AI assistant</span>
            </div>
            <button onClick={() => onOpenChange(false)} title="Close" aria-label="Close" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, marginRight: -8, borderRadius: "var(--radius-control)", border: "none", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer" }}>
              <X size={15} />
            </button>
          </div>

          <div ref={listRef} style={{ flex: 1, minHeight: 160, maxHeight: 360, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--text-secondary)", textAlign: "center", marginTop: 20 }}>
                Describe the load in plain language, or use the mic. I'll fill in the form as we talk.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "80%", fontSize: 13, lineHeight: "20px", padding: "8px 12px", borderRadius: "var(--radius-nested)",
                  background: m.role === "user" ? "var(--accent-primary)" : "var(--bg-surface-hover)",
                  color: m.role === "user" ? "var(--btn-action-color)" : "var(--text-primary)",
                  border: m.role === "user" ? "none" : "1px solid var(--border-subtle)",
                }}>
                  <div>{m.text}</div>
                  {m.link && (
                    <Link
                      to={m.link.href}
                      style={{ display: "inline-block", marginTop: 6, fontSize: 13, color: "var(--accent-primary)", textDecoration: "underline" }}
                    >
                      {m.link.label} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--text-secondary)", padding: "8px 12px", borderRadius: "var(--radius-nested)", border: "1px solid var(--border-subtle)" }}>
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", padding: 12 }}>
            {voice.recording ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--status-danger)", flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, height: 24 }}>
                  {voice.levels.map((h, i) => (
                    <div key={i} style={{ width: 2, height: Math.min(h, 22), borderRadius: 1, background: "var(--accent-primary)" }} />
                  ))}
                </div>
                <button onClick={voice.stop} title="Stop recording" aria-label="Stop recording" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", border: "none", background: "var(--status-danger)", color: "#fff", cursor: "pointer", flexShrink: 0 }}>
                  <Square size={11} fill="#fff" />
                </button>
              </div>
            ) : voice.transcribing ? (
              <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--text-secondary)", padding: "6px 4px" }}>Transcribing…</div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()}
                  placeholder="Message the AI…"
                  disabled={busy}
                  style={{ flex: 1, background: "var(--input-bg)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-control)", padding: "8px 12px", minHeight: 40, boxSizing: "border-box", fontSize: 14, lineHeight: "20px", color: "var(--text-primary)", outline: "none" }}
                />
                <button onClick={voice.start} disabled={busy} title="Record voice" aria-label="Record voice" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", color: "var(--accent-primary)", cursor: "pointer", flexShrink: 0 }}>
                  <Mic size={16} />
                </button>
                <button onClick={submit} disabled={busy || !text.trim()} title="Send" aria-label="Send" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", border: "none", background: "var(--accent-primary)", color: "var(--btn-action-color)", cursor: "pointer", opacity: text.trim() ? 1 : 0.5, flexShrink: 0 }}>
                  <Send size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!inlineLauncher ? launcher : launcherSlot ? createPortal(launcher, launcherSlot) : null}
    </>
  );
}
