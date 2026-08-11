import { useCallback, useEffect, useRef, useState } from "react";
import { buildVisemeTrack, type Viseme } from "@/interviewer/lib/visemes";
import {
  loadVoicePreference,
  resolveVoice,
  saveVoicePreference,
  type VoicePreference,
} from "@/interviewer/lib/voice-catalog";

/**
 * Speaks the interviewer's lines with the browser's built-in speech synthesis
 * (no API key, works offline) and exposes a live mouth-openness value plus a
 * viseme, which together drive the avatar's lip sync.
 */

const MOOD_PROSODY: Record<string, { rate: number; pitch: number }> = {
  neutral: { rate: 1, pitch: 1 },
  smile: { rate: 1.04, pitch: 1.08 },
  nod: { rate: 0.98, pitch: 1.02 },
  thinking: { rate: 0.92, pitch: 0.96 },
  curious: { rate: 1.02, pitch: 1.12 },
};

export function useSpeaker() {
  const rafRef = useRef<number | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const trackRef = useRef<Viseme[]>(["rest"]);
  const startedAtRef = useRef(0);
  const expectedMsRef = useRef(1);
  const doneRef = useRef<(() => void) | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [mouth, setMouth] = useState(0);
  const [viseme, setViseme] = useState<Viseme>("rest");
  const [muted, setMuted] = useState(false);
  const [supported, setSupported] = useState(true);
  const [voicePref, setVoicePrefState] = useState<VoicePreference>(() => loadVoicePreference());
  const [voicesReady, setVoicesReady] = useState(false);

  const setVoicePref = useCallback((pref: VoicePreference) => {
    setVoicePrefState(pref);
    saveVoicePreference(pref);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = "speechSynthesis" in window;
    setSupported(ok);
    if (!ok) return;
    // Voices load asynchronously in Chrome; touching the list warms it up.
    window.speechSynthesis.getVoices();
    const onVoices = () => {
      window.speechSynthesis.getVoices();
      setVoicesReady(true);
    };
    onVoices();
    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
  }, []);

  const tick = useCallback(() => {
    const track = trackRef.current;
    const elapsed = performance.now() - startedAtRef.current;
    const progress = Math.min(1, elapsed / expectedMsRef.current);
    // Synthesis gives no waveform access, so drive the mouth from the
    // text-derived viseme track plus a natural-looking articulation wobble.
    const index = Math.min(track.length - 1, Math.floor(progress * track.length));
    const next = track[index] ?? "rest";
    setViseme((prev) => (prev === next ? prev : next));
    const wobble = 0.55 + 0.45 * Math.sin(elapsed / 95);
    const openness = next === "rest" ? 0.08 : wobble;
    setMouth((prev) => prev * 0.5 + openness * 0.5);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const settle = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setMouth(0);
    setViseme("rest");
    setSpeaking(false);
  }, []);

  const stop = useCallback(() => {
    utteranceRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    settle();
    doneRef.current?.();
    doneRef.current = null;
  }, [settle]);

  const speak = useCallback(
    async (text: string, mood = "neutral") => {
      const clean = text.trim();
      if (!clean) return;
      stop();
      if (muted || typeof window === "undefined" || !("speechSynthesis" in window)) return;

      trackRef.current = buildVisemeTrack(clean);
      const prosody = MOOD_PROSODY[mood] ?? MOOD_PROSODY["neutral"]!;
      const words = clean.split(/\s+/).filter(Boolean).length;
      // ~165 wpm at rate 1 — used to pace the viseme track.
      expectedMsRef.current = Math.max(600, (words / (165 * prosody.rate)) * 60_000);
      startedAtRef.current = performance.now();

      const utterance = new SpeechSynthesisUtterance(clean);
      const resolved = resolveVoice(window.speechSynthesis.getVoices(), voicePref);
      if (resolved.voice) utterance.voice = resolved.voice;
      utterance.lang = resolved.voice?.lang ?? "en-US";
      utterance.rate = prosody.rate;
      utterance.pitch = prosody.pitch;
      utterance.volume = 1;
      utteranceRef.current = utterance;

      setSpeaking(true);
      rafRef.current = requestAnimationFrame(tick);

      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          doneRef.current = null;
          if (utteranceRef.current === utterance) {
            utteranceRef.current = null;
            settle();
          }
          resolve();
        };
        doneRef.current = finish;
        utterance.onend = finish;
        utterance.onerror = finish;
        // Word boundaries are the most accurate progress signal when available.
        utterance.onboundary = (event) => {
          if (!clean.length) return;
          const ratio = Math.min(1, (event.charIndex || 0) / clean.length);
          const elapsed = performance.now() - startedAtRef.current;
          if (ratio > 0.02) expectedMsRef.current = Math.max(600, elapsed / ratio);
        };
        window.speechSynthesis.speak(utterance);
        // Safety net: some browsers never fire onend if the tab is backgrounded.
        window.setTimeout(finish, expectedMsRef.current * 2 + 8000);
      });
    },
    [muted, settle, stop, tick, voicePref],
  );

  useEffect(() => stop, [stop]);

  const resolvedVoice = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return { voice: null, isFallback: false, fallbackReason: null };
    }
    return resolveVoice(window.speechSynthesis.getVoices(), voicePref);
  }, [voicePref]);

  return {
    speak,
    stop,
    speaking,
    mouth,
    viseme,
    muted,
    setMuted,
    supported,
    voicePref,
    setVoicePref,
    resolvedVoice,
    voicesReady,
  };
}
