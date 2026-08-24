import { AlertTriangle, ShieldCheck, Users } from "lucide-react";
import { PROCTOR_LABELS, type ProctorEvent } from "@/interviewer/lib/interview-types";
import { cn } from "@/lib/utils";

/**
 * Live proctoring status for the interview room: quiet green when the frame is
 * clean, loud red the moment something breaks interview integrity.
 */
export function IntegrityStrip({
  events,
  enabled,
  warnings,
  className,
}: {
  events: ProctorEvent[];
  enabled: boolean;
  warnings: number;
  className?: string;
}) {
  const recent = events.slice(-3).reverse();
  const flagged = recent.length > 0;

  return (
    <section
      className={cn(
        "rounded-2xl glass p-4",
        flagged && "border border-destructive/40 bg-destructive/5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          {flagged ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-success" />
          )}
          Interview integrity
        </h2>
        {warnings > 0 && (
          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] text-destructive">
            {warnings === 1 ? "1 warning" : `${warnings} warnings`}
          </span>
        )}
      </div>

      {!enabled ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Camera off — proctoring is limited to voice and tab monitoring.
        </p>
      ) : !flagged ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> One candidate in frame, no second voice, tab in focus.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {recent.map((event, i) => (
            <li
              key={`${event.t}-${event.kind}-${i}`}
              className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-foreground"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <span>
                <span className="font-medium">{PROCTOR_LABELS[event.kind]}</span>
                {event.detail ? ` — ${event.detail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Leaving this tab twice ends the interview.
      </p>
    </section>
  );
}
