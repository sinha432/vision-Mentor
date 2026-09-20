import { Eye, Loader2, PersonStanding, Scissors, Sparkles, Waves } from "lucide-react";
import { byPriority } from "@/interviewer/lib/coach-priority";
import { SEVERITY_LABELS, type CoachingEvent, type FlagSeverity } from "@/interviewer/lib/interview-types";
import { cn } from "@/lib/utils";

const ICONS = {
  posture: PersonStanding,
  eye_contact: Eye,
  hair: Scissors,
  grooming: Sparkles,
  framing: Eye,
  delivery: Waves,
} as const;

export const SEVERITY_STYLES: Record<FlagSeverity, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-secondary/60 text-muted-foreground border-border",
};

export function SeverityChip({ severity }: { severity: FlagSeverity }) {
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        SEVERITY_STYLES[severity],
      )}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

export function PresenceCoach({
  events,
  checking,
  enabled,
  lastCaptureAt,
  className,
}: {
  events: CoachingEvent[];
  checking: boolean;
  enabled: boolean;
  lastCaptureAt?: number | null;
  className?: string;
}) {
  // Most urgent first so the biggest fix is always on top.
  const latest = [...events.slice(-8)].sort(byPriority).slice(0, 3);

  return (
    <section className={cn("rounded-2xl glass p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Presence coach</h2>
        {checking ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : enabled && lastCaptureAt ? (
          <span className="text-[10px] text-success">Live frame captured</span>
        ) : null}
      </div>

      {!enabled ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Turn the camera on to get live posture, eye contact and grooming corrections.
        </p>
      ) : latest.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Watching your posture, eye contact, grooming and speaking pace…
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {latest.map((e, i) => {
            const Icon = ICONS[e.area];
            const severity = e.severity ?? "low";
            return (
              <li
                key={`${e.t}-${e.area}-${e.instruction}`}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs leading-relaxed",
                  i === 0
                    ? "bg-primary/10 text-foreground"
                    : "bg-secondary/35 text-muted-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", i === 0 ? "text-primary" : "")} />
                  <SeverityChip severity={severity} />
                  {typeof e.confidence === "number" && (
                    <span className="ml-auto tabular-nums text-[10px] text-muted-foreground">
                      {Math.round(e.confidence)}% sure
                    </span>
                  )}
                </div>
                <p className="mt-1.5">{e.instruction}</p>
                {e.reason && <p className="mt-1 text-[11px] text-muted-foreground">{e.reason}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
