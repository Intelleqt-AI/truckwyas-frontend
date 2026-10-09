import { useCallback, useEffect, useRef, useState } from "react";
import { postData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { vt, voiceErrorText, type UiLang } from "@/lib/voiceQuote";

const BAR_COUNT = 28;
const MIN_RECORDING_BYTES = 1000; // guards against a tap-and-release with ~nothing captured
/** Recording stops on its own here ("Stopped at 1 minute"). */
export const MAX_RECORDING_SECONDS = 60;
/** The remaining time shows from here on. */
export const COUNTDOWN_FROM_SECONDS = 50;

export interface VoiceMeta {
  /** "Afrikaans" / "English", from the server. */
  languageLabel: string | null;
  /** "high" | "low" (English and Afrikaans scored close: likely mixed) | "chosen" (forced). */
  languageConfidence: string | null;
}

/**
 * Records from the mic, shows live amplitude bars while recording, then posts
 * the clip to ai/voice-quote/ and hands the text back via onTranscribed: the
 * caller runs it through the same extraction path as typed text, so voice and
 * text fill the form identically.
 *
 * Language: with `language` unset (Auto) the server picks between English and
 * Afrikaans itself (one or two Whisper passes) and says which it heard
 * (`detected_language`, `language_label`, `language_confidence`). When the
 * two passes scored close it also returns the other language's transcript
 * (`alternate.text`), passed through as `alternateText` so chat-quote can use
 * it to fill only what the main transcript missed. `language` ("en" | "af")
 * forces that language: it is set only from the user's own language chip.
 *
 * Stops on its own at 60 s. Esc while recording cancels and discards.
 */
export function useVoiceRecorder(
  onTranscribed: (text: string, detectedLanguage: string | null, alternateText: string | null, meta: VoiceMeta) => void,
  language?: "en" | "af",
  uiLang: UiLang = "en",
) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => new Array(BAR_COUNT).fill(4));
  const [elapsed, setElapsed] = useState(0);
  // "Stopped at 1 minute" after an automatic stop, until the next recording.
  const [stoppedAtLimit, setStoppedAtLimit] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  const onTranscribedRef = useRef(onTranscribed);
  useEffect(() => { onTranscribedRef.current = onTranscribed; }, [onTranscribed]);
  const languageRef = useRef(language);
  useEffect(() => { languageRef.current = language; }, [language]);
  const uiLangRef = useRef(uiLang);
  useEffect(() => { uiLangRef.current = uiLang; }, [uiLang]);

  // Stops tracks/analyser/timer without touching React state — safe to call
  // from the unmount cleanup, where calling setState would warn.
  const releaseAudio = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (timerRef.current != null) clearInterval(timerRef.current);
    timerRef.current = null;
    audioCtxRef.current?.close().catch(() => { /* noop */ });
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const handleStop = useCallback(async () => {
    const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || "audio/webm" });
    chunksRef.current = [];
    if (discardRef.current) { discardRef.current = false; return; }
    if (blob.size < MIN_RECORDING_BYTES) {
      toast.error(vt(uiLangRef.current, "no_speech"));
      return;
    }
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      if (languageRef.current) form.append("language", languageRef.current);
      const res = await postData({ url: "api/v1/ai/voice-quote/", data: form });
      if (res?.success && res.text?.trim()) {
        const alt = typeof res.alternate?.text === "string" && res.alternate.text.trim() ? res.alternate.text.trim() : null;
        onTranscribedRef.current(res.text.trim(), res.detected_language ?? null, alt, {
          languageLabel: res.language_label ?? null, languageConfidence: res.language_confidence ?? null,
        });
      } else {
        toast.error(voiceErrorText(422, res?.error, uiLangRef.current));
      }
    } catch (e: unknown) {
      // Api.ts rethrows with the server's plain `error` as the message and the HTTP status.
      const err = e as { status?: number; message?: string };
      toast.error(voiceErrorText(err?.status ?? null, err?.status ? err.message : null, uiLangRef.current));
    } finally {
      setTranscribing(false);
    }
  }, []);

  const stop = useCallback(() => {
    try { mediaRecorderRef.current?.stop(); } catch { /* noop */ }
    releaseAudio();
    setRecording(false);
  }, [releaseAudio]);

  /** Stop and throw the clip away (Esc). */
  const cancel = useCallback(() => {
    discardRef.current = true;
    stop();
  }, [stop]);

  const start = useCallback(async () => {
    setStoppedAtLimit(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      discardRef.current = false;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = handleStop;
      mediaRecorderRef.current = recorder;
      recorder.start();

      // Live amplitude bars — purely visual feedback that the mic is picking
      // up sound, driven by the same stream being recorded.
      const AudioContextCls = window.AudioContext
        || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextCls();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const step = Math.max(1, Math.floor(data.length / BAR_COUNT));
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const next: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) next.push(Math.max(4, Math.round(((data[i * step] || 0) / 255) * 32)));
        setLevels(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      // Elapsed time as text (never the waveform alone), and the 60 s stop.
      startedAtRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(s);
        if (s >= MAX_RECORDING_SECONDS) {
          setStoppedAtLimit(true);
          try { mediaRecorderRef.current?.stop(); } catch { /* noop */ }
          releaseAudio();
          setRecording(false);
        }
      }, 250);

      setRecording(true);
    } catch {
      releaseAudio();
      toast.error(vt(uiLangRef.current, "mic_denied"));
    }
  }, [handleStop, releaseAudio]);

  // Esc cancels and discards, wherever focus is.
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); cancel(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recording, cancel]);

  useEffect(() => () => {
    discardRef.current = true;
    try { mediaRecorderRef.current?.stop(); } catch { /* noop */ }
    releaseAudio();
  }, [releaseAudio]);

  const remaining = recording && elapsed >= COUNTDOWN_FROM_SECONDS ? Math.max(0, MAX_RECORDING_SECONDS - elapsed) : null;
  const clearNotice = useCallback(() => setStoppedAtLimit(false), []);
  return { recording, transcribing, levels, elapsed, remaining, stoppedAtLimit, clearNotice, start, stop, cancel };
}
