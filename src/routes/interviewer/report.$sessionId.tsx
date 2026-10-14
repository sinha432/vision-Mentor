import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Code2,
  Download,
  Loader2,
  MessageSquare,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/interviewer/components/vmx/SiteHeader";
import { ResumeFitCard } from "@/interviewer/components/vmx/ResumeFitCard";
import { ReplayTimeline } from "@/interviewer/components/vmx/ReplayTimeline";
import { AppearanceGroomingPanel } from "@/interviewer/components/vmx/AppearanceGroomingPanel";
import { ScoreBar, ScoreRing } from "@/interviewer/components/vmx/ScoreRing";
import { Button } from "@/components/ui/button";
import { getCompany } from "@/interviewer/lib/companies";
import {
  analyzeAppearanceFrames,
  analyzeReplayForensics,
  buildAnswerCoaching,
  buildInterviewReport,
} from "@/interviewer/lib/interview.functions";
import {
  type AnswerCoaching,
  type AppearanceAnalysisStatus,
  type AppearanceAssessmentStatus,
  type AppearanceReview,
  type CoachingEvent,
  type ForensicsFinding,
  type ForensicsKind,
  type ForensicsReport,
  type InterviewReport,
  type InterviewSession,
  PROCTOR_LABELS,
} from "@/interviewer/lib/interview-types";
import { getRecording } from "@/interviewer/lib/recording-store";
import { getSession, saveSession, SESSION_UPDATED_EVENT } from "@/interviewer/lib/session-store";

export const Route = createFileRoute("/interviewer/report/$sessionId")({
  head: () => ({
    meta: [
      { title: "Interview performance report — Vision Mentor X" },
      {
        name: "description",
        content:
          "Recruiter-grade scoring across technical depth, coding, communication and confidence, with skill gaps and a practice plan.",
      },
      { property: "og:title", content: "Interview performance report — Vision Mentor X" },
      {
        property: "og:description",
        content: "See your hiring probability, weak topics and recommended practice plan.",
      },
    ],
  }),
  component: ReportPage,
});

const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** The report comes from a model — never trust its shape in the render tree. */
function normalizeReport(raw: unknown): InterviewReport {
  const r = (raw ?? {}) as Partial<InterviewReport>;
  const cameraAreas = new Set(["eye contact", "body language", "posture", "attention"]);
  return {
    overall: num(r.overall),
    technical: num(r.technical),
    communication: num(r.communication),
    coding: num(r.coding),
    resumeFit: num(r.resumeFit),
    confidence: num(r.confidence),
    companyReadiness: num(r.companyReadiness),
    hiringProbability: num(r.hiringProbability),
    grammar: num(r.grammar),
    bodyLanguage: num(r.bodyLanguage),
    eyeContact: num(r.eyeContact),
    professionalism: num(r.professionalism),
    behaviour: num(r.behaviour),
    subScoreNotes: Array.isArray(r.subScoreNotes)
      ? r.subScoreNotes
          .filter((n) => n && typeof n.area === "string" && !cameraAreas.has(n.area.toLowerCase()))
          .map((n) => ({
            area: n.area,
            score: num(n.score),
            note: typeof n.note === "string" ? n.note : "",
          }))
      : [],
    summary:
      typeof r.summary === "string" ? r.summary : "No summary was generated for this session.",
    strongTopics: list(r.strongTopics),
    weakTopics: list(r.weakTopics),
    skillGaps: list(r.skillGaps),
    recommendedCourses: Array.isArray(r.recommendedCourses)
      ? r.recommendedCourses
          .filter((c) => c && typeof c.title === "string")
          .map((c) => ({ title: c.title, why: typeof c.why === "string" ? c.why : "" }))
      : [],
    recommendedQuestions: list(r.recommendedQuestions),
    recommendedProblems: list(r.recommendedProblems),
  };
}

