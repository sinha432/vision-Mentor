/**
 * Shared shapes for the on-device detection engine (face, pose, objects, audio).
 * Browser-safe: no MediaPipe imports here, so SSR can read these types freely.
 */

export type GazeDirection = "center" | "left" | "right" | "up" | "down" | "unknown";

/** Live reading of everything the detectors currently see and hear. */
export interface DetectionSignals {
  /** True once the on-device models finished loading. */
  ready: boolean;
  /** Set when the models could not be loaded — heuristics take over. */
  degraded: boolean;
  faces: number;
  faceVisible: boolean;
  /** 0-100: how directly the candidate is looking at the camera. */
  eyeContact: number;
  gaze: GazeDirection;
  blinkRate: number;
  expression: string;
  /** 0-100 posture quality from the pose landmarks. */
  posture: number;
  /** 0-100 how much the candidate is moving around. */
  movement: number;
  /** Phone / laptop / TV style objects currently visible. */
  devices: { label: string; score: number }[];
  /** 0-100 ambient level while the candidate is not speaking. */
  noiseLevel: number;
  /** 0-100 loudness of the candidate's own voice right now. */
  voiceLevel: number;
  speaking: boolean;
  /** Background speech or a second speaker detected. */
  backgroundVoice: boolean;
  /** Long silences during answers. */
  pauses: number;
  longestPause: number;
  /** Speaking pace measured from voiced audio, not transcript length. */
  speechPace: number;
}

export const EMPTY_SIGNALS: DetectionSignals = {
  ready: false,
  degraded: false,
  faces: 0,
  faceVisible: false,
  eyeContact: 0,
  gaze: "unknown",
  blinkRate: 0,
  expression: "neutral",
  posture: 0,
  movement: 0,
  devices: [],
  noiseLevel: 0,
  voiceLevel: 0,
  speaking: false,
  backgroundVoice: false,
  pauses: 0,
  longestPause: 0,
  speechPace: 0,
};

/** One second of session telemetry, used by the report trend graphs. */
export interface DetectionSample {
  t: number;
  eyeContact: number;
  posture: number;
  attention: number;
  confidence: number;
  noise: number;
  voice: number;
  faces: number;
  emotion: string;
}

/** Session-wide roll-up written into the saved session. */
export interface DetectionSummary {
  samples: DetectionSample[];
  avgEyeContact: number;
  avgPosture: number;
  avgConfidence: number;
  avgNoise: number;
  blinkRate: number;
  noisySeconds: number;
  multiFaceSeconds: number;
  faceMissingSeconds: number;
  deviceSeconds: number;
  backgroundVoiceEvents: number;
  pauses: number;
  longestPause: number;
  speechPace: number;
  dominantEmotion: string;
  /** True when the on-device models ran; false when only heuristics were used. */
  onDevice: boolean;
  /** Timestamped long-silence intervals, for the report timeline. */
  pauseMarks?: PauseMark[];
  /** Every filler word actually said, with when it was said. */
  fillerHits?: FillerHit[];
  /** How many separate times more than one face was sustained in frame. */
  multiFaceEvents?: number;
}

export const EMPTY_DETECTION_SUMMARY: DetectionSummary = {
  samples: [],
  avgEyeContact: 0,
  avgPosture: 0,
  avgConfidence: 0,
  avgNoise: 0,
  blinkRate: 0,
  noisySeconds: 0,
  multiFaceSeconds: 0,
  faceMissingSeconds: 0,
  deviceSeconds: 0,
  backgroundVoiceEvents: 0,
  pauses: 0,
  longestPause: 0,
  speechPace: 0,
  dominantEmotion: "neutral",
  onDevice: false,
  pauseMarks: [],
  fillerHits: [],
  multiFaceEvents: 0,
};

export interface PauseMark {
  t: number;
  durationSec: number;
}

export interface FillerHit {
  t: number;
  word: string;
}

/** Objects that should never be in frame during an interview. */
export const BANNED_OBJECTS = new Set([
  "cell phone",
  "mobile phone",
  "laptop",
  "tv",
  "remote",
  "book",
  "tablet",
  "monitor",
  "keyboard",
]);

/** Violation categories tracked by the two-strike proctoring rule. */
export type StrikeKind =
  | "multiple_faces"
  | "phone"
  | "second_voice"
  | "left_frame"
  | "left_tab";

/** Reads a recorded media blob as a bare base64 string (no data: prefix). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
