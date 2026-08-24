import { useState } from "react";
import { AlertTriangle, Check, FileSearch, ShieldCheck, Undo2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  RequirementMatch,
  SentenceAnalysis,
  SentenceInsight,
  SentenceStrength,
} from "@/interviewer/lib/resume-sentences";
import { cn } from "@/lib/utils";

const STRENGTH_STYLE: Record<SentenceStrength, string> = {
  strong: "border-success/40 bg-success/10 text-success",
  ok: "border-border bg-secondary/60 text-muted-foreground",
  weak: "border-warning/40 bg-warning/10 text-warning",
};

const STRENGTH_LABEL: Record<SentenceStrength, string> = {
  strong: "Strong",
  ok: "OK",
  weak: "Weak",
};

const REQ_STYLE: Record<RequirementMatch["status"], string> = {
  evidenced: "border-success/40 bg-success/10 text-success",
  weak: "border-accent/40 bg-accent/10 text-accent",
  missing: "border-warning/40 bg-warning/10 text-warning",
};

const REQ_LABEL: Record<RequirementMatch["status"], string> = {
  evidenced: "Evidenced",
  weak: "Weak evidence",
  missing: "Missing",
};

const RANK: Record<SentenceStrength, number> = { weak: 0, ok: 1, strong: 2 };

export function ResumeSentenceReview({
  analysis,
  companyName,
  onApply,
  onUndo,
  canUndo,
  className,
}: {
  analysis: SentenceAnalysis;
  companyName: string;
  onApply: (insight: SentenceInsight) => void;
  onUndo: () => void;
  canUndo: boolean;
  className?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const { validation, sentences, requirements } = analysis;

  const sorted = [...sentences].sort((a, b) => RANK[a.strength] - RANK[b.strength]);
  const flagged = sorted.filter((s) => s.strength !== "strong");
  const visible = showAll ? sorted : flagged.slice(0, 8);

  return (
    <section
      className={cn(
        "animate-rise space-y-4 rounded-xl border border-border bg-secondary/25 p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <FileSearch className="h-4 w-4 text-primary" /> Sentence-level review · {companyName}
        </h3>
        {canUndo && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onUndo}>
            <Undo2 className="mr-1 h-3 w-3" /> Undo
          </Button>
        )}
      </div>

      {/* Document check */}
      <div
        className={cn(
          "rounded-lg border px-3 py-2.5 text-xs",
          validation.isResume
            ? "border-success/35 bg-success/10 text-success"
            : "border-destructive/40 bg-destructive/10 text-destructive",
        )}
      >
        <span className="flex items-center gap-1.5 font-semibold">
          {validation.isResume ? (
            <ShieldCheck className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          {validation.isResume
            ? `Reads as a resume · ${validation.confidence}% confidence`
            : `This looks like ${validation.looksLike} · ${validation.confidence}% resume confidence`}
        </span>
        <p className="mt-1 leading-relaxed opacity-90">{validation.reason}</p>
      </div>

      {/* Requirement match */}
      {requirements.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold">What {companyName} screens for</h4>
          <ul className="mt-2 space-y-1.5">
            {requirements.map((r) => (
              <li key={r.requirement} className="rounded-lg bg-background/40 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{r.requirement}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px]",
                      REQ_STYLE[r.status],
                    )}
                  >
                    {REQ_LABEL[r.status]}
                  </span>
                </div>
                {r.evidence ? (
                  <p className="mt-1 text-[11px] italic text-muted-foreground">“{r.evidence}”</p>
                ) : (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    No line in your resume evidences this yet.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Line-by-line */}
      {sentences.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold">
              Line-by-line ({flagged.length} of {sentences.length} need work)
            </h4>
            <button
              type="button"
              className="text-[11px] text-primary hover:underline"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Show only weak lines" : "Show all lines"}
            </button>
          </div>
          <ul className="mt-2 space-y-2">
            {visible.map((s, i) => (
              <li
                key={`${i}-${s.text.slice(0, 24)}`}
                className="rounded-lg border border-border/70 bg-background/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs leading-relaxed">{s.text}</p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                      STRENGTH_STYLE[s.strength],
                    )}
                  >
                    {STRENGTH_LABEL[s.strength]}
                  </span>
                </div>
                {s.issues.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {s.issues.map((issue) => (
                      <li key={issue} className="flex gap-1.5 text-[11px] text-warning">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
                {s.matches.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {s.matches.map((m) => (
                      <span
                        key={m}
                        className="rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] text-success"
                      >
                        <Check className="mr-0.5 inline h-2.5 w-2.5" />
                        {m}
                      </span>
                    ))}
                  </div>
                )}
                {s.rewrite && (
                  <div className="mt-2 rounded-md border border-primary/25 bg-primary/5 p-2.5">
                    <span className="text-[10px] uppercase tracking-widest text-primary">
                      Stronger version
                    </span>
                    <p className="mt-1 text-[11px] leading-relaxed">{s.rewrite}</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2 h-7 px-2 text-[11px]"
                      onClick={() => onApply(s)}
                    >
                      <Wand2 className="mr-1 h-3 w-3" /> Apply &amp; rescore
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!showAll && flagged.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Every analysed line reads strongly for {companyName}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
