import type { DetectionSummary, StrikeKind } from "./detection-types";

export type InterviewPhase =
  "greeting" | "resume" | "technical" | "coding" | "behavioral" | "hr" | "closing" | "complete";

export const PHASE_LABELS: Record<InterviewPhase, string> = {
  greeting: "Greeting",
  resume: "Resume Discussion",
  technical: "Technical Round",
  coding: "Coding Round",
  behavioral: "Behavioral Round",
  hr: "HR Round",
  closing: "Final Questions",
  complete: "Completed",
};

export const PHASE_ORDER: InterviewPhase[] = [
  "greeting",
  "resume",
  "technical",
  "coding",
  "behavioral",
  "hr",
  "closing",
  "complete",
];

export type QuestionKind = "text" | "mcq" | "coding" | "scenario";
export type CodeLanguage = "java" | "python" | "javascript" | "sql";
export type InterviewerMood = "neutral" | "smile" | "nod" | "thinking" | "curious";

export interface QuestionSpec {
  kind: QuestionKind;
  prompt: string;
  topic: string;
  difficulty: number;
  options: string[];
  language: CodeLanguage | "none";
  starterCode: string;
}

export interface ResumeInsights {
  name: string;
  headline: string;
  skills: string[];
  projects: { title: string; summary: string }[];
  experience: string[];
  education: string[];
  certifications: string[];
  strengths: string[];
  gaps: string[];
  atsScore: number;
}

export type FitVerdict = "weak" | "borderline" | "strong";

export interface ResumeFit {
  companyId: string;
  score: number;
  verdict: FitVerdict;
  statement: string;
  matched: string[];
  missing: string[];
  actions: { title: string; detail: string }[];
  keywords: string[];
}

export const FIT_LABELS: Record<FitVerdict, string> = {
  weak: "Weak fit",
  borderline: "Borderline fit",
  strong: "Strong fit",
};

export interface InterviewConfig {
  companyId: string;
  role: string;
  experience: string;
  candidateName: string;
  resume: ResumeInsights | null;
  resumeFit?: ResumeFit | null;
}

export interface TurnEvaluation {
  score: number;
  verdict: "strong" | "adequate" | "weak";
  note: string;
  matched?: string[];
  missed?: string[];
  verified?: boolean;
}

export interface Turn {
  id: string;
  phase: InterviewPhase;
  say: string;
  mood: InterviewerMood;
  question: QuestionSpec | null;
  /** Id of the verified question-bank entry backing this question, if any. */
  bankId?: string | null;
  answer?: string;
  evaluation?: TurnEvaluation;
  askedAt: number;
}

export interface VisionMetrics {
  eyeContact: number;
  attention: number;
  posture: number;
  blinkRate: number;
  emotionTimeline: { t: number; emotion: string; value: number }[];
  enabled: boolean;
}

export interface VoiceMetrics {
  wordsPerMinute: number;
  fillerWords: number;
  pauseCount: number;
  energy: number;
  fluency: number;
  samples: number;
}

export type DressVerdict = "appropriate" | "acceptable" | "not_appropriate";
export type HairVerdict = "neat" | "untidy";

export interface AppearanceReview {
  assessed: boolean;
  dress: { verdict: DressVerdict; note: string };
  hair: { verdict: HairVerdict; note: string };
  fixes: string[];
  reason: string;
}

export const DRESS_LABELS: Record<DressVerdict, string> = {
  appropriate: "Appropriate",
  acceptable: "Acceptable",
  not_appropriate: "Not appropriate",
};

export const HAIR_LABELS: Record<HairVerdict, string> = {
  neat: "Neat",
  untidy: "Needs tidying",
};

/** How much a detected presentation issue actually costs the candidate. */
export type FlagSeverity = "low" | "medium" | "high";

export const SEVERITY_LABELS: Record<FlagSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const SEVERITY_RANK: Record<FlagSeverity, number> = { high: 3, medium: 2, low: 1 };

export type CoachArea = "posture" | "eye_contact" | "hair" | "grooming" | "framing" | "delivery";

/** One real-time presentation nudge shown during the interview. */
export interface CoachingEvent {
  t: number;
  area: CoachArea;
  instruction: string;
  /** 0-100 detector confidence for this flag. */
  confidence?: number;
  /** What the detector actually saw that triggered the flag. */
  reason?: string;
  /** How urgent the fix is. */
  severity?: FlagSeverity;
}

export const COACH_AREA_LABELS: Record<CoachingEvent["area"], string> = {
  posture: "Posture",
  eye_contact: "Eye contact",
  hair: "Hair",
  grooming: "Grooming",
  framing: "Framing",
  delivery: "Delivery",
};

/** One second-by-second presence reading used by the replay timeline. */
export interface PresenceSample {
  t: number;
  eyeContact: number;
  posture: number;
  attention: number;
}

export type ProctorKind =
  | "multiple_people"
  | "face_missing"
  | "looking_away"
  | "device_visible"
  | "multiple_voices"
  | "background_noise"
  | "unusual_movement"
  | "tab_switch"
  | "warning_issued"
  | "ended_early";

export const PROCTOR_LABELS: Record<ProctorKind, string> = {
  multiple_people: "Another person in frame",
  face_missing: "Face not visible",
  looking_away: "Looking off-screen",
  device_visible: "Phone or second screen visible",
  multiple_voices: "Multiple voices detected",
  background_noise: "Noisy environment",
  unusual_movement: "Unusual movement",
  tab_switch: "Left the interview tab",
  warning_issued: "Formal warning issued",
  ended_early: "Session ended early",
};

