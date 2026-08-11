import { useCallback, useEffect, useRef, useState } from "react";
import type { FillerHit, PauseMark } from "@/interviewer/lib/detection-types";

const FILLERS = [
  "um",
  "uh",
  "like",
  "basically",
  "actually",
  "you know",
  "sort of",
  "kind of",
  "i mean",
  "so yeah",
];

export interface SpeechSample {
  text: string;
  /** True when the recording appears to contain a second speaker. */
  multipleVoices: boolean;
  /** Number of abrupt pitch changes consistent with a speaker change. */
  speakerShifts: number;
  durationSec: number;
  wordsPerMinute: number;
  fillerWords: number;
  pauseCount: number;
  energy: number;
  /** Every filler word actually said, with when (seconds into the answer) it was said. */
  fillerHits: FillerHit[];
  /** Long-silence intervals during the answer, with timestamp + duration. */
  pauseMarks: PauseMark[];
  /** WAV clip of the answer, usable by the audio proctoring function. */
  audioBlob: Blob | null;
}

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((sum, c) => sum + c.length, 0);
  const target = 16000;
  const ratio = sampleRate / target;
  const outLength = Math.floor(length / ratio);
  const flat = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    flat.set(chunk, offset);
    offset += chunk.length;
  }

  const buffer = new ArrayBuffer(44 + outLength * 2);
  const view = new DataView(buffer);
  const writeString = (pos: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(pos + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + outLength * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, target, true);
  view.setUint32(28, target * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, outLength * 2, true);

  for (let i = 0; i < outLength; i++) {
    const sample = flat[Math.floor(i * ratio)] ?? 0;
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Rough fundamental-frequency estimate for one frame via autocorrelation.
 * Returns 0 when the frame is unvoiced (silence, noise, no clear pitch).
 */
function estimatePitch(frame: Float32Array, sampleRate: number): number {
  let energy = 0;
  for (let i = 0; i < frame.length; i++) energy += frame[i] * frame[i];
  const rms = Math.sqrt(energy / frame.length);
  if (rms < 0.02) return 0;

  const minLag = Math.floor(sampleRate / 320);
  const maxLag = Math.floor(sampleRate / 70);
  let bestLag = 0;
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < frame.length; i += 2) sum += frame[i] * frame[i + lag];
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  if (!bestLag || best < energy * 0.25) return 0;
  return sampleRate / bestLag;
}

/**
 * Two speakers in one recording show up as a bimodal pitch distribution plus
 * abrupt jumps between the two registers. Deliberately conservative: a single
 * speaker's natural range should not trip it.
 */
function detectSecondSpeaker(pitches: number[]): {
  multipleVoices: boolean;
  speakerShifts: number;
} {
  const voiced = pitches.filter((p) => p > 0);
  if (voiced.length < 25) return { multipleVoices: false, speakerShifts: 0 };

  const sorted = [...voiced].sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.1)];
  const high = sorted[Math.floor(sorted.length * 0.9)];
  const median = sorted[Math.floor(sorted.length * 0.5)];

  let shifts = 0;
  let previous = 0;
  for (const pitch of pitches) {
    if (!pitch) continue;
    if (previous && Math.abs(pitch - previous) > Math.max(55, previous * 0.4)) shifts += 1;
    previous = pitch;
  }

  const belowShare = voiced.filter((p) => p < median * 0.78).length / voiced.length;
  const aboveShare = voiced.filter((p) => p > median * 1.28).length / voiced.length;
  const bimodal = belowShare > 0.18 && aboveShare > 0.18 && high - low > 90;

  return { multipleVoices: bimodal && shifts >= 4, speakerShifts: shifts };
}

type RecognitionResult = { transcript: string };
type RecognitionAlternatives = { 0: RecognitionResult; length: number; isFinal: boolean };
interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionAlternatives };
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognition(): RecognitionLike | null {
  if (typeof window === "undefined") return null;
  const ctor = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  const Impl = ctor.SpeechRecognition ?? ctor.webkitSpeechRecognition;
  return Impl ? new Impl() : null;
}

export const speechRecognitionSupported = () => {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
};

/**
 * Records the candidate with the Web Audio API to derive voice-delivery
 * metrics (pace, pauses, energy, second-speaker detection) while the browser's
 * own speech recognition transcribes live — no API key, works on any platform
 * with a Chromium/Safari-based browser.
 */
