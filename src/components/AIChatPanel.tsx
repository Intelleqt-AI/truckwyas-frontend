import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Mic, Square, Send } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface AIChatPanelProps {
  messages: ChatMessage[];
  busy: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (text: string) => void;
}

/**
 * Floating AI assistant — a persistent circular launcher (bottom-right) that
 * opens a conversation panel. Every message the user sends and every reply
 * the AI gives lands here, so a multi-turn "actually make it round trip"
 * follow-up has something to reply against instead of vanishing into a toast.
 */
const TRANSITION_MS = 180;

export function AIChatPanel({ messages, busy, open, onOpenChange, onSend }: AIChatPanelProps) {
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

  const voice = useVoiceRecorder((transcribed) => { onSend(transcribed); });

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, busy]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };

  return (
    <>
      {mounted && (
        <div
          style={{
            position: "fixed", bottom: 92, right: 24, width: 360, maxHeight: "70vh", zIndex: 60,
            display: "flex", flexDirection: "column",
            background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
            borderRadius: 8, boxShadow: "var(--shadow-card-hover, var(--shadow-card))", overflow: "hidden",
            transformOrigin: "bottom right",
            opacity: animateIn ? 1 : 0,
            transform: animateIn ? "translateY(0) scale(1)" : "translateY(12px) scale(0.95)",
            transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms ease`,
            pointerEvents: animateIn ? "auto" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MessageCircle size={15} color="var(--accent-primary)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>AI Assistant</span>
            </div>
            <button onClick={() => onOpenChange(false)} title="Close" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 4, border: "none", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer" }}>
              <X size={15} />
            </button>
          </div>

          <div ref={listRef} style={{ flex: 1, minHeight: 160, maxHeight: 360, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", marginTop: 20 }}>
                Describe the load in plain language, or use the mic — I'll fill in the form as we talk.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "80%", fontSize: 13, lineHeight: 1.4, padding: "8px 12px", borderRadius: 10,
                  background: m.role === "user" ? "var(--accent-primary)" : "var(--bg-surface-hover)",
                  color: m.role === "user" ? "var(--btn-action-color)" : "var(--text-primary)",
                  border: m.role === "user" ? "none" : "1px solid var(--border-subtle)",
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", padding: 10 }}>
            {voice.recording ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--status-danger)", flexShrink: 0, animation: "pulse-dot 1s infinite" }} />
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, height: 24 }}>
                  {voice.levels.map((h, i) => (
                    <div key={i} style={{ width: 2, height: Math.min(h, 22), borderRadius: 1, background: "var(--accent-primary)" }} />
                  ))}
                </div>
                <button onClick={voice.stop} title="Stop recording" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", border: "none", background: "var(--status-danger)", color: "#fff", cursor: "pointer", flexShrink: 0 }}>
                  <Square size={11} fill="#fff" />
                </button>
              </div>
            ) : voice.transcribing ? (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "6px 4px" }}>Transcribing…</div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()}
                  placeholder="Message the AI…"
                  disabled={busy}
                  style={{ flex: 1, background: "var(--input-bg)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "8px 10px", fontSize: 13, color: "var(--text-primary)", outline: "none" }}
                />
                <button onClick={voice.start} disabled={busy} title="Record voice" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", color: "var(--accent-primary)", cursor: "pointer", flexShrink: 0 }}>
                  <Mic size={13} />
                </button>
                <button onClick={submit} disabled={busy || !text.trim()} title="Send" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", border: "none", background: "var(--accent-primary)", color: "var(--btn-action-color)", cursor: "pointer", opacity: text.trim() ? 1 : 0.5, flexShrink: 0 }}>
                  <Send size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => onOpenChange(!open)}
        title="AI Assistant"
        style={{
          position: "fixed", bottom: 24, right: 24, width: 52, height: 52, borderRadius: "50%",
          border: "none", background: "var(--accent-primary)", color: "var(--btn-action-color)",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          boxShadow: "var(--shadow-card-hover, var(--shadow-card))", zIndex: 60,
          transition: `transform ${TRANSITION_MS}ms ease`,
          transform: open ? "scale(1.05)" : "scale(1)",
        }}
      >
        <span style={{ position: "relative", width: 22, height: 22, display: "inline-block" }}>
          <MessageCircle size={22} style={{
            position: "absolute", inset: 0,
            opacity: open ? 0 : 1, transform: open ? "rotate(-45deg) scale(0.6)" : "rotate(0deg) scale(1)",
            transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms ease`,
          }} />
          <X size={22} style={{
            position: "absolute", inset: 0,
            opacity: open ? 1 : 0, transform: open ? "rotate(0deg) scale(1)" : "rotate(45deg) scale(0.6)",
            transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms ease`,
          }} />
        </span>
        {hasUnread && (
          <span style={{ position: "absolute", top: 4, right: 4, width: 10, height: 10, borderRadius: "50%", background: "var(--status-danger)", border: "2px solid var(--bg-surface)" }} />
        )}
      </button>
    </>
  );
}
