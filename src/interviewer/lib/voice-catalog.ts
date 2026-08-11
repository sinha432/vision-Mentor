/**
 * Interviewer TTS voice catalogue: language + gender combinations the app
 * offers, matched at runtime against whatever voices the browser's
 * `speechSynthesis.getVoices()` actually exposes. Browsers vary wildly in
 * which voices ship, so every combination is resolved with a graceful
 * fallback and the picker tells the candidate exactly what it used.
 */

export type VoiceGender = "male" | "female";

export interface VoiceLanguageOption {
  id: string;
  label: string;
  /** BCP-47 prefixes accepted for this language, most specific first. */
  langPrefixes: string[];
}

export const VOICE_LANGUAGES: VoiceLanguageOption[] = [
  { id: "en-GB", label: "English (UK)", langPrefixes: ["en-GB"] },
  { id: "en-US", label: "English (US)", langPrefixes: ["en-US"] },
  { id: "kn-IN", label: "Kannada", langPrefixes: ["kn-IN", "kn"] },
  { id: "hi-IN", label: "Hindi", langPrefixes: ["hi-IN", "hi"] },
  { id: "fr-FR", label: "French", langPrefixes: ["fr-FR", "fr"] },
  { id: "ja-JP", label: "Japanese", langPrefixes: ["ja-JP", "ja"] },
  { id: "zh-CN", label: "Chinese (Mandarin)", langPrefixes: ["zh-CN", "zh"] },
];

export interface VoicePreference {
  language: string; // VoiceLanguageOption.id
  gender: VoiceGender;
}

export const DEFAULT_VOICE_PREFERENCE: VoicePreference = { language: "en-GB", gender: "male" };

const STORAGE_KEY = "vmx.voice-preference.v1";

export function loadVoicePreference(): VoicePreference {
  if (typeof window === "undefined") return DEFAULT_VOICE_PREFERENCE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_PREFERENCE;
    const parsed = JSON.parse(raw) as Partial<VoicePreference>;
    if (!parsed.language || !parsed.gender) return DEFAULT_VOICE_PREFERENCE;
    return { language: parsed.language, gender: parsed.gender };
  } catch {
    return DEFAULT_VOICE_PREFERENCE;
  }
}

export function saveVoicePreference(pref: VoicePreference) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  } catch {
    /* storage full — the in-memory preference still applies this session */
  }
}

/** Heuristic gender guess from common voice-name conventions. */
const FEMALE_HINTS = [
  "female", "woman", "girl", "samantha", "victoria", "susan", "karen", "moira", "tessa",
  "aria", "zira", "hazel", "salli", "joanna", "kyoko", "sakura", "ting", "yui", "lekha",
  "veena", "kalpana", "amelie", "audrey", "denise", "celine", "chiara",
];
const MALE_HINTS = [
  "male", "man", "daniel", "george", "guy", "david", "james", "fred", "alex", "ryan",
  "arthur", "oliver", "thomas", "rishi", "ravi", "hemant", "sangeeta", // sangeeta wrongly here removed below
];

function guessGender(voice: SpeechSynthesisVoice): VoiceGender | null {
  const name = voice.name.toLowerCase();
  if (FEMALE_HINTS.some((h) => name.includes(h))) return "female";
  if (MALE_HINTS.some((h) => name.includes(h))) return "male";
  return null;
}

export interface ResolvedVoice {
  voice: SpeechSynthesisVoice | null;
  /** True when no voice matched both language and gender exactly. */
  isFallback: boolean;
  fallbackReason: string | null;
}

/** Picks the closest available voice for a language + gender preference. */
export function resolveVoice(
  voices: SpeechSynthesisVoice[],
  pref: VoicePreference,
): ResolvedVoice {
  const lang = VOICE_LANGUAGES.find((l) => l.id === pref.language) ?? VOICE_LANGUAGES[0];
  const forLang = voices.filter((v) =>
    lang.langPrefixes.some((p) => v.lang.toLowerCase().startsWith(p.toLowerCase())),
  );

  if (forLang.length) {
    const exact = forLang.find((v) => guessGender(v) === pref.gender);
    if (exact) return { voice: exact, isFallback: false, fallbackReason: null };
    // Language matched, gender guess failed — use the first voice for the language.
    return {
      voice: forLang[0],
      isFallback: true,
      fallbackReason: `No confirmed ${pref.gender} voice for ${lang.label}; using ${forLang[0].name}.`,
    };
  }

  // No voice at all for the language — fall back to any English voice, else the first voice.
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const englishGendered = english.find((v) => guessGender(v) === pref.gender);
  const fallback = englishGendered ?? english[0] ?? voices[0] ?? null;
  return {
    voice: fallback,
    isFallback: true,
    fallbackReason: fallback
      ? `${lang.label} is not available on this browser; using ${fallback.name} instead.`
      : "No speech voices are available on this browser.",
  };
}

export interface VoiceAvailability {
  language: VoiceLanguageOption;
  gender: VoiceGender;
  available: boolean;
  resolved: ResolvedVoice;
}

/** Every language × gender combination with its resolved / fallback voice. */
export function listVoiceAvailability(voices: SpeechSynthesisVoice[]): VoiceAvailability[] {
  const out: VoiceAvailability[] = [];
  for (const language of VOICE_LANGUAGES) {
    for (const gender of ["male", "female"] as VoiceGender[]) {
      const resolved = resolveVoice(voices, { language: language.id, gender });
      const forLang = voices.filter((v) =>
        language.langPrefixes.some((p) => v.lang.toLowerCase().startsWith(p.toLowerCase())),
      );
      const available = forLang.some((v) => guessGender(v) === gender);
      out.push({ language, gender, available, resolved });
    }
  }
  return out;
}
