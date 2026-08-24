import { AlertTriangle, CheckCircle2, Loader2, Sparkles, Wrench } from "lucide-react";
import { ScoreRing } from "@/interviewer/components/vmx/ScoreRing";
import { FIT_LABELS, type ResumeFit } from "@/interviewer/lib/interview-types";
import { cn } from "@/lib/utils";

const TONE = {
  weak: { ring: "warning" as const, badge: "bg-warning/15 text-warning border-warning/30" },
  borderline: { ring: "accent" as const, badge: "bg-accent/15 text-accent border-accent/30" },
  strong: { ring: "success" as const, badge: "bg-success/15 text-success border-success/30" },
};

export function ResumeFitCard({
  fit,
  companyName,
  loading,
  className,
}: {
  fit: ResumeFit | null;
  companyName: string;
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-border bg-secondary/25 p-4 text-sm text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Checking your resume against {companyName}&apos;s hiring bar…
      </div>
    );
  }

  if (!fit) return null;
  const tone = TONE[fit.verdict];

  return (
    <section
      className={cn("animate-rise rounded-xl border border-border bg-secondary/25 p-5", className)}
    >
      <div className="flex flex-wrap items-center gap-4">
        <ScoreRing value={fit.score} label="fit" size={92} tone={tone.ring} />
        <div className="min-w-[14rem] flex-1">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
              tone.badge,
            )}
          >
            {fit.verdict === "strong" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {FIT_LABELS[fit.verdict]} for {companyName}
          </span>
          <p className="mt-2 text-sm leading-relaxed">{fit.statement}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <FitList
          icon={AlertTriangle}
          title={`Missing for ${companyName}`}
          items={fit.missing}
          tone="text-warning"
        />
        <FitList
          icon={CheckCircle2}
          title="Already lands here"
          items={fit.matched.length ? fit.matched : ["Nothing on this resume clears their bar yet"]}
          tone="text-success"
        />
      </div>

      {fit.actions.length > 0 && (
        <div className="mt-5">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Wrench className="h-4 w-4 text-primary" /> How to make it strong for {companyName}
          </h4>
          <ol className="mt-3 space-y-2.5">
            {fit.actions.map((a, i) => (
              <li key={a.title} className="flex gap-3 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-primary/15 text-[11px] font-semibold text-primary">
                  {i + 1}
                </span>
                <span>
                  <span className="font-medium">{a.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{a.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {fit.keywords.length > 0 && (
        <div className="mt-5">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Keywords their screen looks for
          </h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {fit.keywords.map((k) => (
              <span key={k} className="rounded-full bg-secondary/70 px-2 py-0.5 text-[11px]">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function FitList({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: React.ElementType;
  title: string;
  items: string[];
  tone: string;
}) {
  return (
    <div>
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className={cn("h-4 w-4", tone)} /> {title}
      </h4>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-muted-foreground/60">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
