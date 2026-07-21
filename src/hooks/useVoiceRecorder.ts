import { useCallback, useEffect, useRef, useState } from "react";
import { postData } from "@/lib/Api";
import { toast } from "@/lib/toast";

const BAR_COUNT = 28;
const MIN_RECORDING_BYTES = 1000; // guards against a tap-and-release with ~nothing captured

/**
 * Records from the mic, shows live amplitude bars while recording, then posts
 * the clip to the Whisper-backed transcription endpoint and hands the text
 * back via onTranscribed — the caller runs it through the same extraction
 * path as typed text, so voice and text fill the form identically.
 */
export function useVoiceRecorder(onTranscribed: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => new Array(BAR_COUNT).fill(4));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const onTranscribedRef = useRef(onTranscribed);
  useEffect(() => { onTranscribedRef.current = onTranscribed; }, [onTranscribed]);

  // Stops tracks/analyser without touching React state — safe to call from
  // the unmount cleanup, where calling setState would warn.
  const releaseAudio = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => { /* noop */ });
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const handleStop = useCallback(async () => {
    const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || "audio/webm" });
    chunksRef.current = [];
    if (blob.size < MIN_RECORDING_BYTES) {
      toast.error("Didn't catch anything — hold the mic, speak, then stop.");
      return;
    }
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      const res = await postData({ url: "api/v1/ai/voice-quote/", data: form });
      if (res?.success && res.text?.trim()) {
        onTranscribedRef.current(res.text.trim());
      } else {
        toast.error(res?.error || "Couldn't transcribe that — try again");
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || "Couldn't transcribe that — try again");
    } finally {
      setTranscribing(false);
    }
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
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

      setRecording(true);
    } catch {
      toast.error("Couldn't access the microphone — check your browser permissions");
    }
  }, [handleStop]);

  const stop = useCallback(() => {
    try { mediaRecorderRef.current?.stop(); } catch { /* noop */ }
    releaseAudio();
    setRecording(false);
  }, [releaseAudio]);

  useEffect(() => () => {
    try { mediaRecorderRef.current?.stop(); } catch { /* noop */ }
    releaseAudio();
  }, [releaseAudio]);

  return { recording, transcribing, levels, start, stop };
}
