import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, Plus, Trash2, TrendingUp } from "lucide-react";
import { SiteHeader } from "@/interviewer/components/vmx/SiteHeader";
import { ScoreRing } from "@/interviewer/components/vmx/ScoreRing";
import { Button } from "@/components/ui/button";
import { getCompany } from "@/interviewer/lib/companies";
import type { InterviewSession } from "@/interviewer/lib/interview-types";
import { deleteSession, loadSessions } from "@/interviewer/lib/session-store";

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

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const scored = sessions.filter((s) => s.report);
  const average = scored.length
    ? Math.round(scored.reduce((n, s) => n + (s.report?.overall ?? 0), 0) / scored.length)
    : 0;
  const best = scored.reduce((n, s) => Math.max(n, s.report?.overall ?? 0), 0);

  function remove(id: string) {
    deleteSession(id);
    setSessions(loadSessions());
  }

  return (
    <div className="min-h-screen">
      <SiteHeader
        right={
          <Button asChild size="sm">
            <Link to="/interviewer/setup">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New interview
            </Link>
          </Button>
        }
      />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Your dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Interview history is stored in this browser so you can revisit any report.
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
              <Link to="/interviewer/setup">
                Start interview <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold">Interview history</h2>
          {sessions.length === 0 ? (
            <div className="mt-4 rounded-2xl glass p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No interviews yet. Your first session will appear here.
              </p>
              <Button asChild className="mt-5">
                <Link to="/interviewer/setup">Start your first interview</Link>
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
        </section>
      </main>
    </div>
  );
}
