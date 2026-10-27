import { CheckCircle2, Target, ThumbsDown, ThumbsUp, TrendingDown, XCircle } from "lucide-react";
import { PHASE_LABELS, type Turn, type TurnEvaluation } from "@/interviewer/lib/interview-types";
import { cn } from "@/lib/utils";

function verdictTone(verdict: string) {
  if (verdict === "strong")
    return { text: "text-success", bar: "bg-success", label: "Strong answer" };
  if (verdict === "weak") return { text: "text-warning", bar: "bg-warning", label: "Weak answer" };
  return { text: "text-accent", bar: "bg-accent", label: "Adequate answer" };
}

/**
 * Live per-answer scoring: rubric coverage, points lost and what to do better,
 * plus a running average per interview round.
 */
export function AnswerScoreCard({
  turns,
  turn,
  showRounds = true,
  embedded = false,
  className,
  onFeedback,
}: {
  turns: Turn[];
  turn?: Turn;
  showRounds?: boolean;
  embedded?: boolean;
  className?: string;
  onFeedback?: (feedback: NonNullable<TurnEvaluation["feedback"]>) => void;
}) {
  const scored = turns.filter((t) => t.evaluation && t.answer);
  const scoredTurn = turn ?? scored[scored.length - 1];
  if (!scoredTurn?.evaluation || !scoredTurn.answer) return null;

  const evaluation = scoredTurn.evaluation;
  const tone = verdictTone(evaluation.verdict);
  const lost = Math.max(0, 100 - evaluation.score);
  const missed = evaluation.missed ?? [];
  const matched = evaluation.matched ?? [];

  const rounds = new Map<string, { total: number; count: number }>();
  if (showRounds) {
    for (const t of scored) {
      const key = t.phase;
      const entry = rounds.get(key) ?? { total: 0, count: 0 };
      entry.total += t.evaluation?.score ?? 0;
      entry.count += 1;
      rounds.set(key, entry);
    }
  }

  return (
    <section
      className={cn(
        embedded ? "border-t border-border/70 pt-3" : "animate-rise rounded-2xl glass p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Target className="h-4 w-4 text-primary" /> Answer score
        </h2>
        <span className={cn("text-xs font-semibold", tone.text)}>
          {evaluation.score}/100 · {tone.label}
        </span>
      </div>

      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", tone.bar)}
          style={{ width: `${Math.min(100, Math.max(0, evaluation.score))}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {PHASE_LABELS[scoredTurn.phase]}
        {evaluation.verified ? " · evidence checked" : " · evaluation needs review"}
        {lost > 0 ? ` · ${lost} points lost` : " · full marks"}
      </p>

      {typeof evaluation.evidenceCoverage === "number" && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Evidence coverage: {evaluation.evidenceCoverage}% · coverage is not a probability of
          correctness
        </p>
      )}

      {(matched.length > 0 || missed.length > 0) && (
        <div className="mt-3 space-y-1.5">
          {matched.map((m) => (
            <p key={`m-${m}`} className="flex gap-1.5 text-[11px] text-success">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" /> Covered: {m}
            </p>
          ))}
          {missed.map((m) => (
            <p key={`x-${m}`} className="flex gap-1.5 text-[11px] text-warning">
              <XCircle className="mt-0.5 h-3 w-3 shrink-0" /> Missed: {m}
            </p>
          ))}
          {missed.length > 0 && (
            <p className="flex gap-1.5 text-[11px] text-muted-foreground">
              <TrendingDown className="mt-0.5 h-3 w-3 shrink-0" />
              {lost} points came from the {missed.length} rubric point
              {missed.length === 1 ? "" : "s"} above.
            </p>
          )}
        </div>
      )}

      {evaluation.evidence && evaluation.evidence.length > 0 && (
        <div className="mt-3 space-y-2">
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Evidence from your answer
          </h3>
          {evaluation.evidence.map((item, index) => (
            <blockquote
              key={`${item.criterion}-${index}`}
              className="rounded-lg border-l-2 border-primary/50 bg-secondary/30 px-3 py-2 text-[11px]"
            >
              <span className="font-medium">{item.criterion}</span>
              <p className="mt-1 text-muted-foreground">&ldquo;{item.quote}&rdquo;</p>
            </blockquote>
          ))}
        </div>
      )}

      {evaluation.note && (
        <p className="mt-3 rounded-lg bg-secondary/40 px-3 py-2 text-[11px] leading-relaxed">
          <span className="text-primary">Do better next: </span>
          {evaluation.note}
        </p>
      )}

      {onFeedback && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Was this evaluation useful?</span>
          <button
            type="button"
            aria-pressed={evaluation.feedback === "helpful"}
            onClick={() => onFeedback("helpful")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] hover:bg-secondary",
              evaluation.feedback === "helpful" && "border-primary text-primary",
            )}
          >
            <ThumbsUp className="h-3 w-3" /> Yes
          </button>
          <button
            type="button"
            aria-pressed={evaluation.feedback === "needs_review"}
            onClick={() => onFeedback("needs_review")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] hover:bg-secondary",
              evaluation.feedback === "needs_review" && "border-warning text-warning",
            )}
          >
            <ThumbsDown className="h-3 w-3" /> Needs review
          </button>
        </div>
      )}

      {showRounds && rounds.size > 0 && (
        <div className="mt-3 space-y-1">
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Round average
          </h3>
          {[...rounds.entries()].map(([phase, r]) => (
            <div key={phase} className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                {PHASE_LABELS[phase as Turn["phase"]]} · {r.count} answer{r.count === 1 ? "" : "s"}
              </span>
              <span className="font-semibold tabular-nums">
                {Math.round(r.total / r.count)}/100
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