function buildReportFallback(session: InterviewSession): InterviewReport {
  const graded = session.turns.filter((turn) => turn.question && turn.evaluation);
  const scores = graded.map((turn) => turn.evaluation!.score);
  const average = scores.length
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : 0;
  const codingScores = graded
    .filter((turn) => turn.question?.kind === "coding")
    .map((turn) => turn.evaluation!.score);
  const coding = codingScores.length
    ? Math.round(codingScores.reduce((sum, score) => sum + score, 0) / codingScores.length)
    : 0;
  const cameraMeasured = session.detection?.onDevice ?? session.vision.enabled;
  const eyeContact = session.detection?.onDevice
    ? session.detection.avgEyeContact
    : session.vision.eyeContact;
  const bodyLanguage = session.detection?.onDevice
    ? session.detection.avgPosture
    : session.vision.posture;
  const topics = [...new Set(graded.map((turn) => turn.question?.topic ?? "").filter(Boolean))];
  const weakTopics = [
    ...new Set(
      graded
        .filter((turn) => (turn.evaluation?.score ?? 0) < 70)
        .map((turn) => turn.question?.topic ?? "")
        .filter(Boolean),
    ),
  ];
  const practiceTopics = weakTopics.length ? weakTopics : topics;
  const integrityPenalty = Math.min(40, (session.proctor?.length ?? 0) * 5);

  return {
    overall: average,
    technical: average,
    communication: session.voice.samples > 0 ? session.voice.fluency : 0,
    coding,
    resumeFit: session.config.resumeFit?.score ?? 0,
    confidence: cameraMeasured
      ? Math.round((eyeContact + session.vision.attention) / 2)
      : session.voice.samples > 0
        ? session.voice.fluency
        : 0,
    companyReadiness: average,
    hiringProbability: graded.length ? Math.max(0, average - 10) : 0,
    grammar: Math.max(0, 100 - session.voice.fillerWords * 3),
    bodyLanguage: cameraMeasured ? bodyLanguage : 0,
    eyeContact: cameraMeasured ? eyeContact : 0,
    professionalism: session.voice.samples > 0 ? session.voice.fluency : average,
    behaviour: Math.max(0, 100 - integrityPenalty),
    subScoreNotes: [],
    summary: graded.length
      ? `The full AI evaluation was unavailable. These provisional scores use the ${graded.length} recorded answer grades and captured session measurements.`
      : "The full AI evaluation was unavailable and no answers were graded. Complete another interview to generate a scored report.",
    strongTopics: graded
      .filter((turn) => (turn.evaluation?.score ?? 0) >= 71)
      .map((turn) => turn.question?.topic ?? "")
      .filter(Boolean),
    weakTopics,
    skillGaps: weakTopics,
    recommendedCourses: practiceTopics.slice(0, 4).map((topic) => ({
      title: `${topic} review`,
      why: `Revisit ${topic} using the recorded answer feedback before your next interview.`,
    })),
    recommendedQuestions: graded
      .filter((turn) => (turn.evaluation?.score ?? 0) < 70)
      .slice(0, 4)
      .map(
        (turn) =>
          `Practice again: ${turn.question?.prompt ?? turn.question?.topic ?? "this answer"}`,
      ),
    recommendedProblems: graded
      .filter((turn) => turn.question?.kind === "coding" && (turn.evaluation?.score ?? 0) < 70)
      .slice(0, 4)
      .map((turn) => `Retry the ${turn.question?.topic ?? "coding"} problem from this interview.`),
  };
}

/** Cached forensics reports are user-controlled localStorage — never trust their shape either. */
function normalizeForensics(raw: unknown): ForensicsReport {
  const f = (raw ?? {}) as Partial<ForensicsReport>;
  const kinds: ForensicsKind[] = [
    "multiple_people",
    "phone_use",
    "background_voice",
    "second_speaker",
    "grooming",
    "appearance",
  ];
  const severities = ["low", "medium", "high"] as const;
  const statuses: AppearanceAssessmentStatus[] = [
    "positive",
    "needs_attention",
    "uncertain",
    "not_visible",
  ];
  const normalizeAssessment = (value: unknown) => {
    const assessment = (value ?? {}) as Partial<AppearanceReview["grooming"]>;
    return {
      status: statuses.includes(assessment.status as AppearanceAssessmentStatus)
        ? (assessment.status as AppearanceAssessmentStatus)
        : "not_visible",
      confidence: num(assessment.confidence),
      evidence: typeof assessment.evidence === "string" ? assessment.evidence : "",
      recommendation:
        typeof assessment.recommendation === "string" ? assessment.recommendation : "",
      t: typeof assessment.t === "number" && Number.isFinite(assessment.t) ? assessment.t : null,
    };
  };
  const appearance = (f as Partial<ForensicsReport>).appearance;
  return {
    assessed: f.assessed === true,
    groomingSummary: typeof f.groomingSummary === "string" ? f.groomingSummary : "",
    findings: Array.isArray(f.findings)
      ? f.findings
          .filter((x): x is ForensicsFinding => !!x && kinds.includes((x as ForensicsFinding).kind))
          .map((x) => ({
            t: typeof x.t === "number" && Number.isFinite(x.t) ? x.t : 0,
            kind: x.kind,
            detail: typeof x.detail === "string" ? x.detail : "",
            confidence: typeof x.confidence === "number" ? x.confidence : 0,
            severity: severities.includes(x.severity) ? x.severity : "low",
          }))
      : [],
    appearance:
      appearance && typeof appearance === "object"
        ? {
            assessed: appearance.assessed === true,
            grooming: normalizeAssessment(appearance.grooming),
            hair: normalizeAssessment(appearance.hair),
            attire: normalizeAssessment(appearance.attire),
          }
        : undefined,
  };
}

