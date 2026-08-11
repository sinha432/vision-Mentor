import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { listAssessmentAttempts, rescoreAssessmentAttempts } from "@/lib/assessments-data";

export const Route = createFileRoute("/_authenticated/dashboard/assessments/$code")({
  head: () => ({
    meta: [
      { title: "Attempts — Company Dashboard" },
      {
        name: "description",
        content:
          "Candidate attempts for this assessment with scores and reports.",
      },
    ],
  }),
  component: AttemptsPage,
});

function scoreClass(score: number) {
  if (score >= 70) return "text-emerald";
  if (score >= 40) return "text-amber";
  return "text-destructive";
}

function AttemptsPage() {
  const { code } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: attempts = [] } = useQuery({
    queryKey: ["assessment-attempts", code],
    queryFn: () => listAssessmentAttempts({ code }),
  });

  const rescoreMutation = useMutation({
    mutationFn: () => rescoreAssessmentAttempts({ code }),
    onSuccess: (result) => {
      toast.success(
        result.rescored === 0
          ? "No attempts to re-score."
          : `Re-scored ${result.rescored} attempt${result.rescored === 1 ? "" : "s"}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["assessment-attempts", code] });
      void queryClient.invalidateQueries({ queryKey: ["company-assessments"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not re-score"),
  });

  const chartData = attempts.map((a) => ({
    name: a.candidateName,
    score: a.score,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header className="animate-fade-in space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/dashboard/assessments">
              <ArrowLeft className="mr-1 h-4 w-4" /> Assessments
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="hover-glow gap-2"
            disabled={rescoreMutation.isPending || attempts.length === 0}
            onClick={() => rescoreMutation.mutate()}
          >
            {rescoreMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Re-score with AI
          </Button>
        </div>
        <h1 className="text-aurora font-display text-2xl font-bold sm:text-3xl">
          Attempts
        </h1>
        <p className="text-sm text-muted-foreground">
          Share code <span className="font-mono text-primary">{code}</span> ·{" "}
          {attempts.length} attempts
        </p>
      </header>

      <section className="glass animate-fade-in rounded-2xl p-5">
        <h2 className="font-display text-lg font-semibold">Score distribution</h2>
        <div className="mt-4 h-64">
          {attempts.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              No attempts yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                />
                <XAxis
                  dataKey="name"
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.75rem",
                    color: "var(--color-popover-foreground)",
                  }}
                />
                <Bar
                  dataKey="score"
                  radius={[6, 6, 0, 0]}
                  fill="var(--color-chart-1)"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="glass animate-fade-in rounded-2xl p-5">
        <h2 className="font-display text-lg font-semibold">Candidates</h2>
        <ul className="mt-4 divide-y divide-border">
          {attempts.map((attempt) => (
            <li
              key={attempt.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {attempt.candidateName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {attempt.candidateEmail} ·{" "}
                  {new Date(attempt.submittedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`font-display text-sm font-semibold ${scoreClass(attempt.score)}`}
                >
                  {attempt.score}%
                </span>
                {attempt.reportUrl ? (
                  <Button asChild size="sm" variant="outline" className="hover-glow">
                    <a href={attempt.reportUrl} target="_blank" rel="noreferrer">
                      View report
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">No report</span>
                )}
              </div>
            </li>
          ))}
          {attempts.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">
              No candidates have submitted this assessment yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
