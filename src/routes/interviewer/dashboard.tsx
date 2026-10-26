import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarClock, Plus, Trash2, TrendingUp } from "lucide-react";
import { SiteHeader } from "@/interviewer/components/vmx/SiteHeader";
import { ScoreRing } from "@/interviewer/components/vmx/ScoreRing";
import { Button } from "@/components/ui/button";
import { getCompany } from "@/interviewer/lib/companies";
import type { InterviewSession } from "@/interviewer/lib/interview-types";
import { deleteSession, loadSessions } from "@/interviewer/lib/session-store";
import { buildSkillMastery, recommendPractice } from "@/interviewer/lib/skill-mastery";
import {
  deleteInterviewFromMongoDB,
  fetchUserInterviewsFromMongoDB,
  type SyncedInterviewSummary,
} from "@/lib/mongodb-sync";
import { useDemoAuth } from "@/contexts/DemoAuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/interviewer/dashboard")({
  head: () => ({
    meta: [
      { title: "Your interview dashboard — Vision Mentor X" },
      {
        name: "description",
        content:
          "Track every mock interview you've taken, compare scores over time and jump back into your performance reports.",
      },
      { property: "og:title", content: "Your interview dashboard — Vision Mentor X" },
      {
        property: "og:description",
        content: "Interview history, score trends and quick access to past performance reports.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [syncedInterviews, setSyncedInterviews] = useState<SyncedInterviewSummary[]>([]);
  const { user } = useDemoAuth();

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  useEffect(() => {
    if (!user || user.role !== "individual") {
      setSyncedInterviews([]);
      return;
    }
    let active = true;
    void fetchUserInterviewsFromMongoDB().then((interviews) => {
      if (active) setSyncedInterviews(interviews);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const scored = sessions.filter((s) => s.report);
  const average = scored.length
    ? Math.round(scored.reduce((n, s) => n + (s.report?.overall ?? 0), 0) / scored.length)
    : 0;
  const best = scored.reduce((n, s) => Math.max(n, s.report?.overall ?? 0), 0);
  const mastery = useMemo(() => {
    const remoteIds = new Set(syncedInterviews.map((interview) => interview.sessionId));
    const localObservations = sessions
      .filter((session) => !remoteIds.has(session.id))
      .flatMap((session) =>
        session.turns.flatMap((turn) =>
          turn.evaluation && turn.question
            ? [
                {
                  sessionId: session.id,
                  topic: turn.question.topic,
                  score: turn.evaluation.score,
                  evidenceCoverage: turn.evaluation.evidenceCoverage,
                  verified: turn.evaluation.verified,
                },
              ]
            : [],
        ),
      );
    const remoteObservations = syncedInterviews.flatMap((interview) =>
      interview.turns.flatMap((turn) =>
        turn.topic && typeof turn.score === "number"
          ? [
              {
                sessionId: interview.sessionId,
                topic: turn.topic,
                score: turn.score,
                evidenceCoverage: turn.evaluation?.evidenceCoverage,
                verified: turn.evaluation?.verified,
              },
            ]
          : [],
      ),
    );
    return buildSkillMastery([...remoteObservations, ...localObservations]);
  }, [sessions, syncedInterviews]);
  const nextPractice = useMemo(() => recommendPractice(mastery), [mastery]);
  const localSessionIds = new Set(sessions.map((session) => session.id));
  const remoteOnlyInterviews = syncedInterviews.filter(
    (interview) => !localSessionIds.has(interview.sessionId),
  );
  const modelObservability = useMemo(() => {
    const remoteIds = new Set(syncedInterviews.map((interview) => interview.sessionId));
    const calls = [
      ...syncedInterviews.flatMap((interview) =>
        interview.turns.flatMap((turn) => turn.modelTelemetry ?? []),
      ),
      ...sessions
        .filter((session) => !remoteIds.has(session.id))
        .flatMap((session) => session.turns.flatMap((turn) => turn.modelTelemetry ?? [])),
    ];
    return {
      total: calls.length,
      fallbacks: calls.filter((call) => call.outcome === "fallback").length,
      errors: calls.filter((call) => call.outcome === "error").length,
      averageLatency: calls.length
        ? Math.round(calls.reduce((total, call) => total + call.durationMs, 0) / calls.length)
        : 0,
      retryCalls: calls.filter((call) => call.attempts > 1).length,
      models: [
        ...new Set(
          calls.flatMap((call) =>
            call.provider && call.model ? [`${call.provider} · ${call.model}`] : [],
          ),
        ),
      ],
    };
  }, [sessions, syncedInterviews]);

  async function remove(id: string) {
    if (user?.role === "individual") {
      const deleted = await deleteInterviewFromMongoDB(id);
      if (!deleted) {
        toast.error("Could not delete this interview from your account.");
        return;
      }
      setSyncedInterviews((current) => current.filter((interview) => interview.sessionId !== id));
    }
    deleteSession(id);
    setSessions(loadSessions());
    toast.success("Interview removed.");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader
        right={
          <Button asChild size="sm">
            <Link to="/interviewer/setup" search={{ focus: undefined }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New interview
            </Link>
          </Button>
        }
      />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Your dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Interview history is stored in this browser and syncs to your account when signed in.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl glass p-5">
            <ScoreRing value={average} label="Average" size={92} />
            <div>
              <p className="text-sm font-medium">Average score</p>
              <p className="text-xs text-muted-foreground">{scored.length} completed interviews</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl glass p-5">
            <ScoreRing value={best} label="Best" size={92} tone="success" />
            <div>
              <p className="text-sm font-medium">Best performance</p>
              <p className="text-xs text-muted-foreground">Keep pushing the difficulty</p>
            </div>
          </div>
          <div className="rounded-2xl glass p-5">
            <TrendingUp className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm font-medium">Next step</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Re-run your weakest company mode and try to beat your last score.
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link to="/interviewer/setup" search={{ focus: undefined }}>
                Start interview <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        <section className="mt-8 rounded-2xl glass p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Skill mastery map</h2>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                Estimates update from scored answers across this browser and your synced interviews.
                Evidence coverage and answer count describe the data behind each estimate, not
                statistical certainty.
              </p>
            </div>
            {nextPractice && (
              <Button asChild size="sm" variant="secondary">
                <Link to="/interviewer/setup" search={{ focus: nextPractice.skill }}>
                  Practice {nextPractice.skill} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
          {mastery.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">
              Complete a scored answer to start building your skill map.
            </p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {mastery.slice(0, 6).map((skill) => (
                <div
                  key={skill.skill}
                  className="rounded-xl border border-border/50 bg-background/30 p-3"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{skill.skill}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {skill.mastery}% estimated mastery
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${skill.mastery}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {skill.observations} scored answer{skill.observations === 1 ? "" : "s"} ·{" "}
                    {skill.evidenceCoverage}% average evidence coverage
                  </p>
                </div>
              ))}
            </div>
          )}
          {nextPractice && (
            <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-semibold text-primary">Recommended next practice</p>
              <p className="mt-2 text-sm leading-relaxed">{nextPractice.prompt}</p>
              <p className="mt-2 text-xs text-muted-foreground">{nextPractice.reason}</p>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl glass p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">AI model observability</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Operational metadata only—model, operation, latency, retries and fallback status.
            Candidate answers and raw media are excluded.
          </p>
          {modelObservability.total === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Model-call metrics appear after an interview turn is completed.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ObservabilityMetric label="Model calls" value={modelObservability.total} />
              <ObservabilityMetric
                label="Average latency"
                value={`${modelObservability.averageLatency} ms`}
              />
              <ObservabilityMetric label="Retries" value={modelObservability.retryCalls} />
              <ObservabilityMetric
                label="Fallbacks / errors"
                value={`${modelObservability.fallbacks} / ${modelObservability.errors}`}
              />
            </div>
          )}
          {modelObservability.models.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Observed models: {modelObservability.models.join(", ")}
            </p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold">Interview history</h2>
          {sessions.length === 0 && remoteOnlyInterviews.length === 0 ? (
            <div className="mt-4 rounded-2xl glass p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No interviews yet. Your first session will appear here.
              </p>
              <Button asChild className="mt-5">
                <Link to="/interviewer/setup" search={{ focus: undefined }}>
                  Start your first interview
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl glass px-5 py-4"
                >
                  <ScoreRing value={s.report?.overall ?? 0} size={64} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold">
                      {getCompany(s.config.companyId).name} · {s.config.role}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" />
                      {new Date(s.createdAt).toLocaleString()} ·{" "}
                      {s.turns.filter((t) => t.answer).length} answers ·{" "}
                      {s.report ? "report ready" : "no report yet"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/interviewer/report/$sessionId" params={{ sessionId: s.id }}>
                        View report
                      </Link>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      aria-label="Delete session"
                      onClick={() => remove(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {remoteOnlyInterviews.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold">Other interviews synced to your account</h3>
              <ul className="mt-3 space-y-3">
                {remoteOnlyInterviews.map((interview) => {
                  const scores = interview.turns.flatMap((turn) =>
                    typeof turn.score === "number" ? [turn.score] : [],
                  );
                  const averageScore = scores.length
                    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
                    : null;
                  return (
                    <li
                      key={interview.sessionId}
                      className="flex flex-wrap items-center gap-4 rounded-xl glass px-5 py-4"
                    >
                      <ScoreRing value={averageScore ?? 0} size={56} />
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-sm font-semibold">Synced interview</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {interview.turns.length} turns
                          {averageScore == null ? "" : ` · ${averageScore} average score`} · ID{" "}
                          {interview.sessionId}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground"
                        aria-label={`Delete synced interview ${interview.sessionId}`}
                        onClick={() => void remove(interview.sessionId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ObservabilityMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