async function captureSavedAppearanceFrames(session: InterviewSession) {
  if (session.recording?.id) {
    const blob = await getRecording(session.recording.id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      try {
        const video = document.createElement("video");
        video.muted = true;
        video.preload = "auto";
        const metadata = new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(
            () => reject(new Error("Timed out opening the saved camera recording.")),
            8000,
          );
          video.onloadedmetadata = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          video.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error("The saved camera recording could not be opened."));
          };
        });
        video.src = url;
        video.load();
        await metadata;

        const duration = video.duration || session.recording.duration;
        const timestamps = duration > 1 ? [duration * 0.2, duration * 0.5, duration * 0.8] : [0];
        const width = Math.min(1280, video.videoWidth || 1280);
        const height = Math.max(
          360,
          Math.round((width * (video.videoHeight || 720)) / (video.videoWidth || 1280)),
        );
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not prepare a canvas for the saved camera frames.");

        const frames: { t: number; dataUrl: string }[] = [];
        for (const timestamp of timestamps) {
          const t = Math.min(timestamp, Math.max(0, duration - 0.1));
          if (Math.abs(video.currentTime - t) > 0.02) {
            try {
              await new Promise<void>((resolve, reject) => {
                const timeout = window.setTimeout(() => {
                  video.removeEventListener("seeked", onSeeked);
                  reject(new Error("Timed out reading a frame from the saved camera recording."));
                }, 5000);
                const onSeeked = () => {
                  window.clearTimeout(timeout);
                  resolve();
                };
                video.addEventListener("seeked", onSeeked, { once: true });
                video.currentTime = t;
              });
            } catch {
              continue;
            }
          }
          if (Math.abs(video.currentTime - t) > 0.05) continue;
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            context.drawImage(video, 0, 0, width, height);
            frames.push({ t, dataUrl: canvas.toDataURL("image/jpeg", 0.9) });
          }
        }
        if (frames.length) return frames;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  }

  if (session.snapshot?.startsWith("data:image/")) return [{ t: 0, dataUrl: session.snapshot }];
  throw new Error("No saved camera frames are available for appearance review.");
}

function voiceCaptured(session: InterviewSession | null): boolean {
  return (
    !!session &&
    (session.voice.status === "captured" ||
      (session.voice.status == null && session.voice.samples > 0)) &&
    session.voice.samples > 0
  );
}

function voiceStatusLabel(session: InterviewSession | null): string {
  if (session && session.voice.status == null && session.voice.samples > 0) return "Voice captured";
  switch (session?.voice.status) {
    case "app_disabled":
      return "Voice disabled in settings";
    case "permission_denied":
      return "Microphone permission denied";
    case "unavailable":
      return "Microphone unavailable";
    case "unsupported":
      return "Voice input unsupported";
    case "no_speech":
      return "Voice not detected";
    case "captured":
      return "Voice captured";
    default:
      return "Voice not captured";
  }
}

const appearanceStatusLabels: Record<AppearanceAssessmentStatus, string> = {
  positive: "Suitable",
  needs_attention: "Needs attention",
  uncertain: "Uncertain",
  not_visible: "Not visible",
};

function LiveSessionReport({ session }: { session: InterviewSession }) {
  const answered = session.turns.filter((turn) => Boolean(turn.answer)).length;
  const evaluations = session.turns.flatMap((turn) =>
    turn.evaluation ? [turn.evaluation.score] : [],
  );
  const averageScore = evaluations.length
    ? Math.round(evaluations.reduce((sum, score) => sum + score, 0) / evaluations.length)
    : null;
  const samples = session.detection?.samples ?? [];
  const latest = samples.length ? samples[samples.length - 1] : null;
  const coaching = (session.coaching ?? []).slice(-4).reverse();
  const events = (session.proctor ?? []).slice(-4).reverse();
  const presentation = session.liveAppearance
    ? [
        { label: "Formal attire", assessment: session.liveAppearance.attire },
        { label: "Hair", assessment: session.liveAppearance.hair },
        { label: "Beard & grooming", assessment: session.liveAppearance.grooming },
      ].map(
        ({ label, assessment }) =>
          `${label}: ${appearanceStatusLabels[assessment.status]} (${assessment.confidence}% confidence)${assessment.evidence ? ` — ${assessment.evidence}` : ""}`,
      )
    : (session.coaching ?? [])
        .filter(
          (event) => event.area === "hair" || event.area === "grooming" || event.area === "attire",
        )
        .slice(-3)
        .reverse()
        .map((event) => `${event.area}: ${event.instruction}`);

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-2xl glass p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Live performance report</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Updates as interview answers and camera/microphone observations are saved.
            </p>
          </div>
          <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
            IN PROGRESS
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Answers captured" value={String(answered)} />
          <Stat
            label="Average answer score"
            value={averageScore == null ? "Not yet scored" : `${averageScore}/100`}
          />
          <Stat label="Eye contact" value={latest ? `${latest.eyeContact}%` : "Not available"} />
          <Stat label="Posture" value={latest ? `${latest.posture}%` : "Not available"} />
          <Stat
            label="Speaking pace"
            value={voiceCaptured(session) ? `${session.voice.wordsPerMinute} wpm` : "Not captured"}
          />
          <Stat
            label="Filler words"
            value={voiceCaptured(session) ? String(session.voice.fillerWords) : "Not captured"}
          />
          <Stat label="Integrity events" value={String(events.length)} />
          <Stat label="Camera samples" value={String(samples.length)} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <LiveEventList
          title="Recent coaching"
          empty="No coaching corrections recorded yet."
          items={coaching.map((item) => `${item.area.replaceAll("_", " ")}: ${item.instruction}`)}
        />
        <LiveEventList
          title="Integrity checks"
          empty="No integrity events recorded so far."
          items={events.map((item) => `${PROCTOR_LABELS[item.kind]}: ${item.detail}`)}
        />
        <LiveEventList
          title="Attire, hair & grooming"
          empty="No live appearance assessment yet. Enable AI camera review in the interview to assess attire, hair and beard grooming."
          items={presentation}
        />
      </section>
    </div>
  );
}

