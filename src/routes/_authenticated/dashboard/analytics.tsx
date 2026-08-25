import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  ClipboardCheck,
  Users,
  TrendingUp,
  Target,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { listCompanyAssessments } from "@/lib/assessments-data";
import { useDemoAuth } from "@/contexts/DemoAuthContext";

export const Route = createFileRoute(
  "/_authenticated/dashboard/analytics",
)({
  head: () => ({
    meta: [
      {
        title: "Hiring Analytics — Vision Mentor X",
      },
      {
        name: "description",
        content:
          "Company hiring analytics and assessment performance.",
      },
    ],
  }),
  component: HiringAnalyticsPage,
});

function HiringAnalyticsPage() {
  const { user, ready } = useDemoAuth();

  const {
    data: assessments = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "company-assessments",
      user?.id,
    ],
    queryFn: () => listCompanyAssessments(),
    enabled:
      ready &&
      !!user &&
      user.role === "company",
  });

  if (!ready) {
    return (
      <PageShell>
        <LoadingState message="Loading hiring analytics..." />
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell>
        <EmptyState
          title="Authentication required"
          message="Please sign in to access hiring analytics."
          action={
            <Link
              to="/auth"
              className="inline-flex items-center rounded-lg bg-cyber px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Sign in
            </Link>
          }
        />
      </PageShell>
    );
  }

  if (user.role !== "company") {
    return (
      <PageShell>
        <EmptyState
          title="Company access required"
          message="Hiring analytics is available only for company accounts."
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm"
            >
              <ArrowLeft className="size-4" />
              Back
            </Link>
          }
        />
      </PageShell>
    );
  }

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState message="Loading assessment data..." />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <EmptyState
          title="Unable to load analytics"
          message={
            error instanceof Error
              ? error.message
              : "Something went wrong while loading hiring analytics."
          }
        />
      </PageShell>
    );
  }

  const created = assessments.length;

  const candidatesTested = assessments.reduce(
    (total, assessment) =>
      total + Number(assessment.attemptCount || 0),
    0,
  );

  const totalScoreWeight = assessments.reduce(
    (total, assessment) =>
      total +
      Number(assessment.avgScore || 0) *
        Number(assessment.attemptCount || 0),
    0,
  );

  const averageScore =
    candidatesTested > 0
      ? totalScoreWeight / candidatesTested
      : 0;

  const activeAssessments = assessments.filter(
    (assessment) =>
      assessment.status !== "closed",
  ).length;

  return (
    <PageShell>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <BarChart3 className="size-5 text-cyber" />

            <span className="text-[10px] font-semibold tracking-[0.18em] text-cyber uppercase">
              Nova Hiring Analytics
            </span>
          </div>

          <h1 className="font-display text-2xl font-bold text-gradient sm:text-3xl">
            Hiring Analytics
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Understand assessment activity, candidate
            participation and overall hiring performance.
          </p>
        </div>

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 self-start rounded-lg border border-border bg-background/50 px-4 py-2 text-sm transition-colors hover:border-cyber/50 hover:text-cyber"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsCard
          icon={ClipboardCheck}
          label="Assessments Created"
          value={created}
          description="Total company assessments"
        />

        <AnalyticsCard
          icon={Users}
          label="Candidates Tested"
          value={candidatesTested}
          description="Total assessment attempts"
        />

        <AnalyticsCard
          icon={Target}
          label="Average Score"
          value={`${averageScore.toFixed(1)}%`}
          description="Across candidate attempts"
        />

        <AnalyticsCard
          icon={TrendingUp}
          label="Active Assessments"
          value={activeAssessments}
          description="Currently available"
        />
      </div>

      {/* Assessment performance */}
      <section className="mt-6 card-3d rounded-2xl p-5">
        <div className="mb-5">
          <h2 className="font-display text-lg font-semibold">
            Assessment Performance
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">
            Performance breakdown for your company assessments.
          </p>
        </div>

        {assessments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <ClipboardCheck className="mx-auto size-8 text-muted-foreground" />

            <h3 className="mt-3 text-sm font-semibold">
              No assessments yet
            </h3>

            <p className="mt-1 text-xs text-muted-foreground">
              Create and publish an assessment to start
              collecting hiring analytics.
            </p>

            <Link
              to="/dashboard/assessments"
              className="mt-4 inline-flex rounded-lg bg-cyber px-4 py-2 text-xs font-medium text-primary-foreground"
            >
              View Assessments
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {assessments.map((assessment) => {
              const attempts = Number(
                assessment.attemptCount || 0,
              );

              const score = Number(
                assessment.avgScore || 0,
              );

              return (
                <div
              key={assessment.code}    
                  className="rounded-xl border border-border/60 bg-background/40 p-4 transition-colors hover:border-cyber/40"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">
                        {assessment.title}
                      </h3>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Code{" "}
                        <span className="font-mono text-foreground">
                          {assessment.code}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[10px]">
                      <span className="rounded-full bg-cyber/10 px-2.5 py-1 text-cyber">
                        {attempts} candidate
                        {attempts === 1 ? "" : "s"}
                      </span>

                      <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                        {score.toFixed(1)}% avg
                      </span>

                      <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                        {assessment.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>Average score</span>
                      <span>{score.toFixed(1)}%</span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-cyber transition-all"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, score),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <Link
                      to="/dashboard/assessments/$code"
                      params={{
                        code: assessment.code,
                      }}
                      className="text-xs text-cyber hover:underline"
                    >
                      View candidates →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function AnalyticsCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="card-3d rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-lg bg-cyber/10 text-cyber">
          <Icon className="size-4" />
        </span>
      </div>

      <p className="mt-4 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>

      <p className="mt-1 font-display text-2xl font-bold">
        {value}
      </p>

      <p className="mt-1 text-[10px] text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function PageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-6rem)] w-full p-1">
      {children}
    </div>
  );
}

function LoadingState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">
        {message}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-md rounded-2xl border border-border/60 bg-background/50 p-6 text-center">
        <h2 className="font-display text-lg font-semibold">
          {title}
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          {message}
        </p>

        {action && (
          <div className="mt-5">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}