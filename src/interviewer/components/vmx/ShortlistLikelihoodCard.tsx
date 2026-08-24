import { Loader2, TrendingUp } from "lucide-react";
import type { ShortlistLikelihood } from "@/interviewer/lib/interview-types";
import { cn } from "@/lib/utils";

function tone(score: number) {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-destructive";
}

const SECTION_LABEL: Record<string, string> = {
  summary: "Summary",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  projects: "Projects",
};

/** Groq-generated shortlist-likelihood, overall and per resume section. */
export function ShortlistLikelihoodCard({
  likelihood,
  loading,
  companyName,
  className,
}: {
  likelihood: ShortlistLikelihood | null;
  loading: boolean;
  companyName: string;
  className?: string;
}) {
  if (loading) {
    return (
      <section className={cn("animate-rise rounded-xl border border-border bg-secondary/25 p-5", className)}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Estimating shortlist likelihood…
        </p>
      </section>
    );
  }

  if (!likelihood) return null;

  return (
    <section className={cn("animate-rise rounded-xl border border-border bg-secondary/25 p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-primary" /> Shortlist likelihood · {companyName}
        </h3>
        <span className={cn("text-lg font-display font-semibold", tone(likelihood.overall))}>
          {likelihood.overall}%
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{likelihood.overallExplanation}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {likelihood.sections.map((s) => (
          <div key={s.section} className="rounded-lg border border-border/70 bg-background/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">{SECTION_LABEL[s.section] ?? s.section}</span>
              <span className={cn("text-xs font-semibold", tone(s.score))}>{s.score}%</span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  s.score >= 70 ? "bg-success" : s.score >= 40 ? "bg-warning" : "bg-destructive",
                )}
                style={{ width: `${Math.max(4, s.score)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{s.explanation}</p>
            {s.improvements.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {s.improvements.map((imp) => (
                  <li key={imp} className="flex gap-1.5 text-[11px] text-primary">
                    <span>→</span> {imp}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
