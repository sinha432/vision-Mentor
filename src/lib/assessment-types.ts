// Shared assessment types. These used to live in a server-only module backed by
// a cloud database; the app now stores assessment data locally in the browser,
// so the types are in a plain, import-anywhere module.

export type QType = "text" | "mcq" | "code";

export type StoredQuestion = {
  id: string;
  type: QType;
  text: string;
  weight: number;
  keywords?: string[];
  maxLength?: number | null;
  choices?: { id: string; text: string }[];
  correctChoiceId?: string;
  starterCode?: string;
  testCases?: { input: string; expectedStdout: string }[];
};

export type CaseResult = { ok: boolean; actual: string; stderr?: string };
export type RunResult = { passed: number; total: number; cases: CaseResult[] };

export type TypedAnswer = {
  type: QType;
  textAnswer?: string;
  choiceId?: string;
  code?: string;
  runResults?: RunResult | null;
};

export type VisionStats = {
  avgEye: number;
  avgPosture: number;
  avgVoice?: number | null;
  samples: number;
  integrity?: { flags: string[]; score: number } | null;
} | null;

export type StoredAssessment = {
  _id: string;
  companyUserId: string;
  title: string;
  code: string;
  status: "active" | "closed";
  requireMedia?: boolean;
  /** Candidate time limit in seconds; older assessments default to 30 minutes. */
  timeLimitSeconds?: number;
  questions: StoredQuestion[];
  createdAt: string;
};

export type StoredAttempt = {
  _id: string;
  assessmentId: string;
  individualUserId: string;
  answers: Record<string, TypedAnswer>;
  vision: VisionStats;
  status: "submitted";
  submittedAt: string;
  terminationReason?: string | null;
  integrityEvents?: { kind: string; detail: string; confidence: number; t: number }[];
};

export type StoredReport = {
  _id: string;
  attemptId: string;
  perQuestionFeedback: {
    questionId: string;
    type: QType;
    weight: number;
    score: number;
    notes: string;
  }[];
  overallScore: number;
  vision: VisionStats;
  createdAt: string;
};

export type UserRole = "individual" | "company";

export type StoredUser = {
  _id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  dob: string | null;
  country: string | null;
  createdAt: string;
};

export function newId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newCode(): string {
  return newId().slice(0, 8).toUpperCase();
}
