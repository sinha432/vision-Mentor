import { Gauge, ListChecks } from "lucide-react";
import type { AtsResult } from "@/interviewer/lib/ats";
import { cn } from "@/lib/utils";

function tone(score: number) {
  if (score >= 75) return { bar: "bg-success", text: "text-success", label: "ATS-ready" };
  if (score >= 50) return { bar: "bg-accent", text: "text-accent", label: "Needs work" };
  return { bar: "bg-warning", text: "text-warning", label: "Likely filtered out" };
}

export function AtsMeter({
  ats,
  companyName,
  className,
}: {
  ats: AtsResult;
  companyName: string;
  className?: string;
}) {
  const t = tone(ats.score);
  return (
    <section
      className={cn("animate-rise rounded-xl border border-border bg-secondary/25 p-5", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Gauge className="h-4 w-4 text-primary" /> Live ATS score · {companyName}
        </h3>
        <span className={cn("text-xs font-semibold", t.text)}>
          {ats.score}/100 · {t.label}
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", t.bar)}
          style={{ width: `${ats.score}%` }}
        />
      </div>

      {ats.breakdown.length > 0 && (
        <ul className="mt-4 space-y-2">
          {ats.breakdown.map((b) => (
            <li key={b.label} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">{b.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {b.score}/{b.max}
                </span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${(b.score / b.max) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{b.hint}</p>
            </li>
          ))}
        </ul>
      )}

      {ats.missingKeywords.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold">Missing keywords</h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ats.missingKeywords.slice(0, 12).map((k) => (
              <span
                key={k}
                className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] text-warning"
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {ats.suggestions.length > 0 && (
        <div className="mt-4">
          <h4 className="flex items-center gap-2 text-xs font-semibold">
            <ListChecks className="h-3.5 w-3.5 text-primary" /> Fix these to raise the score
          </h4>
          <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            {ats.suggestions.map((s, i) => (
              <li key={s} className="flex gap-2">
                <span className="text-primary">{i + 1}.</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