/** One integrity flag raised by the proctor during the session. */
export interface ProctorEvent {
  t: number;
  kind: ProctorKind;
  detail: string;
  /** 0-100 detector confidence for this flag. */
  confidence?: number;
  /** How serious the flag is for the recruiter view. */
  severity?: FlagSeverity;
}

export interface RecordingMeta {
  id: string;
  duration: number;
  mimeType: string;
}

export interface InterviewReport {
  overall: number;
  technical: number;
  communication: number;
  coding: number;
  resumeFit: number;
  confidence: number;
  companyReadiness: number;
  hiringProbability: number;
  /** Written-English quality of the spoken answers. */
  grammar: number;
  /** Posture, movement and framing across the session. */
  bodyLanguage: number;
  /** How consistently the candidate held the camera. */
  eyeContact: number;
  /** Tone, dress, environment and courtesy. */
  professionalism: number;
  /** Integrity record: warnings, devices, extra people, noise. */
  behaviour: number;
  /** One plain sentence explaining every sub-score above. */
  subScoreNotes: { area: string; score: number; note: string }[];
  summary: string;
  strongTopics: string[];
  weakTopics: string[];
  skillGaps: string[];
  recommendedCourses: { title: string; why: string }[];
  recommendedQuestions: string[];
  recommendedProblems: string[];
}


/* ------------------------------------------------------------------ */
/* resume correction review + shortlist likelihood                     */
/* ------------------------------------------------------------------ */

export interface ResumeCorrection {
  id: string;
  section: "summary" | "experience" | "skills" | "education" | "projects" | "other";
  original: string;
  corrected: string;
  rationale: string;
}

/** Result of the "Auto-correct my resume" pass: a full rewrite plus discrete reviewable changes. */
export interface ResumeAutoCorrect {
  fullText: string;
  corrections: ResumeCorrection[];
}

export interface LikelihoodSection {
  section: "summary" | "experience" | "skills" | "education" | "projects";
  score: number;
  explanation: string;
  improvements: string[];
}

export interface ShortlistLikelihood {
  overall: number;
  overallExplanation: string;
  sections: LikelihoodSection[];
}

/** The "how to score 100/100" coaching block for one answered question. */
export interface AnswerCoaching {
  idealShape: string;
  mustHit: string[];
  modelAnswer: string;
  whyItLostPoints: string;
}


/* ------------------------------------------------------------------ */
/* replay forensics (post-interview frame + audio-context analysis)    */
/* ------------------------------------------------------------------ */

export type ForensicsKind =
  | "multiple_people"
  | "phone_use"
  | "background_voice"
  | "second_speaker"
  | "grooming"
  | "appearance";

export const FORENSICS_LABELS: Record<ForensicsKind, string> = {
  multiple_people: "Another person (replay)",
  phone_use: "Phone / device use (replay)",
  background_voice: "Background voice or music (replay)",
  second_speaker: "Second speaker (replay)",
  grooming: "Grooming read (replay)",
  appearance: "Appearance read (replay)",
};

/** One timestamped finding from the post-interview replay forensics pass. */
export interface ForensicsFinding {
  t: number;
  kind: ForensicsKind;
  detail: string;
  confidence: number;
  severity: FlagSeverity;
}

/** Cached result of the post-interview Groq pass over sampled replay frames. */
export interface ForensicsReport {
  assessed: boolean;
  findings: ForensicsFinding[];
  /** One overall grooming/appearance read drawn from the sampled frames. */
  groomingSummary: string;
}

export const EMPTY_FORENSICS: ForensicsReport = {
  assessed: false,
  findings: [],
  groomingSummary: "",
};

export interface InterviewSession {
  id: string;
  createdAt: number;
  completedAt?: number;
  config: InterviewConfig;
  turns: Turn[];
  vision: VisionMetrics;
  voice: VoiceMetrics;
  report?: InterviewReport;
  /** Base64 webcam frame kept only until the appearance review is generated. */
  snapshot?: string | null;
  appearance?: AppearanceReview | null;
  /** Real-time presentation nudges surfaced during the session. */
  coaching?: CoachingEvent[];
  /** Per-second presence track backing the replay timeline. */
  presence?: PresenceSample[];
  /** Integrity flags raised by the proctor. */
  proctor?: ProctorEvent[];
  /** On-device detection roll-up: telemetry track plus per-signal totals. */
  detection?: DetectionSummary | null;
  /** True when the session was terminated by the proctor. */
  endedEarly?: boolean;
  /** Pointer to the locally stored webcam recording (IndexedDB). */
  recording?: RecordingMeta | null;
  /** Groq-generated shortlist-likelihood for the resume used in this session. */
  likelihood?: ShortlistLikelihood | null;
  /** "How to score 100/100" coaching per turn id — generated once and cached with the session. */
  answerCoaching?: Record<string, AnswerCoaching> | null;
  /** Post-interview replay forensics pass — cached once generated. */
  forensics?: ForensicsReport | null;
  /** Why the session ended early (two-strike rule), for the report. */
  endReason?: string | null;
  /** Per-kind strike counts across the two-strike rule. */
  strikeLog?: Record<StrikeKind, number> | null;
}

export const EMPTY_VISION: VisionMetrics = {
  eyeContact: 0,
  attention: 0,
  posture: 0,
  blinkRate: 0,
  emotionTimeline: [],
  enabled: false,
};

export const EMPTY_VOICE: VoiceMetrics = {
  wordsPerMinute: 0,
  fillerWords: 0,
  pauseCount: 0,
  energy: 0,
  fluency: 0,
  samples: 0,
};