function LiveEventList({ title, empty, items }: { title: string; empty: string; items: string[] }) {
  return (
    <section className="rounded-2xl glass p-6">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="rounded-lg bg-secondary/35 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function ReportPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [coaching, setCoaching] = useState<Record<string, AnswerCoaching>>({});
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [forensics, setForensics] = useState<ForensicsReport | null>(null);
  const [forensicsLoading, setForensicsLoading] = useState(false);
  const [replayAppearance, setReplayAppearance] = useState<AppearanceReview | null>(null);
  const [replayAppearanceStatus, setReplayAppearanceStatus] =
    useState<AppearanceAnalysisStatus>("pending");
  const [replayAppearanceError, setReplayAppearanceError] = useState<string | null>(null);
  const [appearanceLoading, setAppearanceLoading] = useState(false);
  const [appearanceRetry, setAppearanceRetry] = useState(0);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [reportRetry, setReportRetry] = useState(0);
  const reportBuildStartedRef = useRef(false);

  useEffect(() => {
    const refresh = () => {
      const latest = getSession(sessionId);
      if (!latest) return;
      setSession(latest);
      setSessionRevision((revision) => revision + 1);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "vmx.sessions.v1") refresh();
    };
    window.addEventListener(SESSION_UPDATED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SESSION_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [sessionId]);

  useEffect(() => {
    const stored = getSession(sessionId);
    if (!stored) {
      setLoading(false);
      return;
    }
    setSession(stored);
    if (!stored.completedAt) {
      setLoading(false);
      return;
    }
    if (stored.report) {
      setReport(normalizeReport(stored.report));
      setReportError(null);
      setLoading(false);
      return;
    }
    if (reportBuildStartedRef.current) return;
    reportBuildStartedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const generated = await buildInterviewReport({
          data: {
            config: stored.config,
            turns: stored.turns.map((t) => ({
              id: t.id,
              phase: t.phase,
              say: t.say,
              mood: t.mood,
              question: t.question,
              bankId: t.bankId ?? null,
              answer: t.answer,
              evaluation: t.evaluation,
              askedAt: t.askedAt,
            })),
            vision: {
              eyeContact: stored.vision.eyeContact,
              attention: stored.vision.attention,
              posture: stored.vision.posture,
              enabled: stored.vision.enabled,
            },
            voice: {
              status: stored.voice.status,
              samples: stored.voice.samples,
              wordsPerMinute: stored.voice.wordsPerMinute,
              fillerWords: stored.voice.fillerWords,
              pauseCount: stored.voice.pauseCount,
              fluency: stored.voice.fluency,
            },
            behaviour: {
              detection: stored.detection
                ? {
                    avgEyeContact: stored.detection.avgEyeContact,
                    avgPosture: stored.detection.avgPosture,
                    avgConfidence: stored.detection.avgConfidence,
                    avgNoise: stored.detection.avgNoise,
                    noisySeconds: stored.detection.noisySeconds,
                    multiFaceSeconds: stored.detection.multiFaceSeconds,
                    faceMissingSeconds: stored.detection.faceMissingSeconds,
                    handGestureSeconds: stored.detection.handGestureSeconds ?? 0,
                    handGestureEvents: stored.detection.handGestureEvents ?? 0,
                    deviceSeconds: stored.detection.deviceSeconds,
                    backgroundVoiceEvents: stored.detection.backgroundVoiceEvents,
                    dominantEmotion: stored.detection.dominantEmotion,
                    onDevice: stored.detection.onDevice,
                  }
                : null,
              proctor: (stored.proctor ?? []).map((p) => ({
                kind: p.kind,
                detail: p.detail,
                severity: p.severity,
              })),
              warnings: (stored.proctor ?? []).filter((p) => p.kind === "warning_issued").length,
              endedEarly: stored.endedEarly === true,
            },
          },
        });
        if (cancelled) return;
        const full = normalizeReport(generated);
        setReport(full);
        setReportError(null);
        const latest = getSession(sessionId) ?? stored;
        saveSession({ ...latest, report: full, completedAt: latest.completedAt ?? Date.now() });
      } catch (error) {
        if (!cancelled) {
          setReportError(error instanceof Error ? error.message : "Could not build the report");
          setReport(buildReportFallback(stored));
          toast.error(error instanceof Error ? error.message : "Could not build the report");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      reportBuildStartedRef.current = false;
    };
  }, [sessionId, reportRetry]);

  // "How to score 100/100" coaching per question — generated once, cached with the session.
  useEffect(() => {
    const stored = getSession(sessionId);
    if (!stored) return;
    if (!stored.completedAt) return;
    if (stored.answerCoaching && Object.keys(stored.answerCoaching).length) {
      setCoaching(stored.answerCoaching);
      return;
    }
    const graded = stored.turns.filter((t) => t.question && t.answer);
    if (graded.length === 0) return;
    let cancelled = false;
    setCoachingLoading(true);
    buildAnswerCoaching({
      data: {
        config: stored.config,
        turns: stored.turns.map((t) => ({
          id: t.id,
          phase: t.phase,
          say: t.say,
          mood: t.mood,
          question: t.question,
          bankId: t.bankId ?? null,
          answer: t.answer,
          evaluation: t.evaluation,
          askedAt: t.askedAt,
        })),
      },
    })
      .then((result) => {
        if (cancelled) return;
        const byId: Record<string, AnswerCoaching> = {};
        for (const item of result as {
          turnId: string;
          idealShape: string;
          mustHit: string[];
          modelAnswer: string;
          whyItLostPoints: string;
        }[]) {
          byId[item.turnId] = {
            idealShape: item.idealShape,
            mustHit: item.mustHit,
            modelAnswer: item.modelAnswer,
            whyItLostPoints: item.whyItLostPoints,
          };
        }
        setCoaching(byId);
        const latest = getSession(sessionId) ?? stored;
        saveSession({ ...latest, answerCoaching: byId });
      })
      .catch(() => {
        /* coaching is a bonus panel — never block the report */
      })
      .finally(() => {
        if (!cancelled) setCoachingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, sessionRevision]);

  // Post-interview replay forensics: sample frames around proctor flags plus
  // an even spread, then ask Groq to confirm/refine integrity events and give
  // one grooming read — cached with the session once generated.
  useEffect(() => {
    const stored = getSession(sessionId);
    if (!stored) return;
    if (!stored.completedAt) return;
    if (stored.forensics) {
      setForensics(normalizeForensics(stored.forensics));
      return;
    }
    if (stored.cloudMediaAnalysisConsent !== true && stored.appearanceReviewConsent !== true)
      return;
    if (!stored.recording?.id) {
      if (!stored.snapshot?.startsWith("data:image/")) return;
      let cancelled = false;
      setForensicsLoading(true);
      analyzeReplayForensics({
        data: {
          frames: [{ t: 0, dataUrl: stored.snapshot }],
          companyId: stored.config.companyId,
          role: stored.config.role,
        },
      })
        .then((result) => {
          if (cancelled) return;
          const normalized = normalizeForensics(result);
          setForensics(normalized);
          const latest = getSession(sessionId) ?? stored;
          saveSession({ ...latest, forensics: normalized });
        })
        .catch(() => {
          /* forensics is a bonus panel — never block the report */
        })
        .finally(() => {
          if (!cancelled) setForensicsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
    let cancelled = false;
    setForensicsLoading(true);
    (async () => {
      try {
        const blob = await getRecording(stored.recording!.id);
        if (!blob || cancelled) return;
        const url = URL.createObjectURL(blob);
        try {
          const video = document.createElement("video");
          video.src = url;
          video.muted = true;
          video.preload = "auto";
          await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () => reject(new Error("could not load recording"));
          });
          const duration = video.duration || stored.recording?.duration || 0;
          const proctorTimes = (stored.proctor ?? []).map((p) => p.t);
          const evenSpread =
            duration > 0
              ? Array.from({ length: 5 }, (_, i) => Math.round((duration * (i + 1)) / 6))
              : [];
          const candidateTimes = Array.from(new Set([...proctorTimes, ...evenSpread]))
            .filter((t) => Number.isFinite(t) && t >= 0)
            .sort((a, b) => a - b)
            .slice(0, 8);
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 360;
          const ctx = canvas.getContext("2d");
          const frames: { t: number; dataUrl: string }[] = [];
          for (const t of candidateTimes) {
            try {
              await new Promise<void>((resolve) => {
                const onSeeked = () => {
                  video.removeEventListener("seeked", onSeeked);
                  resolve();
                };
                video.addEventListener("seeked", onSeeked);
                video.currentTime = Math.min(Math.max(t, 0), Math.max(0, duration - 0.1));
              });
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push({ t, dataUrl: canvas.toDataURL("image/jpeg", 0.8) });
              }
            } catch {
              /* skip a bad seek */
            }
          }
          if (cancelled || frames.length === 0) return;
          const result = await analyzeReplayForensics({
            data: { frames, companyId: stored.config.companyId, role: stored.config.role },
          });
          if (cancelled) return;
          const normalized = normalizeForensics(result);
          setForensics(normalized);
          const latest = getSession(sessionId) ?? stored;
          saveSession({ ...latest, forensics: normalized });
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch {
        /* forensics is a bonus panel — never block the report */
      } finally {
        if (!cancelled) setForensicsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, sessionRevision]);

  useEffect(() => {
    const stored = getSession(sessionId);
    if (!stored || !stored.completedAt) return;

    if (stored.replayAppearanceStatus) {
      setReplayAppearanceStatus(stored.replayAppearanceStatus);
      setReplayAppearance(stored.replayAppearance ?? null);
      setReplayAppearanceError(stored.replayAppearanceError ?? null);
      return;
    }
    if (stored.forensics?.appearance?.assessed) {
      setReplayAppearanceStatus("assessed");
      setReplayAppearance(stored.forensics.appearance);
      setReplayAppearanceError(null);
      return;
    }
    if (stored.cloudMediaAnalysisConsent !== true && stored.appearanceReviewConsent !== true)
      return;

    let cancelled = false;
    setAppearanceLoading(true);
    setReplayAppearanceStatus("checking");
    setReplayAppearanceError(null);
    (async () => {
      let result;
      try {
        const frames = await captureSavedAppearanceFrames(stored);
        if (cancelled) return;
        result = await analyzeAppearanceFrames({
          data: {
            frames,
            companyId: stored.config.companyId,
            role: stored.config.role,
          },
        });
      } catch (error) {
        result = {
          status: "frame_unusable" as const,
          message: error instanceof Error ? error.message : "Could not read saved camera frames.",
        };
      }
      if (cancelled) return;
      setReplayAppearanceStatus(result.status);
      setReplayAppearance(result.appearance ?? null);
      setReplayAppearanceError(result.message ?? null);
      const latest = getSession(sessionId) ?? stored;
      saveSession({
        ...latest,
        replayAppearance: result.appearance ?? null,
        replayAppearanceStatus: result.status,
        replayAppearanceError: result.message ?? null,
      });
    })()
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Appearance analysis failed.";
        setReplayAppearanceStatus("analysis_failed");
        setReplayAppearanceError(message);
      })
      .finally(() => {
        if (!cancelled) setAppearanceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, appearanceRetry]);

  if (!loading && !session) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h1 className="font-display text-2xl font-semibold">Report not found</h1>
          <p className="mt-2 text-muted-foreground">
            This interview session isn't stored in this browser.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/interviewer/setup" })}>
            Start a new interview
          </Button>
        </main>
      </div>
    );
  }

  const company = session ? getCompany(session.config.companyId) : null;
  const answered = session?.turns.filter((t) => t.answer).length ?? 0;
  const groomingEvents = (session?.coaching ?? []).filter(
    (event) => event.area === "hair" || event.area === "grooming" || event.area === "attire",
  );
  const reportProctor = session?.proctor ?? [];
  const cameraMeasured = session?.vision.enabled === true || session?.detection?.onDevice === true;
  const noteByArea = new Map(
    (report?.subScoreNotes ?? []).map((note) => [note.area.toLowerCase(), note.note]),
  );
  const standardAreas = new Set([
    "grammar",
    "body language",
    "eye contact",
    "professionalism",
    "behaviour",
  ]);
  const detailScores = report
    ? [
        { area: "Grammar", score: report.grammar },
        { area: "Body language", score: cameraMeasured ? report.bodyLanguage : null },
        { area: "Eye contact", score: cameraMeasured ? report.eyeContact : null },
        { area: "Professionalism", score: report.professionalism },
        { area: "Behaviour", score: report.behaviour },
        ...report.subScoreNotes
          .filter((note) => !standardAreas.has(note.area.toLowerCase()))
          .map((note) => ({ area: note.area, score: note.score })),
      ]
    : [];
  const requestAppearanceReview = () => {
    if (!session) return;
    const latest = getSession(sessionId) ?? session;
    saveSession({
      ...latest,
      appearanceReviewConsent: true,
      replayAppearance: null,
      replayAppearanceStatus: undefined,
      replayAppearanceError: null,
    });
    setReplayAppearance(null);
    setReplayAppearanceStatus("pending");
    setReplayAppearanceError(null);
    setAppearanceLoading(true);
    setAppearanceRetry((retry) => retry + 1);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader
        right={
          <Button asChild size="sm" variant="secondary">
            <Link to="/interviewer/setup">New interview</Link>
          </Button>
        }
      />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">Performance report</h1>
            <p className="mt-2 text-muted-foreground">
              {company?.name} · {session?.config.role} · {session?.config.experience} · {answered}{" "}
              answers
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="mr-1.5 h-4 w-4" /> Save as PDF
          </Button>
        </div>

        {!session?.completedAt ? (
          session ? (
            <LiveSessionReport session={session} />
          ) : null
        ) : report ? (
          <div className="mt-8 space-y-6">
            {reportError && (
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
                <p className="text-sm text-muted-foreground">
                  Detailed AI evaluation failed. This full report uses recorded scores and
                  measurements.
                  {` ${reportError}`}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    reportBuildStartedRef.current = false;
                    setReport(null);
                    setReportError(null);
                    setLoading(true);
                    setReportRetry((retry) => retry + 1);
                  }}
                >
                  Retry evaluation
                </Button>
              </section>
            )}
            {/* Headline */}
            <section className="grid gap-6 rounded-2xl glass p-6 lg:grid-cols-[auto_1fr]">
              <div className="flex items-center gap-6">
                <ScoreRing value={report.overall} label="Overall" size={140} />
                <ScoreRing
                  value={report.hiringProbability}
                  label="Would hire"
                  size={110}
                  tone={report.hiringProbability >= 60 ? "success" : "warning"}
                />
              </div>
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" /> Recruiter summary
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {report.summary}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ScoreBar label="Technical depth" value={report.technical} />
                  <ScoreBar label="Coding" value={report.coding} />
                  <ScoreBar label="Communication" value={report.communication} />
                  <ScoreBar label="Confidence" value={report.confidence} />
                  <ScoreBar label="Resume fit" value={report.resumeFit} />
                  <ScoreBar label={`${company?.name} readiness`} value={report.companyReadiness} />
                </div>
              </div>
            </section>

            {/* Detailed sub-scores */}
            <section className="rounded-2xl glass p-6">
              <h2 className="font-display text-lg font-semibold">Detailed sub-scores</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {detailScores.map((sub) => (
                  <div key={sub.area} className="rounded-xl bg-secondary/35 p-4">
                    {sub.score == null ? (
                      <div className="flex items-center justify-between text-sm">
                        <span>{sub.area}</span>
                        <span className="text-xs text-muted-foreground">Not measured</span>
                      </div>
                    ) : (
                      <ScoreBar label={sub.area} value={sub.score} />
                    )}
                    {noteByArea.get(sub.area.toLowerCase()) && (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {noteByArea.get(sub.area.toLowerCase())}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <AppearanceGroomingPanel
              appearance={
                replayAppearance?.assessed
                  ? replayAppearance
                  : (session?.liveAppearance ?? forensics?.appearance)
              }
              legacySummary={forensics?.groomingSummary}
              loading={appearanceLoading}
              analysisStatus={replayAppearanceStatus}
              analysisError={replayAppearanceError}
              hasRecording={Boolean(session?.recording?.id || session?.snapshot)}
              cloudReviewAllowed={
                session?.cloudMediaAnalysisConsent === true ||
                session?.appearanceReviewConsent === true
              }
              liveCoaching={groomingEvents}
              onEnableCloudReview={requestAppearanceReview}
            />

            {/* Topics */}
            <div className="grid gap-6 lg:grid-cols-3">
              <ListCard
                icon={TrendingUp}
                title="Strong topics"
                items={report.strongTopics}
                tone="success"
              />
              <ListCard
                icon={Target}
                title="Weak topics"
                items={report.weakTopics}
                tone="warning"
              />
              <ListCard icon={Code2} title="Skill gaps" items={report.skillGaps} />
            </div>

            {/* Resume fit for this company */}
            {session?.config.resumeFit && (
              <section className="rounded-2xl glass p-6">
                <h2 className="font-display text-lg font-semibold">
                  Resume fit for {company?.name ?? "this company"}
                </h2>
                <ResumeFitCard
                  className="mt-4"
                  fit={session.config.resumeFit}
                  companyName={company?.name ?? "this company"}
                />
              </section>
            )}

            {session?.config.resume && (
              <section className="rounded-2xl glass p-6">
                <h2 className="font-display text-lg font-semibold">
                  Resume evidence used in interview
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Vera Kapoor used the attached resume for{" "}
                  {session.config.candidateName || session.config.resume.name || "this candidate"}.
                  The entries below show the resume facts available for questioning and the answers
                  captured.
                </p>
                <p className="mt-2 text-xs text-primary">
                  Resume analysis: {session.config.resume.sourceLines?.length ?? "available"} source
                  lines indexed word by word.
                </p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl bg-secondary/35 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">
                      Resume facts
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {session.config.resume.projects.slice(0, 5).map((project) => (
                        <li key={project.title}>
                          <span className="font-medium text-foreground">{project.title}</span>:{" "}
                          {project.summary}
                        </li>
                      ))}
                      {session.config.resume.skills.length > 0 && (
                        <li>
                          <span className="font-medium text-foreground">Skills:</span>{" "}
                          {session.config.resume.skills.join(", ")}
                        </li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-xl bg-secondary/35 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">
                      Resume questions
                    </h3>
                    <ul className="mt-3 space-y-3 text-sm">
                      {session.turns
                        .filter((turn) => turn.phase === "resume" && turn.question)
                        .map((turn) => (
                          <li key={turn.id}>
                            <p className="text-foreground">{turn.question?.prompt}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {turn.answer
                                ? "Answer captured and available for evaluation."
                                : "No answer captured."}
                            </p>
                          </li>
                        ))}
                      {!session.turns.some((turn) => turn.phase === "resume" && turn.question) && (
                        <li className="text-muted-foreground">
                          No resume-specific question was completed.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {/* Replay timeline */}
            <ReplayTimeline
              sessionId={sessionId}
              recording={session?.recording ?? null}

              presence={session?.presence ?? []}
              coaching={session?.coaching ?? []}
              proctor={session?.proctor ?? []}
              forensics={forensics?.findings ?? []}
              forensicsLoading={forensicsLoading}
              duration={
                session?.recording?.duration ??
                Math.max(
                  0,
                  Math.round(((session?.completedAt ?? 0) - (session?.createdAt ?? 0)) / 1000),
                )
              }
            />

            {/* Integrity & proctoring */}
            <section className="rounded-2xl glass p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                {(session?.proctor ?? []).length > 0 ? (
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                ) : (
                  <Shield className="h-4 w-4 text-success" />
                )}
                Integrity & proctoring
              </h2>
              {session?.endedEarly && (
                <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  This session was ended early by the proctor. A recruiter would treat an
                  interrupted interview as a red flag.
                </p>
              )}
              {reportProctor.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No integrity events were recorded during the interview.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {reportProctor.map((event, i) => (
                    <li
                      key={`${event.t}-${event.kind}-${i}`}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 px-4 py-3 text-sm"
                    >
                      <span className="tabular-nums text-primary">
                        {Math.floor(event.t / 60)}:{String(event.t % 60).padStart(2, "0")}
                      </span>
                      <span className="font-medium">{PROCTOR_LABELS[event.kind]}</span>
                      <span className="text-muted-foreground">{event.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Delivery */}
            <section className="rounded-2xl glass p-6">
              <h2 className="font-display text-lg font-semibold">Delivery & presence</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Voice:{" "}
                <span className="font-medium text-foreground">{voiceStatusLabel(session)}</span>
                {session?.voice.status !== "captured" &&
                  " — voice metrics are not used to judge delivery when no usable audio was captured."}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Speaking pace"
                  value={
                    voiceCaptured(session) ? `${session!.voice.wordsPerMinute} wpm` : "not captured"
                  }
                />
                <Stat
                  label="Filler words"
                  value={
                    voiceCaptured(session) ? String(session!.voice.fillerWords) : "not captured"
                  }
                />
                <Stat
                  label="Long pauses"
                  value={
                    voiceCaptured(session) ? String(session!.voice.pauseCount) : "not captured"
                  }
                />
              </div>
            </section>

            {/* Plan */}
            <div className="grid gap-6 lg:grid-cols-3">
              <section className="rounded-2xl glass p-6">
                <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                  <BookOpen className="h-4 w-4 text-primary" /> Recommended learning
                </h2>
                <ul className="mt-4 space-y-3 text-sm">
                  {report.recommendedCourses.map((c) => (
                    <li key={c.title}>
                      <span className="font-medium">{c.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{c.why}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <ListCard
                icon={MessageSquare}
                title="Practice these questions"
                items={report.recommendedQuestions}
              />
              <ListCard
                icon={Code2}
                title="Practice these problems"
                items={report.recommendedProblems}
              />
            </div>

            {/* Transcript */}
            <section className="rounded-2xl glass p-6">
              <h2 className="font-display text-lg font-semibold">Question-by-question</h2>
              <div className="mt-4 space-y-4">
                {session?.turns
                  .filter((t) => t.question)
                  .map((t, i) => (
                    <article key={t.id} className="rounded-xl border border-border/70 p-4">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                        <span className="text-primary">Q{i + 1}</span>
                        <span>{t.question?.topic}</span>
                        <span>difficulty {t.question?.difficulty}/5</span>
                        {t.evaluation && (
                          <span className="ml-auto text-foreground">
                            {t.evaluation.score}/100 · {t.evaluation.verdict}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm">{t.question?.prompt}</p>
                      {t.answer && (
                        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-secondary/35 p-3 text-xs text-muted-foreground">
                          {t.answer}
                        </p>
                      )}
                      {t.evaluation?.note && (
                        <p className="mt-2 text-xs text-primary">{t.evaluation.note}</p>
                      )}
                      {coaching[t.id] ? (
                        <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
                          <h3 className="text-[10px] uppercase tracking-widest text-primary">
                            How to score 100/100
                          </h3>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Ideal shape: </span>
                            {coaching[t.id].idealShape}
                          </p>
                          {coaching[t.id].mustHit.length > 0 && (
                            <ul className="mt-1.5 space-y-1">
                              {coaching[t.id].mustHit.map((point) => (
                                <li
                                  key={point}
                                  className="flex gap-1.5 text-xs text-muted-foreground"
                                >
                                  <span className="text-primary">•</span> {point}
                                </li>
                              ))}
                            </ul>
                          )}
                          {coaching[t.id].modelAnswer && (
                            <div className="mt-2 rounded-md bg-background/50 p-2">
                              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                Model answer (from your resume)
                              </span>
                              <p className="mt-1 text-xs leading-relaxed">
                                {coaching[t.id].modelAnswer}
                              </p>
                            </div>
                          )}
                          {coaching[t.id].whyItLostPoints && (
                            <p className="mt-2 text-xs text-warning">
                              Why you lost points: {coaching[t.id].whyItLostPoints}
                            </p>
                          )}
                        </div>
                      ) : coachingLoading ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Generating a model answer from your resume…
                        </p>
                      ) : null}
                    </article>
                  ))}
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/interviewer/setup">
                  Run another interview <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/interviewer/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Evaluating your interview…</p>
          </div>
        )}
      </main>
    </div>
  );
}

function ListCard({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: React.ElementType;
  title: string;
  items?: string[];
  tone?: "success" | "warning";
}) {
  return (
    <section className="rounded-2xl glass p-6">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold">
        <Icon
          className={
            tone === "success"
              ? "h-4 w-4 text-success"
              : tone === "warning"
                ? "h-4 w-4 text-warning"
                : "h-4 w-4 text-primary"
          }
        />
        {title}
      </h2>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {(items ?? []).length === 0 && (
          <li className="text-xs italic">
            Not enough graded answers or resume data yet to fill this in — run a full interview with
            a resume attached to populate it.
          </li>
        )}
        {(items ?? []).map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CoachingSignal({
  icon: Icon,
  title,
  issue,
  detail,
  action,
}: {
  icon: React.ElementType;
  title: string;
  issue: boolean;
  detail: string;
  action: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <div className="flex items-center gap-2">
        <Icon className={issue ? "h-4 w-4 text-warning" : "h-4 w-4 text-success"} />
        <span className="font-medium">{title}</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
          {issue ? "Practice" : "On track"}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{detail}</p>
      <p className="mt-2 text-xs text-primary">Next time: {action}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/35 px-4 py-3">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="mt-1 block font-display text-xl font-semibold">{value}</span>
    </div>
  );
}
