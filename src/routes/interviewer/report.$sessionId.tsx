import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Code2,
  Download,
  Loader2,
  MessageSquare,
  Scissors,
  Shield,
  ShieldAlert,
  Shirt,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/interviewer/components/vmx/SiteHeader";
import { ResumeFitCard } from "@/interviewer/components/vmx/ResumeFitCard";
import { ReplayTimeline } from "@/interviewer/components/vmx/ReplayTimeline";
import { TrendCharts } from "@/interviewer/components/vmx/TrendCharts";
import { ScoreBar, ScoreRing } from "@/interviewer/components/vmx/ScoreRing";
import { Button } from "@/components/ui/button";
import { getCompany } from "@/interviewer/lib/companies";
import {
  analyzeReplayForensics,
  buildAnswerCoaching,
  buildInterviewReport,
  reviewAppearance,
} from "@/interviewer/lib/interview.functions";
import {
  type AnswerCoaching,
  DRESS_LABELS,
  HAIR_LABELS,
  type AppearanceReview,
  type DressVerdict,
  type ForensicsFinding,
  type ForensicsKind,
  type ForensicsReport,
  type HairVerdict,
  type InterviewReport,
  type InterviewSession,
  PROCTOR_LABELS,
} from "@/interviewer/lib/interview-types";
import { getRecording } from "@/interviewer/lib/recording-store";
import { getSession, saveSession } from "@/interviewer/lib/session-store";

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
          .filter((n) => n && typeof n.area === "string")
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

/** Same defensive treatment as the report — the model owns this shape too. */
function normalizeAppearance(raw: unknown): AppearanceReview {
  const a = (raw ?? {}) as Partial<AppearanceReview>;
  const dressVerdicts: DressVerdict[] = ["appropriate", "acceptable", "not_appropriate"];
  const hairVerdicts: HairVerdict[] = ["neat", "untidy"];
  const dressVerdict = a.dress?.verdict;
  const hairVerdict = a.hair?.verdict;
  return {
    assessed: a.assessed === true,
    dress: {
      verdict: dressVerdict && dressVerdicts.includes(dressVerdict) ? dressVerdict : "acceptable",
      note: typeof a.dress?.note === "string" ? a.dress.note : "",
    },
    hair: {
      verdict: hairVerdict && hairVerdicts.includes(hairVerdict) ? hairVerdict : "neat",
      note: typeof a.hair?.note === "string" ? a.hair.note : "",
    },
    fixes: list(a.fixes),
    reason: typeof a.reason === "string" ? a.reason : "",
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
  };
}

function voiceCaptured(session: InterviewSession | null): boolean {
  return !!session && (session.voice.samples ?? 0) > 0;
}

function ReportPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [appearance, setAppearance] = useState<AppearanceReview | null>(null);
  const [appearanceLoading, setAppearanceLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [coaching, setCoaching] = useState<Record<string, AnswerCoaching>>({});
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [forensics, setForensics] = useState<ForensicsReport | null>(null);
  const [forensicsLoading, setForensicsLoading] = useState(false);

  // Dress & hair review: runs once per session, then is stored with it.
  useEffect(() => {
    const stored = getSession(sessionId);
    if (!stored) return;
    if (stored.appearance?.assessed) {
      setAppearance(normalizeAppearance(stored.appearance));
      return;
    }
    if (!stored.snapshot) return;
    let cancelled = false;
    setAppearanceLoading(true);
    (async () => {
      try {
        const result = await reviewAppearance({
          data: {
            dataUrl: stored.snapshot!,
            companyId: stored.config.companyId,
            role: stored.config.role,
          },
        });
        if (cancelled) return;
        const normalized = normalizeAppearance(result);
        setAppearance(normalized);
        const latest = getSession(sessionId) ?? stored;
        // Keep the frame when the model could not assess it so the report can
        // retry instead of permanently losing the only appearance sample.
        saveSession({
          ...latest,
          appearance: normalized.assessed ? normalized : undefined,
          snapshot: normalized.assessed ? null : latest.snapshot,
        });
      } catch {
        /* appearance review is optional — never block the report */
      } finally {
        if (!cancelled) setAppearanceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    const stored = getSession(sessionId);
    if (!stored) {
      setLoading(false);
      return;
    }
    setSession(stored);
    if (stored.report) {
      setReport(normalizeReport(stored.report));
      setLoading(false);
      return;
    }
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
        const latest = getSession(sessionId) ?? stored;
        saveSession({ ...latest, report: full, completedAt: latest.completedAt ?? Date.now() });
      } catch (error) {
        if (!cancelled)
          toast.error(error instanceof Error ? error.message : "Could not build the report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // "How to score 100/100" coaching per question — generated once, cached with the session.
  useEffect(() => {
    const stored = getSession(sessionId);
    if (!stored) return;
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
        for (const item of result as { turnId: string; idealShape: string; mustHit: string[]; modelAnswer: string; whyItLostPoints: string }[]) {
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
  }, [sessionId]);


  // Post-interview replay forensics: sample frames around proctor flags plus
  // an even spread, then ask Groq to confirm/refine integrity events and give
  // one grooming read — cached with the session once generated.
  useEffect(() => {
    const stored = getSession(sessionId);
    if (!stored) return;
    if (stored.forensics) {
      setForensics(normalizeForensics(stored.forensics));
      return;
    }
    if (!stored.recording?.id) return;
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
          canvas.width = 320;
          canvas.height = 240;
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
                frames.push({ t, dataUrl: canvas.toDataURL("image/jpeg", 0.6) });
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
  }, [sessionId]);

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

        {loading || !report ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Evaluating your interview…</p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
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
                {(report.subScoreNotes.length
                  ? report.subScoreNotes
                  : [
                      { area: "Grammar", score: report.grammar, note: "" },
                      { area: "Body language", score: report.bodyLanguage, note: "" },
                      { area: "Eye contact", score: report.eyeContact, note: "" },
                      { area: "Professionalism", score: report.professionalism, note: "" },
                      { area: "Behaviour", score: report.behaviour, note: "" },
                    ]
                ).map((sub) => (
                  <div key={sub.area} className="rounded-xl bg-secondary/35 p-4">
                    <ScoreBar label={sub.area} value={sub.score} />
                    {sub.note && (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {sub.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

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

            {/* Trend graphs */}
            <TrendCharts
              samples={session?.detection?.samples ?? []}
              turns={session?.turns ?? []}
              createdAt={session?.createdAt ?? 0}
              recording={session?.recording ?? null}
            />

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
              {(session?.proctor ?? []).length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No integrity issues were detected — one candidate in frame, a single voice, and
                  you stayed in the interview the whole time.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {(session?.proctor ?? []).map((event, i) => (
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
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Speaking pace"
                  value={voiceCaptured(session) ? `${session!.voice.wordsPerMinute} wpm` : "not captured"}
                />
                <Stat
                  label="Filler words"
                  value={voiceCaptured(session) ? String(session!.voice.fillerWords) : "not captured"}
                />
                <Stat
                  label="Long pauses"
                  value={voiceCaptured(session) ? String(session!.voice.pauseCount) : "not captured"}
                />
                <Stat
                  label="Eye contact"
                  value={session?.vision.enabled ? `${session.vision.eyeContact}%` : "not captured"}
                />
                <Stat
                  label="Posture"
                  value={session?.vision.enabled ? `${session.vision.posture}%` : "not captured"}
                />
                <Stat
                  label="Attention"
                  value={session?.vision.enabled ? `${session.vision.attention}%` : "not captured"}
                />
              </div>
            </section>

            {/* Appearance & grooming */}
            <section className="rounded-2xl glass p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Shirt className="h-4 w-4 text-primary" /> Appearance & grooming
              </h2>
              {appearanceLoading ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Reviewing your dress and
                  hair…
                </p>
              ) : !appearance ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Camera was off — appearance not assessed. Turn the camera on to get dress and hair
                  feedback.
                </p>
              ) : !appearance.assessed ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {appearance.reason || "Appearance not assessed."}
                  </p>
                  {session?.snapshot && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const current = getSession(sessionId);
                        if (current) {
                          setAppearance(null);
                          setAppearanceLoading(true);
                          void reviewAppearance({
                            data: {
                              dataUrl: current.snapshot!,
                              companyId: current.config.companyId,
                              role: current.config.role,
                            },
                          })
                            .then((result) => {
                              const normalized = normalizeAppearance(result);
                              setAppearance(normalized);
                              const latest = getSession(sessionId) ?? current;
                              saveSession({
                                ...latest,
                                appearance: normalized.assessed ? normalized : undefined,
                                snapshot: normalized.assessed ? null : latest.snapshot,
                              });
                            })
                            .finally(() => setAppearanceLoading(false));
                        }
                      }}
                    >
                      Review camera frame again
                    </Button>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <AppearanceItem
                      icon={Shirt}
                      title="Dress"
                      label={DRESS_LABELS[appearance.dress.verdict]}
                      tone={
                        appearance.dress.verdict === "appropriate"
                          ? "success"
                          : appearance.dress.verdict === "acceptable"
                            ? "warning"
                            : "danger"
                      }
                      note={appearance.dress.note}
                    />
                    <AppearanceItem
                      icon={Scissors}
                      title="Hair"
                      label={HAIR_LABELS[appearance.hair.verdict]}
                      tone={appearance.hair.verdict === "neat" ? "success" : "warning"}
                      note={appearance.hair.note}
                    />
                  </div>
                  {forensics?.assessed && forensics.groomingSummary && (
                    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                      <h3 className="text-[10px] uppercase tracking-widest text-primary">
                        Post-interview grooming read (from replay)
                      </h3>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {forensics.groomingSummary}
                      </p>
                    </div>
                  )}
                  {appearance.fixes.length > 0 && (
                    <div className="rounded-xl bg-secondary/35 p-4">
                      <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Fix before your next interview
                      </h3>
                      <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                        {appearance.fixes.map((fix, i) => (
                          <li key={fix} className="flex gap-2">
                            <span className="text-primary">{i + 1}.</span>
                            {fix}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
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
                                <li key={point} className="flex gap-1.5 text-xs text-muted-foreground">
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
                              <p className="mt-1 text-xs leading-relaxed">{coaching[t.id].modelAnswer}</p>
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
            Not enough graded answers or resume data yet to fill this in — run a full interview
            with a resume attached to populate it.
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/35 px-4 py-3">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="mt-1 block font-display text-xl font-semibold">{value}</span>
    </div>
  );
}

function AppearanceItem({
  icon: Icon,
  title,
  label,
  tone,
  note,
}: {
  icon: React.ElementType;
  title: string;
  label: string;
  tone: "success" | "warning" | "danger";
  note: string;
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : "bg-destructive/15 text-destructive";
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</span>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-medium ${toneClass}`}>
          {label}
        </span>
      </div>
      {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
