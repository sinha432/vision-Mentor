import { useCallback, useMemo, useSyncExternalStore } from "react";

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

let selectedVoiceURI: string | null | undefined;
const voiceSelectionListeners = new Set<() => void>();

function getSelectedVoiceURI(): string | null {
  if (selectedVoiceURI === undefined) selectedVoiceURI = loadStoredVoiceURI();
  return selectedVoiceURI;
}

function subscribeToVoiceSelection(onChange: () => void) {
  voiceSelectionListeners.add(onChange);
  return () => voiceSelectionListeners.delete(onChange);
}

export function voiceLabel(voice: SpeechSynthesisVoice): string {
  return `${voice.name} — ${voice.lang}`;
}

/** Convert assistant output into natural words for browser speech. */
export function toSpeechText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/gi, " ")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/(?:^|\s)(?:[-*+]\s+|\d+[.)]\s+)/gm, " ")
    .replace(/[*_`~]/g, "")
    .replace(/&/g, " and ")
    .replace(/@/g, " at ")
    .replace(/[\u{1F000}-\u{1FAFF}\u{200D}\u{FE0F}]/gu, "")
    .replace(/[^\p{L}\p{N}\s.,?!:'();]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Backward-compatible name for callers that need speech-only text. */
export const speechText = toSpeechText;

/**
 * React hook that exposes the browser's English voice list (best-ranked
 * first), the voice Nova is actually using right now, and a setter that
 * persists the pick immediately for future speech.
 */
export function useNovaVoice() {
  const voices = useSyncExternalStore(subscribeToVoices, getEnglishVoices, () => EMPTY_VOICES);
  const ranked = useMemo(() => rankNovaVoices(voices), [voices]);
  const storedURI = useSyncExternalStore(
    subscribeToVoiceSelection,
    getSelectedVoiceURI,
    () => null,
  );

  const preferred = ranked[0] ?? null;
  const active = (storedURI && ranked.find((v) => v.voiceURI === storedURI)) || preferred;

  const setVoice = useCallback((voiceURI: string) => {
    selectedVoiceURI = voiceURI;
    saveStoredVoiceURI(voiceURI);
    voiceSelectionListeners.forEach((listener) => listener());
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
  handlers?: {
    onStart?: () => void;
    onEnd?: () => void;
    onBoundary?: (progress?: number) => void;
  },
) {
  const spokenText = toSpeechText(text);

  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    !spokenText
  ) {
    handlers?.onEnd?.();
    return () => {};
  }

  const synth = window.speechSynthesis;
  let cancelled = false;
  let fallbackInterval: number | null = null;
  let startedAt = 0;
  const speechRate = 1.02;
  const estimatedMs = Math.max(600, (spokenText.split(/\s+/).length / (165 * speechRate)) * 60_000);

  // Stop previous speech immediately.
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(spokenText);

  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }

  // Natural and responsive speech.
  utterance.rate = speechRate;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const clearFallback = () => {
    if (fallbackInterval !== null) {
      window.clearInterval(fallbackInterval);
      fallbackInterval = null;
    }
  };

  utterance.onstart = () => {
    if (!cancelled) {
      startedAt = performance.now();
      handlers?.onStart?.();
      if (handlers?.onBoundary) {
        // Some browsers fire boundary events inconsistently. Keep the mouth in
        // sync with a gentle fallback cadence so the avatar still opens/closes
        // while speech is active.
        clearFallback();
        fallbackInterval = window.setInterval(() => {
          if (!cancelled) {
            handlers.onBoundary?.(Math.min(1, (performance.now() - startedAt) / estimatedMs));
          }
        }, 220);
      }
    }
  };

  utterance.onboundary = (event) => {
    if (!cancelled) {
      handlers?.onBoundary?.(Math.min(1, (event.charIndex || 0) / Math.max(1, spokenText.length)));
    }
  };

  utterance.onend = () => {
    if (!cancelled) {
      clearFallback();
      handlers?.onEnd?.();
    }
  };

  utterance.onerror = (event) => {
    if (
      !cancelled &&
      event.error !== "canceled" &&
      event.error !== "interrupted"
    ) {
      clearFallback();
      handlers?.onEnd?.();
    }
  };

  synth.speak(utterance);

  return () => {
    cancelled = true;
    clearFallback();
    synth.cancel();
  };
}