import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runStructured, keyFor, getSpec } from "@/interviewer/lib/ai-providers.server";

/**
 * Live proctoring checks, powered by Groq. Both checks are deliberately
 * throttled from the client (roughly one webcam frame per ~10s, one audio
 * chunk per answer) and both fail soft — a missing key, a network blip or a
 * malformed reply never interrupts the interview, they just report nothing.
 */

const visionSchema = z.object({
  phoneVisible: z.boolean(),
  phoneConfidence: z.number().min(0).max(100),
  attire: z.string(),
  grooming: z.string(),
  backgroundTidy: z.boolean(),
  notes: z.string(),
});

export type ProctoringVisionResult = z.infer<typeof visionSchema>;

const FALLBACK_VISION: ProctoringVisionResult = {
  phoneVisible: false,
  phoneConfidence: 0,
  attire: "",
  grooming: "",
  backgroundTidy: true,
  notes: "",
};

/** One webcam frame → phone-near-face check plus a quick attire/grooming read. */
export const analyzeProctoringFrame = createServerFn({ method: "POST" })
  .validator((data: { dataUrl: string }) => data)
  .handler(async ({ data }): Promise<ProctoringVisionResult> => {
    try {
      const { value } = await runStructured({
        schema: visionSchema,
        system:
          "You are a strict but fair live-interview proctor looking at ONE webcam frame of a candidate. " +
          "Decide whether the candidate is holding or looking at a mobile phone near their face or hands. " +
          "Also give a one-line, kind read of their attire, grooming, and whether the background behind them " +
          "looks tidy and professional. If the frame is unclear, say so in notes and keep phoneVisible false.",
        prompt: "Review this webcam frame from a live interview.",
        images: [data.dataUrl],
        vision: true,
        fallback: FALLBACK_VISION,
      });
      return value;
    } catch {
      return FALLBACK_VISION;
    }
  });

const audioSchema = z.object({
  musicOrTv: z.boolean(),
  secondSpeaker: z.boolean(),
  confidence: z.number().min(0).max(100),
  notes: z.string(),
});

export type ProctoringAudioResult = z.infer<typeof audioSchema>;

const FALLBACK_AUDIO: ProctoringAudioResult = {
  musicOrTv: false,
  secondSpeaker: false,
  confidence: 0,
  notes: "",
};

/**
 * Transcribes a short recorded answer with Groq Whisper, then asks the text
 * model whether the transcript reads like background music/TV or a second
 * speaker rather than one candidate answering an interview question.
 */
export const analyzeProctoringAudio = createServerFn({ method: "POST" })
  .validator((data: { audioBase64: string; mimeType: string }) => data)
  .handler(async ({ data }): Promise<ProctoringAudioResult> => {
    try {
      const spec = getSpec("groq");
      const apiKey = keyFor(spec);
      if (!apiKey) return FALLBACK_AUDIO;

      const bytes = Buffer.from(data.audioBase64, "base64");
      if (!bytes.length) return FALLBACK_AUDIO;

      const form = new FormData();
      const ext = data.mimeType.includes("wav") ? "wav" : "webm";
      form.append("file", new Blob([bytes], { type: data.mimeType }), `chunk.${ext}`);
      form.append("model", "whisper-large-v3-turbo");
      form.append("response_format", "verbose_json");

      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!res.ok) return FALLBACK_AUDIO;
      const transcription = (await res.json()) as { text?: string; segments?: { text: string; no_speech_prob?: number }[] };
      const text = (transcription.text ?? "").trim();
      const segments = transcription.segments ?? [];
      const avgNoSpeech = segments.length
        ? segments.reduce((sum, s) => sum + (s.no_speech_prob ?? 0), 0) / segments.length
        : 0;

      // Cheap heuristics first — no need to burn a second call for the common case.
      const looksLikeMusic = /\[music\]|\bla la la\b|♪/i.test(text);
      if (!text || (avgNoSpeech > 0.6 && !looksLikeMusic)) return FALLBACK_AUDIO;

      const { value } = await runStructured({
        schema: audioSchema,
        system:
          "You review a transcript of one candidate's answer during a live interview. Decide whether the audio " +
          "more likely contains background music/TV (repetitive lyrics, jingles, broadcast phrasing, [Music] markers) " +
          "or a second speaker answering alongside the candidate (a dialogue, someone else's voice interjecting). " +
          "A single person speaking naturally, even with pauses or filler words, is normal and should not be flagged.",
        prompt: `Transcript:\n"""${text}"""\n\nAverage non-speech probability across segments: ${avgNoSpeech.toFixed(2)}.`,
        fallback: looksLikeMusic
          ? { musicOrTv: true, secondSpeaker: false, confidence: 70, notes: "Transcript reads like a music/TV cue." }
          : FALLBACK_AUDIO,
      });
      return value;
    } catch {
      return FALLBACK_AUDIO;
    }
  });
