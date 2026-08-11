import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

/**
 * Voice selection for Nova: prefer a female British (en-GB) voice, then any
 * British voice, then any English female voice, then the browser default.
 * Which voices exist depends on the browser/OS, so every step has a fallback.
 */

// common female voice names across Chrome, Edge, Safari, Firefox
const FEMALE_NAME =
  /female|sonia|libby|kate|stephanie|serena|martha|susan|hazel|olivia|emily|bella|hollie|sarah|mia|alice|charlotte|lily|victoria|karen|moira|tessa|fiona|martha|zoe/i;

export const NOVA_VOICE_STORAGE_KEY = "nova.voiceURI";

function isBritish(voice: SpeechSynthesisVoice) {
  return voice.lang.replace(/_/g, "-").toLowerCase().startsWith("en-gb");
}

export function isBritishFemaleVoice(voice: SpeechSynthesisVoice): boolean {
  return isBritish(voice) && FEMALE_NAME.test(voice.name);
}

/**
 * Ranks every available voice best-first using the same preference order as
 * `pickNovaVoice`: en-GB female, then any en-GB voice, then any English
 * female voice, then everything else (English before other languages).
 */
export function rankNovaVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const score = (v: SpeechSynthesisVoice) => {
    if (isBritish(v) && FEMALE_NAME.test(v.name)) return 0;
    if (isBritish(v)) return 1;
    if (v.lang.toLowerCase().startsWith("en") && FEMALE_NAME.test(v.name)) return 2;
    if (v.lang.toLowerCase().startsWith("en")) return 3;
    return 4;
  };
  return [...voices].sort((a, b) => score(a) - score(b));
}

export function pickNovaVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  return rankNovaVoices(voices)[0] ?? null;
}

export function loadStoredVoiceURI(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(NOVA_VOICE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveStoredVoiceURI(voiceURI: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOVA_VOICE_STORAGE_KEY, voiceURI);
  } catch {
    // storage may be unavailable (private mode) — voice just won't persist
  }
}

export function voiceLabel(voice: SpeechSynthesisVoice): string {
  return `${voice.name} — ${voice.lang}`;
}

/**
 * React hook that exposes the browser's English voice list (best-ranked
 * first), the voice Nova is actually using right now, and a setter that
 * persists the pick immediately for future speech.
 */
export function useNovaVoice() {
  const voices = useSyncExternalStore(subscribeToVoices, getEnglishVoices, () => EMPTY_VOICES);
  const ranked = useMemo(() => rankNovaVoices(voices), [voices]);
  const [storedURI, setStoredURI] = useState<string | null>(() => loadStoredVoiceURI());

  const preferred = ranked[0] ?? null;
  const active = (storedURI && ranked.find((v) => v.voiceURI === storedURI)) || preferred;

  const setVoice = useCallback((voiceURI: string) => {
    setStoredURI(voiceURI);
    saveStoredVoiceURI(voiceURI);
  }, []);

  return {
    /** every usable English voice, best match first */
    voices: ranked,
    /** the voice Nova speaks with right now (falls back when the stored pick is gone) */
    active,
    /** true when the user's saved pick isn't available on this device/browser */
    fellBack: Boolean(storedURI) && active?.voiceURI !== storedURI,
    setVoice,
  };
}

// useSyncExternalStore compares snapshots by identity, so the array must be
// cached and only replaced when the underlying voice list actually changes.
const EMPTY_VOICES: SpeechSynthesisVoice[] = [];
let cachedVoices: SpeechSynthesisVoice[] = EMPTY_VOICES;
let cachedKey = "";

function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return EMPTY_VOICES;
  const next = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("en"));
  const key = next.map((v) => v.voiceURI).join("|");
  if (key !== cachedKey) {
    cachedKey = key;
    cachedVoices = next;
  }
  return cachedVoices;
}

function subscribeToVoices(onChange: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener("voiceschanged", onChange);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", onChange);
}

/** Speaks text aloud using the given voice (or the browser default). */
export function speakWithVoice(
  text: string,
  voice: SpeechSynthesisVoice | null,
  handlers?: { onEnd?: () => void; onBoundary?: () => void },
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) {
    handlers?.onEnd?.();
    return () => {};
  }
  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  if (handlers?.onEnd) utterance.onend = handlers.onEnd;
  if (handlers?.onBoundary) utterance.onboundary = handlers.onBoundary;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return () => window.speechSynthesis.cancel();
}