export function useRecorder() {
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const startedAtRef = useRef(0);
  const silenceRef = useRef({ pauses: 0, inSilence: 0, energySum: 0, frames: 0 });
  const pauseMarksRef = useRef<PauseMark[]>([]);
  const silenceStartRef = useRef(0);
  const pitchRef = useRef<number[]>([]);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const finalTextRef = useRef("");
  const interimRef = useRef("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [level, setLevel] = useState(0);
  const [liveText, setLiveText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* already stopped */
      }
    }
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!speechRecognitionSupported()) {
      setError("Voice answers need Chrome, Edge or Safari. You can type your answer instead.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      chunksRef.current = [];
      silenceRef.current = { pauses: 0, inSilence: 0, energySum: 0, frames: 0 };
      pauseMarksRef.current = [];
      silenceStartRef.current = 0;
      pitchRef.current = [];
      startedAtRef.current = Date.now();
      finalTextRef.current = "";
      interimRef.current = "";
      setLiveText("");

      const recognition = getRecognition();
      if (recognition) {
        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (!result) continue;
            const text = result[0]?.transcript ?? "";
            if (result.isFinal) finalTextRef.current += `${text.trim()} `;
            else interim += text;
          }
          interimRef.current = interim;
          setLiveText(`${finalTextRef.current}${interim}`.trim());
        };
        recognition.onerror = (event) => {
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            setError("Microphone access is needed to answer out loud.");
          }
        };
        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch {
          /* already running */
        }
      }

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        setLevel(Math.min(1, rms * 6));
        if (pitchRef.current.length < 1200) {
          pitchRef.current.push(estimatePitch(input, ctx.sampleRate));
        }
        const s = silenceRef.current;
        s.energySum += rms;
        s.frames += 1;
        if (rms < 0.012) {
          if (s.inSilence === 0) silenceStartRef.current = Date.now();
          s.inSilence += 1;
          if (s.inSilence === 8) s.pauses += 1;
        } else {
          // ~1.2s+ of silence is logged as a pause mark for the report timeline.
          if (s.inSilence >= 10) {
            pauseMarksRef.current.push({
              t: Math.round((silenceStartRef.current - startedAtRef.current) / 1000),
              durationSec: Math.round((Date.now() - silenceStartRef.current) / 1000),
            });
          }
          s.inSilence = 0;
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      processorRef.current = processor;
      setRecording(true);
      return true;
    } catch {
      setError("Microphone access is needed to answer out loud.");
      cleanup();
      return false;
    }
  }, [cleanup]);

  const stopAndTranscribe = useCallback(async (): Promise<SpeechSample | null> => {
    if (!recording) return null;
    const sampleRate = ctxRef.current?.sampleRate ?? 48000;
    const stats = silenceRef.current;
    const durationSec = Math.max(0.1, (Date.now() - startedAtRef.current) / 1000);
    const speakers = detectSecondSpeaker(pitchRef.current);
    setRecording(false);
    setTranscribing(true);
    // Give recognition a beat to flush its last final result before teardown.
    await new Promise((resolve) => setTimeout(resolve, 450));
    cleanup();
    setTranscribing(false);

    const clean = `${finalTextRef.current} ${interimRef.current}`.replace(/\s+/g, " ").trim();
    if (!clean) {
      setError("Nothing was picked up — please try again or type your answer.");
      return null;
    }

    const words = clean.split(/\s+/).filter(Boolean);
    const lower = ` ${clean.toLowerCase()} `;
    let fillerWords = 0;
    const fillerHits: FillerHit[] = [];
    // Spread each answer's fillers evenly across its duration — the
    // recognizer gives no per-word timestamps, so this is an even estimate.
    FILLERS.forEach((f) => {
      const hits = lower.split(` ${f} `).length - 1 + (lower.split(`${f},`).length - 1);
      for (let i = 0; i < hits; i++) {
        fillerWords += 1;
        const position = fillerHits.length / Math.max(1, fillerWords + hits);
        fillerHits.push({ t: Math.round(position * durationSec), word: f });
      }
    });
    fillerHits.sort((a, b) => a.t - b.t);

    const audioBlob = chunksRef.current.length ? encodeWav(chunksRef.current, sampleRate) : null;

    return {
      text: clean,
      multipleVoices: speakers.multipleVoices,
      speakerShifts: speakers.speakerShifts,
      durationSec,
      wordsPerMinute: Math.round((words.length / durationSec) * 60),
      fillerWords,
      fillerHits,
      pauseCount: stats.pauses,
      pauseMarks: pauseMarksRef.current,
      energy: Math.round(Math.min(1, (stats.energySum / Math.max(1, stats.frames)) * 12) * 100),
      audioBlob,
    };
  }, [cleanup, recording]);

  const cancel = useCallback(() => {
    setRecording(false);
    cleanup();
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return {
    start,
    stopAndTranscribe,
    cancel,
    recording,
    transcribing,
    level,
    liveText,
    error,
  };
}
